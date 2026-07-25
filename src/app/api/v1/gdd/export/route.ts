/**
 * POST /api/v1/gdd/export
 *
 * Exports the previously generated GDD (from ProjectGDD.fullProfile) into
 * the requested format (pdf | docx | html | md). Returns base64-encoded
 * content + filename + mime_type. If no GDD exists, generates a fallback
 * markdown document on the fly from project name/description/genre.
 *
 * Body:
 *   { format, project_id? }
 *
 * Response: GDDExportResponse (matches src/types/gdd.ts)
 *   { format, content (base64), filename, mime_type, size_bytes }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  safeJsonParse,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const VALID_FORMATS = ["pdf", "docx", "html", "md"];

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html",
  md: "text/markdown",
};

function toBase64(text: string): string {
  // Node.js Buffer base64 (UTF-8 safe)
  return Buffer.from(text, "utf8").toString("base64");
}

function mdToHtml(md: string, title: string): string {
  // Very small markdown → HTML conversion (sufficient for export preview).
  let body = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  if (!body.startsWith("<h")) body = `<p>${body}</p>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:1rem;line-height:1.6;color:#1a1a1a}h1{font-size:1.6rem}h2{font-size:1.3rem}h3{font-size:1.1rem}code{background:#f4f4f5;padding:0.1rem 0.3rem;border-radius:0.2rem}blockquote{border-left:3px solid #ccc;padding-left:1rem;color:#555}</style></head><body>${body}</body></html>`;
}

function mdToDocxLikeXml(md: string, title: string): string {
  // Minimal Word XML (.docx is a zip; we emit a flat .xml wordprocessingML document).
  const paragraphs = md.split(/\n{2,}/).map((chunk) => {
    const escaped = chunk
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>
<w:p><w:r><w:t>${title}</w:t></w:r></w:p>
${paragraphs.join("\n")}
</w:body>
</w:wordDocument>`;
}

function mdToPdfLike(md: string, title: string): string {
  // PDF is binary; we cannot easily produce a real PDF without heavy deps.
  // Emit a minimal valid PDF wrapper containing the markdown as a text stream.
  const text = `${title}\n\n${md}`;
  // Build a minimal one-page PDF with the text in a stream.
  const header = "%PDF-1.4\n";
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n"
  );
  const escapedText = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentStream = `BT /F1 10 Tf 50 800 Td (${escapedText.slice(0, 4000)}) Tj ET`;
  objects.push(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  const xrefStart = header.length + objects.join("").length;
  let pdf = header + objects.join("");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  let offset = header.length;
  for (let i = 0; i < objects.length; i++) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    offset += objects[i].length;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

/**
 * Сгенерировать настоящий PDF через pdf skill (html2pdf-next.js, Playwright).
 * Возвращает Buffer с бинарным PDF. Если Playwright недоступен — fallback
 * на минимальный text-PDF.
 */
async function generateRealPdf(md: string, title: string): Promise<Buffer> {
  const html = mdToHtml(md, title);
  const tmp = join(tmpdir(), "gidede-export");
  await mkdir(tmp, { recursive: true });
  const id = randomBytes(8).toString("hex");
  const htmlPath = join(tmp, `${id}.html`);
  const pdfPath = join(tmp, `${id}.pdf`);
  const scriptPath = join(
    process.cwd(),
    "skills",
    "pdf",
    "scripts",
    "html2pdf-next.js"
  );

  await writeFile(htmlPath, html, "utf8");

  try {
    const { execFile } = await import("child_process");
    await new Promise<void>((resolve, reject) => {
      execFile(
        "node",
        [scriptPath, htmlPath, "--output", pdfPath, "--width", "210mm", "--height", "297mm"],
        { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            console.error("[gdd/export] html2pdf-next failed:", err.message);
            console.error("[gdd/export] stderr:", stderr?.slice(-500));
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    const pdfBuffer = await readFile(pdfPath);
    if (pdfBuffer.length > 0) {
      return pdfBuffer;
    }
    throw new Error("PDF buffer empty");
  } catch (err) {
    console.error("[gdd/export] Falling back to text-PDF:", err);
    // Fallback на минимальный text-PDF
    return Buffer.from(mdToPdfLike(md, title), "latin1");
  } finally {
    // Clean up temp files
    await unlink(htmlPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
    const format = body?.format?.toString().trim() || "md";

    if (!VALID_FORMATS.includes(format)) {
      return VALIDATION_ERROR(`Неверный формат экспорта: ${format}`);
    }

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as {
      id: string;
      name: string;
      description: string | null;
      genre: string | null;
      gdd?: { fullProfile: string | null; sections: string | null; format: string | null } | null;
    };

    // --- Resolve markdown source ---
    let markdown = "";
    let title = proj.name || "Untitled Project";

    if (proj.gdd?.fullProfile) {
      const profile = safeJsonParse<{
        formatted_document?: { markdown?: string; title?: string };
        assembled_document?: {
          sections?: Record<string, { content?: string; section_name?: string }>;
          section_order?: string[];
        };
      }>(proj.gdd.fullProfile, {});

      if (profile.formatted_document?.markdown) {
        markdown = profile.formatted_document.markdown;
      } else if (profile.assembled_document?.sections) {
        const sections = profile.assembled_document.sections;
        const order = profile.assembled_document.section_order || Object.keys(sections);
        const parts: string[] = [`# ${title}\n`];
        for (const key of order) {
          const sec = sections[key];
          if (sec) {
            parts.push(`## ${sec.section_name || key}\n\n${sec.content || ""}\n`);
          }
        }
        markdown = parts.join("\n");
      }
      if (profile.formatted_document?.title) title = profile.formatted_document.title;
    }

    if (!markdown) {
      // Build minimal fallback markdown
      markdown = `# ${title}\n\n> Жанр: ${proj.genre || "—"}\n\n${proj.description || "Описание отсутствует."}\n\n_GDD ещё не сгенерирован — это минимальный экспорт._`;
    }

    // --- Format conversion ---
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "md":
        content = toBase64(markdown);
        filename = `${title.replace(/[^a-z0-9_-]+/gi, "_")}.md`;
        mimeType = MIME_TYPES.md;
        break;
      case "html":
        content = toBase64(mdToHtml(markdown, title));
        filename = `${title.replace(/[^a-z0-9_-]+/gi, "_")}.html`;
        mimeType = MIME_TYPES.html;
        break;
      case "docx":
        // Real DOCX via the 'docx' npm package (Packer.toBuffer → base64)
        try {
          const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
          const blocks: InstanceType<typeof Paragraph>[] = [];
          // Title
          blocks.push(new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(title)],
          }));
          // Parse markdown into paragraphs
          for (const line of markdown.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith("### ")) {
              blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(trimmed.slice(4))] }));
            } else if (trimmed.startsWith("## ")) {
              blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(trimmed.slice(3))] }));
            } else if (trimmed.startsWith("# ")) {
              blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(trimmed.slice(2))] }));
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              blocks.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(trimmed.slice(2))] }));
            } else if (trimmed.startsWith("> ")) {
              blocks.push(new Paragraph({ children: [new TextRun({ text: trimmed.slice(2), italics: true })] }));
            } else {
              // Parse bold/italic markdown inline
              const runs: InstanceType<typeof TextRun>[] = [];
              const parts = trimmed.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
              for (const part of parts) {
                if (part.startsWith("**") && part.endsWith("**")) {
                  runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
                } else if (part.startsWith("*") && part.endsWith("*")) {
                  runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
                } else if (part) {
                  runs.push(new TextRun(part));
                }
              }
              blocks.push(new Paragraph({ children: runs }));
            }
          }
          const doc = new Document({ sections: [{ children: blocks }] });
          const buffer = await Packer.toBuffer(doc);
          content = buffer.toString("base64");
        } catch (e) {
          console.error("[gdd/export] DOCX generation failed, falling back to XML:", e);
          content = toBase64(mdToDocxLikeXml(markdown, title));
        }
        filename = `${title.replace(/[^a-z0-9_-]+/gi, "_")}.docx`;
        mimeType = MIME_TYPES.docx;
        break;
      case "pdf":
        const pdfBuffer = await generateRealPdf(markdown, title);
        content = pdfBuffer.toString("base64");
        filename = `${title.replace(/[^a-z0-9_-]+/gi, "_")}.pdf`;
        mimeType = MIME_TYPES.pdf;
        break;
      default:
        content = toBase64(markdown);
        filename = `${title}.md`;
        mimeType = MIME_TYPES.md;
    }

    const sizeBytes = Math.floor((content.length * 3) / 4); // base64 → bytes approx

    const response = {
      format,
      content,
      filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      latency_ms: Date.now() - startedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[gdd/export] error:", error);
    return SERVER_ERROR();
  }
}
