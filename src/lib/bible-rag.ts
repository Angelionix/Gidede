/**
 * Gidede — Bible RAG service.
 *
 * Загружает 12 разделов Библии геймдизайна (docs/bible/bible_2_*.md) при первом
 * обращении, разбивает на чанки ~500 токенов и индексирует для поиска.
 *
 * Скорование: TF-IDF-подобный алгоритм (term frequency × inverse document
 * frequency) поверх токенов. Без внешних embeddings — работает offline.
 *
 * Закрывает TD-014: RAG-сервис с реальной базой знаний из 12 разделов Библии.
 */

import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// ============================================================
// Types
// ============================================================

interface BibleChunk {
  id: string;
  section: string;     // e.g. "2.3 MDA Framework"
  title: string;       // heading from the markdown
  content: string;     // ~500 tokens of text
  source: string;      // file path
  tokens: Set<string>; // pre-tokenized for scoring
}

export interface BibleRagResult {
  sourceId: string;
  title: string;
  snippet: string;
  fullContent?: string;
  source: string;
  section: string;
  score: number;
}

// ============================================================
// Lazy-loaded index
// ============================================================

let chunks: BibleChunk[] | null = null;
let documentFrequency: Map<string, number> = new Map();
let loadingPromise: Promise<BibleChunk[]> | null = null;

const BIBLE_DIR = join(process.cwd(), "docs", "bible");
const CHUNK_SIZE = 500;       // approximate tokens per chunk
const CHUNK_OVERLAP = 50;     // overlap to preserve context

// Russian + English stopwords
const STOPWORDS = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то",
  "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за",
  "бы", "по", "только", "ее", "мне", "было", "вот", "от", "меня", "о", "из",
  "ему", "теперь", "когда", "даже", "ну", "вдруг", "ли", "если", "уже", "или",
  "ни", "быть", "был", "него", "до", "вас", "нибудь", "опять", "уж", "вам",
  "ведь", "там", "потом", "себя", "ничего", "ей", "может", "они", "тут", "где",
  "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем", "была", "сам", "чтоб",
  "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет", "ж", "тогда",
  "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь",
  "этом", "один", "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были",
  "куда", "зачем", "всех", "никогда", "можно", "при", "наконец", "два", "об",
  "другой", "хоть", "после", "над", "больше", "тот", "через", "эти", "нас",
  "про", "всего", "них", "какая", "много", "разве", "три", "эту", "моя", "впрочем",
  "хорошо", "свою", "этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя",
  "такой", "им", "более", "всегда", "конечно", "всю", "между",
  // English stopwords
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "this", "that", "these", "those", "it", "its", "as", "if", "then", "than",
  "can", "may", "might", "must", "shall", "about", "above", "below", "up",
  "down", "out", "off", "over", "under", "again", "further", "once", "here",
  "there", "when", "where", "why", "how", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "too", "very", "s", "t", "just", "don",
]);

// ============================================================
// Tokenization
// ============================================================

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?()\-—–«»"'#\[\]*+=|\\/<>`~]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

// ============================================================
// Bible loading + chunking
// ============================================================

function extractSectionTitle(filename: string, content: string): string {
  // bible_2_3_mda_framework.md → "2.3 MDA Framework"
  const match = filename.match(/bible_(\d+)_(\d+)_(.+)\.md$/);
  if (!match) return filename;
  const [, major, minor, slug] = match;
  const title = slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${major}.${minor} ${title}`;
}

function chunkMarkdown(
  content: string,
  section: string,
  source: string
): BibleChunk[] {
  // Split by headings (## or ###) to get semantic blocks
  const blocks = content.split(/^(#{1,3}\s+.+)$/gm);
  const chunks: BibleChunk[] = [];
  let currentHeading = section;
  const sourceKey = source
    .split(/[\\/]/)
    .pop()!
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .toLowerCase();
  const nextChunkId = () => `bible:${sourceKey}:chunk-${chunks.length + 1}`;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (/^#{1,3}\s+/.test(block)) {
      currentHeading = block.replace(/^#{1,3}\s+/, "").trim();
      continue;
    }

    const text = block.trim();
    if (text.length < 50) continue;

    // Split long blocks into ~CHUNK_SIZE token chunks with overlap
    const words = text.split(/\s+/);
    if (words.length <= CHUNK_SIZE) {
      const content = words.join(" ");
      chunks.push({
        id: nextChunkId(),
        section,
        title: currentHeading,
        content,
        source,
        tokens: new Set(tokenize(content)),
      });
    } else {
      for (let j = 0; j < words.length; j += CHUNK_SIZE - CHUNK_OVERLAP) {
        const slice = words.slice(j, j + CHUNK_SIZE).join(" ");
        if (slice.trim().length > 50) {
          chunks.push({
            id: nextChunkId(),
            section,
            title: currentHeading,
            content: slice,
            source,
            tokens: new Set(tokenize(slice)),
          });
        }
        if (j + CHUNK_SIZE >= words.length) break;
      }
    }
  }

  return chunks;
}

async function loadBible(): Promise<BibleChunk[]> {
  if (chunks) return chunks;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const result: BibleChunk[] = [];

    if (!existsSync(BIBLE_DIR)) {
      console.warn("[bible-rag] Bible directory not found:", BIBLE_DIR);
      chunks = [];
      return chunks;
    }

    const files = (await readdir(BIBLE_DIR))
      .filter((f) => f.startsWith("bible_") && f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const filePath = join(BIBLE_DIR, file);
      const content = await readFile(filePath, "utf8");
      const section = extractSectionTitle(file, content);
      const fileChunks = chunkMarkdown(content, section, `docs/bible/${file}`);
      result.push(...fileChunks);
    }

    // Build document frequency map for IDF
    const df = new Map<string, number>();
    for (const chunk of result) {
      for (const tok of chunk.tokens) {
        df.set(tok, (df.get(tok) || 0) + 1);
      }
    }
    documentFrequency = df;

    chunks = result;
    console.log(`[bible-rag] Loaded ${result.length} chunks from ${files.length} bible sections`);
    return chunks;
  })();

  return loadingPromise;
}

// ============================================================
// Search (TF-IDF scoring)
// ============================================================

export async function searchBible(
  query: string,
  topK = 5
): Promise<{ results: BibleRagResult[]; total: number }> {
  const allChunks = await loadBible();
  if (allChunks.length === 0) {
    return { results: [], total: 0 };
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return { results: [], total: 0 };
  }

  const N = allChunks.length;

  // Score each chunk: sum of (tf * idf) for query tokens present in chunk
  const scored = allChunks
    .map((chunk) => {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();

      for (const tok of queryTokens) {
        if (chunk.tokens.has(tok)) {
          // Term frequency (approximate: count occurrences)
          const tf = (contentLower.match(new RegExp(`\\b${escapeRegex(tok)}`, "g")) || []).length;
          // Inverse document frequency
          const df = documentFrequency.get(tok) || 1;
          const idf = Math.log((N + 1) / (df + 1)) + 1;
          score += tf * idf;
        }
        // Partial match bonus (substring)
        if (tok.length > 4) {
          for (const ct of chunk.tokens) {
            if (ct !== tok && (ct.includes(tok) || tok.includes(ct))) {
              score += 0.3;
              break;
            }
          }
        }
      }

      // Title match boost
      const titleLower = chunk.title.toLowerCase();
      for (const tok of queryTokens) {
        if (titleLower.includes(tok)) score += 2;
      }

      return { chunk, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    results: scored.map((s) => ({
      sourceId: s.chunk.id,
      title: s.chunk.title,
      snippet: s.chunk.content.slice(0, 300).replace(/\n+/g, " ").trim() + "...",
      fullContent: s.chunk.content,
      source: s.chunk.source,
      section: s.chunk.section,
      score: Number(s.score.toFixed(2)),
    })),
    total: scored.length,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Get bible index stats (for debugging / info). */
export async function getBibleStats(): Promise<{
  sections: number;
  chunks: number;
  uniqueTerms: number;
}> {
  const allChunks = await loadBible();
  const sections = new Set(allChunks.map((c) => c.section));
  return {
    sections: sections.size,
    chunks: allChunks.length,
    uniqueTerms: documentFrequency.size,
  };
}
