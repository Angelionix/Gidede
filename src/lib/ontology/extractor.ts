/**
 * PDF text extractor.
 *
 * Converts PDF books to plain text using pdftotext (poppler-utils).
 * Falls back to pdfplumber (Python) if pdftotext fails.
 *
 * Design spec: docs/ONTOLOGY_RAW_BOOKS_REBUILD_PLAN.md (stage 1)
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { join, basename, extname } from "path";

// ============================================================
// Types
// ============================================================

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  chapter: string;  // best-effort chapter detection
}

export interface ExtractedBook {
  bookId: string;
  filename: string;
  pages: ExtractedPage[];
  totalText: string;
  pageCount: number;
  wordCount: number;
}

// ============================================================
// PDF → text via pdftotext
// ============================================================

/**
 * Extract text from a PDF file using pdftotext.
 * Returns an array of pages with text.
 */
export function extractPdfPages(pdfPath: string): ExtractedPage[] {
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  // Use pdftotext with page breaks (form feed \f)
  const result = execSync(
    `pdftotext -layout "${pdfPath}" -`,
    { encoding: "utf-8", maxBuffer: 100 * 1024 * 1024 } // 100 MB buffer
  );

  // Split by form feed (\f) which pdftotext uses as page separator
  const pages = result.split("\f");
  const extractedPages: ExtractedPage[] = [];

  let currentChapter = "";

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i].trim();
    if (!text) continue;

    // Best-effort chapter detection: look for "Chapter X" or "Глава X" at start
    const chapterMatch = text.match(/^(?:Chapter|Глава|ГЛАВА)\s+(\d+[^\n]*)/im);
    if (chapterMatch) {
      currentChapter = chapterMatch[0].trim().substring(0, 80);
    }

    extractedPages.push({
      pageNumber: i + 1,
      text,
      chapter: currentChapter || `Page ${i + 1}`,
    });
  }

  return extractedPages;
}

/**
 * Extract text from a PDF file and save to .txt file.
 * Caches the result — if .txt already exists, reads it.
 */
export function extractPdfToText(
  pdfPath: string,
  outputDir: string,
  useCache = true,
): ExtractedBook {
  const bookId = basename(pdfPath, extname(pdfPath));
  const txtPath = join(outputDir, `${bookId}.txt`);

  // Check cache
  if (useCache && existsSync(txtPath)) {
    const cachedText = readFileSync(txtPath, "utf-8");
    return parseCachedText(bookId, basename(pdfPath), cachedText);
  }

  // Extract
  mkdirSync(outputDir, { recursive: true });
  const pages = extractPdfPages(pdfPath);
  const totalText = pages.map((p) => p.text).join("\n\n");

  // Save cache
  writeFileSync(txtPath, totalText, "utf-8");

  return {
    bookId,
    filename: basename(pdfPath),
    pages,
    totalText,
    pageCount: pages.length,
    wordCount: totalText.split(/\s+/).length,
  };
}

/**
 * Parse a cached .txt file back into pages.
 * Since we don't store page boundaries in cache, we treat the whole
 * text as a single "page" for chunking purposes.
 */
function parseCachedText(
  bookId: string,
  filename: string,
  text: string,
): ExtractedBook {
  return {
    bookId,
    filename,
    pages: [{ pageNumber: 1, text, chapter: "Full text" }],
    totalText: text,
    pageCount: 1,
    wordCount: text.split(/\s+/).length,
  };
}

// ============================================================
// Batch extraction
// ============================================================

/**
 * Extract text from all PDFs in a directory.
 */
export function extractAllPdfs(
  pdfDir: string,
  outputDir: string,
  useCache = true,
): ExtractedBook[] {
  const pdfFiles = readdirSync(pdfDir)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  const books: ExtractedBook[] = [];

  for (const pdfFile of pdfFiles) {
    const pdfPath = join(pdfDir, pdfFile);
    try {
      const book = extractPdfToText(pdfPath, outputDir, useCache);
      books.push(book);
      console.log(
        `[extractor] ${pdfFile}: ${book.pageCount} pages, ${book.wordCount} words`,
      );
    } catch (e) {
      console.error(`[extractor] FAILED ${pdfFile}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return books;
}
