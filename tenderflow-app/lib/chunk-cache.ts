// Phase 2c foundations: deterministic chunk-result cache.
// Key = tender content hash + prompt version + schema version (+ chunk id),
// so a prompt/contract change or a re-uploaded tender invalidates stale rows.
// File helpers take an explicit directory (later phases use
// uploads/<tender-id>/chunk-cache/; tests use a temp dir). No AI, no DB.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ParsedPage } from "./pdf";

export interface ChunkCacheKeyParts {
  /** Hex hash of the tender's parsed pages (see hashPages). */
  tenderHash: string;
  /** Prompt version, e.g. PROMPT_VERSION_V2 from lib/ai-schemas. */
  promptVersion: string;
  /** Schema version, e.g. SCHEMA_VERSION_V2 from lib/ai-schemas. */
  schemaVersion: string;
  /** Chunk id (c1, c2, ...) or "map" for tender-wide artefacts. */
  chunkId: string;
}

/** Stable content hash over parsed pages (page_no + text, in given order). */
export function hashPages(pages: ParsedPage[]): string {
  const h = createHash("sha256");
  for (const p of pages) {
    h.update(`${p.page_no}\n${p.text}\n`);
  }
  return h.digest("hex");
}

/** Deterministic cache key filename (safe chars only). */
export function chunkCacheKey(parts: ChunkCacheKeyParts): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return `${parts.tenderHash.slice(0, 16)}.${safe(parts.promptVersion)}.${safe(parts.schemaVersion)}.${safe(parts.chunkId)}.json`;
}

function keyPath(dir: string, key: string): string {
  return path.join(dir, key);
}

/** Read a cached value. Returns null on miss or unreadable/corrupt entry. */
export function readChunkCache<T>(dir: string, key: string): T | null {
  try {
    const raw = fs.readFileSync(keyPath(dir, key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write a cached value (creates the directory). Overwrites any prior entry. */
export function writeChunkCache(dir: string, key: string, value: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyPath(dir, key), JSON.stringify(value), "utf8");
}
