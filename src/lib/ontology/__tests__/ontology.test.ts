/**
 * Tests for ontology: extractor, chunker, merger.
 *
 * Phase 1 acceptance criteria:
 * - Extractor: PDF → text (pages preserved)
 * - Chunker: text → ~2000 token chunks with provenance
 * - Merger: dedup entities, merge relations, multi-book weight boost
 */

import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { extractPdfToText, type ExtractedBook } from "../extractor";
import { chunkBook, estimateTokens, chunkAllBooks } from "../chunker";
import { mergeOntology } from "../merger";
import type { ExtractionResult } from "../types";

// ============================================================
// Helpers
// ============================================================

const TEST_DIR = "/tmp/ontology-test";

function ensureTestDir() {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
}

function createTestPdf(text: string, outputPath: string): void {
  // Create a simple text-based PDF using Python
  const pythonScript = `
import sys
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)
for line in sys.stdin.read().split("\\n"):
    pdf.multi_cell(0, 5, line)
pdf.output("${outputPath}")
`;
  // Use a temp Python script
  const scriptPath = join(TEST_DIR, "create_pdf.py");
  writeFileSync(scriptPath, pythonScript);
  try {
    execSync(`python3 "${scriptPath}"`, { input: text, encoding: "utf-8" });
  } catch {
    // fpdf might not be installed; skip PDF creation
  }
}

// ============================================================
// Chunker tests (no PDF needed)
// ============================================================

describe("estimateTokens", () => {
  it("estimates tokens from text", () => {
    const text = "hello world this is a test";
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("handles empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("scales with text length", () => {
    const short = estimateTokens("one two three");
    const long = estimateTokens("one two three four five six seven eight nine ten");
    expect(long).toBeGreaterThan(short);
  });
});

describe("chunkBook", () => {
  function makeBook(text: string, pages = 1): ExtractedBook {
    return {
      bookId: "test-book",
      filename: "test.pdf",
      pages: Array.from({ length: pages }, (_, i) => ({
        pageNumber: i + 1,
        text,
        chapter: `Chapter ${i + 1}`,
      })),
      totalText: text.repeat(pages),
      pageCount: pages,
      wordCount: text.split(/\s+/).length * pages,
    };
  }

  it("creates at least one chunk for any text", () => {
    const book = makeBook("This is a short text.");
    const chunks = chunkBook(book);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves book ID in chunk IDs", () => {
    const book = makeBook("Some text for testing the chunker.");
    const chunks = chunkBook(book);
    for (const chunk of chunks) {
      expect(chunk.id).toContain("test-book");
      expect(chunk.bookId).toBe("test-book");
    }
  });

  it("preserves chapter info", () => {
    const book = makeBook("Some text for testing.", 3);
    const chunks = chunkBook(book);
    for (const chunk of chunks) {
      expect(chunk.chapter).toBeTruthy();
    }
  });

  it("creates multiple chunks for large text", () => {
    // Create text large enough to need multiple chunks with paragraph breaks
    const paragraphs = Array.from({ length: 200 }, (_, i) =>
      `Paragraph ${i}: ` + Array.from({ length: 30 }, (_, j) => `word${i}_${j}`).join(" ")
    );
    const longText = paragraphs.join("\n\n");
    const book = makeBook(longText);
    const chunks = chunkBook(book);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("chunks have token counts", () => {
    const book = makeBook("Some text for testing the chunker with enough words.");
    const chunks = chunkBook(book);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });
});

describe("chunkAllBooks", () => {
  it("chunks multiple books", () => {
    const books: ExtractedBook[] = [
      {
        bookId: "book-a", filename: "a.pdf",
        pages: [{ pageNumber: 1, text: "Text for book A.", chapter: "Ch1" }],
        totalText: "Text for book A.",
        pageCount: 1, wordCount: 4,
      },
      {
        bookId: "book-b", filename: "b.pdf",
        pages: [{ pageNumber: 1, text: "Text for book B.", chapter: "Ch1" }],
        totalText: "Text for book B.",
        pageCount: 1, wordCount: 4,
      },
    ];
    const chunks = chunkAllBooks(books);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.bookId === "book-a")).toBe(true);
    expect(chunks.some((c) => c.bookId === "book-b")).toBe(true);
  });
});

// ============================================================
// Merger tests
// ============================================================

describe("mergeOntology", () => {
  it("merges entities from multiple extractions", () => {
    const extractions: ExtractionResult[] = [
      {
        entities: [
          { type: "Mechanic", name: "locomotion", description: "Movement", sourceRef: "schell:ch3:p47" },
          { type: "Genre", name: "racing", description: "Racing genre", sourceRef: "schell:ch3:p47" },
        ],
        relations: [
          { from: "racing", to: "locomotion", type: "REQUIRES_MECHANIC", weight: 0.9, sourceRef: "schell:ch3:p47" },
        ],
      },
      {
        entities: [
          { type: "Mechanic", name: "locomotion", description: "Player movement mechanic", sourceRef: "adams:ch2:p31" },
          { type: "Mechanic", name: "combat", description: "Combat mechanic", sourceRef: "adams:ch2:p31" },
        ],
        relations: [
          { from: "racing", to: "locomotion", type: "REQUIRES_MECHANIC", weight: 0.8, sourceRef: "adams:ch2:p31" },
          { from: "racing", to: "combat", type: "CONFLICTS_WITH", weight: 0.7, sourceRef: "adams:ch2:p31" },
        ],
      },
    ];

    const result = mergeOntology(extractions);

    // 3 unique entities: locomotion, racing, combat
    expect(result.entities).toHaveLength(3);

    // locomotion should be mentioned in 2 books
    const locomotion = result.entities.find((e) => e.name === "locomotion");
    expect(locomotion).toBeDefined();
    expect(locomotion!.bookCount).toBe(2);
    expect(locomotion!.sourceRefs).toHaveLength(2);

    // racing→locomotion relation should be merged (1 relation, 2 books)
    const racingLocomotion = result.relations.find(
      (r) => r.relationType === "REQUIRES_MECHANIC",
    );
    expect(racingLocomotion).toBeDefined();
    expect(racingLocomotion!.bookCount).toBe(2);

    // Stats
    expect(result.stats.rawEntities).toBe(4); // 2+2
    expect(result.stats.mergedEntities).toBe(3); // 3 unique
    expect(result.stats.multiBookEntities).toBe(1); // locomotion
    expect(result.stats.multiBookRelations).toBe(1); // racing→locomotion
  });

  it("boosts weight for multi-book entities", () => {
    const extractions: ExtractionResult[] = [
      {
        entities: [
          { type: "Mechanic", name: "collect", description: "Pickup", sourceRef: "book1:ch1:p1" },
        ],
        relations: [],
      },
      {
        entities: [
          { type: "Mechanic", name: "collect", description: "Gather items", sourceRef: "book2:ch1:p1" },
        ],
        relations: [],
      },
      {
        entities: [
          { type: "Mechanic", name: "collect", description: "Collect resources", sourceRef: "book3:ch1:p1" },
        ],
        relations: [],
      },
    ];

    const result = mergeOntology(extractions);
    const collect = result.entities.find((e) => e.name === "collect");
    expect(collect).toBeDefined();
    expect(collect!.bookCount).toBe(3);
    // Weight should be boosted: base 0.7 + 0.05*2 (two extra mentions) + 0.1*2 (multi-book boost)
    expect(collect!.weight).toBeGreaterThan(0.7);
  });

  it("filters out hallucinated relations (entities not in map)", () => {
    const extractions: ExtractionResult[] = [
      {
        entities: [
          { type: "Mechanic", name: "locomotion", description: "Movement", sourceRef: "book1:ch1:p1" },
        ],
        relations: [
          // "nonexistent" is not in entities → should be filtered
          { from: "locomotion", to: "nonexistent", type: "PRODUCES_DYNAMIC", weight: 0.8, sourceRef: "book1:ch1:p1" },
        ],
      },
    ];

    const result = mergeOntology(extractions);
    expect(result.relations).toHaveLength(0);
  });

  it("filters out self-relations", () => {
    const extractions: ExtractionResult[] = [
      {
        entities: [
          { type: "Mechanic", name: "combat", description: "Combat", sourceRef: "book1:ch1:p1" },
        ],
        relations: [
          { from: "combat", to: "combat", type: "SYNERGIZES_WITH", weight: 0.8, sourceRef: "book1:ch1:p1" },
        ],
      },
    ];

    const result = mergeOntology(extractions);
    expect(result.relations).toHaveLength(0);
  });

  it("keeps the longer description when merging", () => {
    const extractions: ExtractionResult[] = [
      {
        entities: [
          { type: "Mechanic", name: "jump", description: "Short", sourceRef: "book1:ch1:p1" },
        ],
        relations: [],
      },
      {
        entities: [
          { type: "Mechanic", name: "jump", description: "A longer and more detailed description of jumping", sourceRef: "book2:ch1:p1" },
        ],
        relations: [],
      },
    ];

    const result = mergeOntology(extractions);
    const jump = result.entities.find((e) => e.name === "jump");
    expect(jump!.description).toBe("A longer and more detailed description of jumping");
  });

  it("handles empty extractions", () => {
    const result = mergeOntology([]);
    expect(result.entities).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
    expect(result.stats.totalExtractions).toBe(0);
  });
});

// ============================================================
// Extractor tests (need pdftotext)
// ============================================================

describe("extractPdfToText", () => {
  it("throws for non-existent file", () => {
    expect(() => extractPdfToText("/nonexistent/file.pdf", "/tmp")).toThrow();
  });

  it("uses cache when available", () => {
    // This tests the cache path — if .txt exists, it reads it
    const cacheDir = join(TEST_DIR, "cache-test");
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

    // Create a fake cache file
    const bookId = "fake-book";
    const cachePath = join(cacheDir, `${bookId}.txt`);
    writeFileSync(cachePath, "This is cached text from a book about game design.");

    const result = extractPdfToText("fake-book.pdf", cacheDir, true);
    expect(result.bookId).toBe(bookId);
    expect(result.totalText).toContain("cached text");
  });
});
