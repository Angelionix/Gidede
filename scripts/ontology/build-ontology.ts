/**
 * CLI: Build ontology from raw books.
 *
 * Pipeline:
 * 1. Download books (if not present)
 * 2. Extract text from PDFs
 * 3. Chunk text
 * 4. LLM extraction (entities + relations)
 * 5. Merge & dedup
 * 6. Save to JSON (and optionally DB)
 *
 * Usage:
 *   bun run ontology:build              # full pipeline
 *   bun run ontology:build --books 5    # only first 5 books (cost optimization)
 *   bun run ontology:build --dry-run    # extract + chunk only, no LLM
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { extractAllPdfs, type ExtractedBook } from "../src/lib/ontology/extractor";
import { chunkAllBooks, type BookChunk } from "../src/lib/ontology/chunker";
import { extractFromChunks } from "../src/lib/ontology/llm-extractor";
import { mergeOntology, type MergedOntology } from "../src/lib/ontology/merger";
import type { ExtractionResult } from "../src/lib/ontology/types";

// ============================================================
// Config
// ============================================================

const BOOKS_DIR = join(process.cwd(), "docs", "books");
const TEXT_CACHE_DIR = join(process.cwd(), "docs", "ontology", "text-cache");
const EXTRACTION_CACHE_DIR = join(process.cwd(), "docs", "ontology", "extractions");
const OUTPUT_DIR = join(process.cwd(), "docs", "ontology");

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const maxBooks = parseInt(args.find((_, i) => args[i] === "--books" && i + 1 < args.length)?.[1] || "0") || 0;
  const dryRun = args.includes("--dry-run");
  const skipDownload = args.includes("--skip-download");

  console.log("============================================");
  console.log("Gidede Ontology Builder");
  console.log("============================================");
  console.log(`Books limit: ${maxBooks || "all"}`);
  console.log(`Dry run: ${dryRun}`);
  console.log("");

  // Step 0: Download books
  if (!skipDownload && !existsSync(BOOKS_DIR)) {
    console.log("[step 0] Downloading books...");
    const { execSync } = await import("child_process");
    execSync("bash scripts/ontology/download-books.sh", { stdio: "inherit" });
  }

  if (!existsSync(BOOKS_DIR)) {
    console.error("No books directory found. Run with download or place PDFs in docs/books/");
    process.exit(1);
  }

  // Step 1: Extract text from PDFs
  console.log("\n[step 1] Extracting text from PDFs...");
  mkdirSync(TEXT_CACHE_DIR, { recursive: true });
  let books = extractAllPdfs(BOOKS_DIR, TEXT_CACHE_DIR, true);

  if (maxBooks > 0 && books.length > maxBooks) {
    console.log(`  Limiting to first ${maxBooks} books (cost optimization)`);
    books = books.slice(0, maxBooks);
  }

  const totalWords = books.reduce((sum, b) => sum + b.wordCount, 0);
  console.log(`  Extracted: ${books.length} books, ${totalWords} words total`);

  // Step 2: Chunk text
  console.log("\n[step 2] Chunking text...");
  const chunks = chunkAllBooks(books);
  console.log(`  Created: ${chunks.length} chunks`);

  if (dryRun) {
    console.log("\n[dry-run] Saving chunks only (no LLM extraction)...");
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(
      join(OUTPUT_DIR, "chunks-preview.json"),
      JSON.stringify(chunks.slice(0, 5).map(c => ({
        id: c.id,
        bookId: c.bookId,
        chapter: c.chapter,
        page: c.page,
        tokenCount: c.tokenCount,
        textPreview: c.text.substring(0, 200) + "...",
      })), null, 2),
    );
    console.log("  Saved preview to docs/ontology/chunks-preview.json");
    console.log("\nDone (dry run).");
    return;
  }

  // Step 3: LLM extraction
  console.log("\n[step 3] LLM extraction...");
  console.log(`  Processing ${chunks.length} chunks...`);
  console.log("  (This will take a while. Estimated cost: ~$0.07-0.17/chunk)");

  // Check for cached extractions
  mkdirSync(EXTRACTION_CACHE_DIR, { recursive: true });
  const extractions: ExtractionResult[] = [];
  let processed = 0;
  let cached = 0;

  for (const chunk of chunks) {
    const cachePath = join(EXTRACTION_CACHE_DIR, `${chunk.id.replace(/:/g, "_")}.json`);

    // Check cache
    if (existsSync(cachePath)) {
      try {
        const cached = JSON.parse(readFileSync(cachePath, "utf-8")) as ExtractionResult;
        extractions.push(cached);
        cached++;
      } catch {
        // Cache corrupted, re-extract
      }
      processed++;
      if (processed % 10 === 0) {
        console.log(`  Progress: ${processed}/${chunks.length} (${cached} cached)`);
      }
      continue;
    }

    // LLM extraction
    const result = await extractFromChunk(chunk);
    if (result) {
      extractions.push(result);
      writeFileSync(cachePath, JSON.stringify(result, null, 2));
    }

    processed++;
    if (processed % 10 === 0) {
      console.log(`  Progress: ${processed}/${chunks.length} (${cached} cached)`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`  Extraction complete: ${extractions.length} results (${cached} from cache)`);

  // Step 4: Merge & dedup
  console.log("\n[step 4] Merging & deduplicating...");
  const merged = mergeOntology(extractions);
  console.log(`  Entities: ${merged.stats.mergedEntities} (from ${merged.stats.rawEntities} raw)`);
  console.log(`  Relations: ${merged.stats.mergedRelations} (from ${merged.stats.rawRelations} raw)`);
  console.log(`  Multi-book entities: ${merged.stats.multiBookEntities}`);
  console.log(`  Multi-book relations: ${merged.stats.multiBookRelations}`);

  // Step 5: Save
  console.log("\n[step 5] Saving ontology...");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const outputPath = join(OUTPUT_DIR, "raw-books-ontology.json");
  writeFileSync(outputPath, JSON.stringify({
    ...merged,
    stats: {
      ...merged.stats,
      booksProcessed: books.length,
      chunksProcessed: chunks.length,
      buildDate: new Date().toISOString(),
    },
  }, null, 2));

  console.log(`  Saved to: ${outputPath}`);
  console.log(`  File size: ${(writeFileSync.length || 0)} bytes`);

  // Print summary
  console.log("\n============================================");
  console.log("ONTOLOGY BUILD COMPLETE");
  console.log("============================================");
  console.log(`Books: ${books.length}`);
  console.log(`Chunks: ${chunks.length}`);
  console.log(`Extractions: ${extractions.length}`);
  console.log(`Entities: ${merged.stats.mergedEntities}`);
  console.log(`Relations: ${merged.stats.mergedRelations}`);
  console.log(`Multi-book entities: ${merged.stats.multiBookEntities}`);
  console.log(`Multi-book relations: ${merged.stats.multiBookRelations}`);
  console.log("============================================\n");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
