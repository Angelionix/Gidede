/**
 * Text chunker — splits book text into ~2000-token chunks.
 *
 * Each chunk preserves book ID, chapter, and page number for provenance.
 *
 * Design spec: docs/ONTOLOGY_RAW_BOOKS_REBUILD_PLAN.md (stage 2)
 */

import type { BookChunk } from "./types";
import type { ExtractedBook, ExtractedPage } from "./extractor";

// ============================================================
// Config
// ============================================================

const CHUNK_SIZE_TOKENS = 2000;     // target tokens per chunk
const CHUNK_OVERLAP_TOKENS = 200;   // overlap for context preservation
const TOKENS_PER_WORD = 1.3;        // approximate: 1 word ≈ 1.3 tokens for Russian
const MIN_CHUNK_SIZE = 500;         // don't create chunks smaller than this

// ============================================================
// Token estimation
// ============================================================

export function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * TOKENS_PER_WORD);
}

// ============================================================
// Chunking
// ============================================================

/**
 * Split an ExtractedBook into BookChunks.
 * Each chunk is ~2000 tokens with ~200 token overlap.
 * Chunks respect page boundaries where possible.
 */
export function chunkBook(book: ExtractedBook): BookChunk[] {
  const chunks: BookChunk[] = [];
  let currentText = "";
  let currentTokens = 0;
  let currentChapter = "";
  let currentPage = 1;
  let chunkIndex = 0;

  for (const page of book.pages) {
    const pageText = page.text;
    const pageTokens = estimateTokens(pageText);

    // If a single page is longer than chunk size, split it
    if (pageTokens > CHUNK_SIZE_TOKENS * 1.5) {
      // First, flush any accumulated text
      if (currentTokens > MIN_CHUNK_SIZE) {
        chunks.push(createChunk(
          book.bookId, chunkIndex++, currentText,
          currentChapter, currentPage,
        ));
        currentText = "";
        currentTokens = 0;
      }

      // Split the long page by paragraphs
      const paragraphs = pageText.split(/\n\s*\n/);
      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (currentTokens + paraTokens > CHUNK_SIZE_TOKENS && currentTokens > MIN_CHUNK_SIZE) {
          chunks.push(createChunk(
            book.bookId, chunkIndex++, currentText,
            page.chapter, page.pageNumber,
          ));
          // Keep overlap
          const overlap = getOverlap(currentText);
          currentText = overlap + "\n\n" + para;
          currentTokens = estimateTokens(currentText);
        } else {
          currentText += (currentText ? "\n\n" : "") + para;
          currentTokens += paraTokens;
        }
      }
      currentChapter = page.chapter;
      currentPage = page.pageNumber;
      continue;
    }

    // Normal case: accumulate pages until we reach chunk size
    if (currentTokens + pageTokens > CHUNK_SIZE_TOKENS && currentTokens > MIN_CHUNK_SIZE) {
      // Flush current chunk
      chunks.push(createChunk(
        book.bookId, chunkIndex++, currentText,
        currentChapter, currentPage,
      ));
      // Start new chunk with overlap
      const overlap = getOverlap(currentText);
      currentText = overlap + "\n\n" + pageText;
      currentTokens = estimateTokens(currentText);
    } else {
      currentText += (currentText ? "\n\n" : "") + pageText;
      currentTokens += pageTokens;
    }

    // Update chapter/page tracking
    if (page.chapter) currentChapter = page.chapter;
    currentPage = page.pageNumber;
  }

  // Flush remaining text (always create at least one chunk if there's any text)
  if (currentTokens > 0 || chunks.length === 0) {
    if (currentText.trim().length > 0) {
      chunks.push(createChunk(
        book.bookId, chunkIndex++, currentText,
        currentChapter, currentPage,
      ));
    }
  }

  // Ensure at least one chunk per book
  if (chunks.length === 0 && book.totalText.trim().length > 0) {
    chunks.push(createChunk(
      book.bookId, 0, book.totalText.substring(0, 4000),
      book.pages[0]?.chapter || "Full text",
      book.pages[0]?.pageNumber || 1,
    ));
  }

  return chunks;
}

/**
 * Create a BookChunk object.
 */
function createChunk(
  bookId: string,
  chunkIndex: number,
  text: string,
  chapter: string,
  page: number,
): BookChunk {
  return {
    id: `${bookId}:chunk-${String(chunkIndex).padStart(3, "0")}`,
    bookId,
    chapter: chapter || `Chunk ${chunkIndex}`,
    page,
    chunkIndex,
    text: text.trim(),
    tokenCount: estimateTokens(text),
  };
}

/**
 * Get the last N tokens of text as overlap for the next chunk.
 */
function getOverlap(text: string): string {
  const words = text.split(/\s+/);
  const overlapWords = Math.ceil(CHUNK_OVERLAP_TOKENS / TOKENS_PER_WORD);
  if (words.length <= overlapWords) return "";
  return words.slice(-overlapWords).join(" ");
}

// ============================================================
// Batch chunking
// ============================================================

/**
 * Chunk multiple books into a flat array of BookChunks.
 */
export function chunkAllBooks(books: ExtractedBook[]): BookChunk[] {
  const allChunks: BookChunk[] = [];
  for (const book of books) {
    const chunks = chunkBook(book);
    allChunks.push(...chunks);
    console.log(`[chunker] ${book.bookId}: ${chunks.length} chunks`);
  }
  return allChunks;
}
