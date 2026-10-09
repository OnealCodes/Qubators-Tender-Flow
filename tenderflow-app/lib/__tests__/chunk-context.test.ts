// Phase 2c foundations — chunk context + cache. Pure functions and temp-dir
// file roundtrips only: no database, no network, no live Gemini. Run: npm test.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROMPT_VERSION_V2, SCHEMA_VERSION_V2 } from "../ai-schemas";
import {
  chunkCacheKey,
  hashPages,
  readChunkCache,
  writeChunkCache,
} from "../chunk-cache";
import {
  buildChunkContext,
  buildDocumentMap,
  chunkBySection,
} from "../chunks";
import type { ParsedPage } from "../pdf";

function pages(...texts: string[]): ParsedPage[] {
  return texts.map((text, i) => ({ page_no: i + 1, text, char_count: text.length }));
}

function tenderFixture(): ParsedPage[] {
  return pages(
    "1.0 INTRODUCTION Project background and objectives.",
    "4.1 Mandatory Bid Content. Method statement. Failure to quote shall lead to disqualification.",
    "2.4 Design Basis. Contractor shall analyse all phases. Joint venture bidders shall state their design basis assumptions.",
    "4.2 Pricing Schedule. Group A lump sum. Bidders shall price against the stated assumption."
  );
}

describe("buildChunkContext", () => {
  it("includes outline, global rules and the chunk's full text", () => {
    const t = tenderFixture();
    const chunks = chunkBySection(t);
    const map = buildDocumentMap(t, chunks);
    const bid = chunks.find((c) => c.ref === "4.1")!;
    const ctx = buildChunkContext(map, bid);
    expect(ctx).toMatch(/DOCUMENT MAP/);
    expect(ctx).toMatch(/Mandatory Bid Content/);
    expect(ctx).toMatch(/\[disqualification\] p\.2/);
    expect(ctx).toMatch(/\[jv-partner\] p\.3/);
    expect(ctx).toMatch(/THIS CHUNK/);
    expect(ctx).toMatch(/Method statement/);
  });

  it("marks the current chunk in the outline", () => {
    const t = tenderFixture();
    const chunks = chunkBySection(t);
    const map = buildDocumentMap(t, chunks);
    for (const c of chunks) {
      const ctx = buildChunkContext(map, c);
      expect(ctx).toMatch(new RegExp(`\\(${c.id}\\)|${c.id}.*THIS CHUNK|THIS CHUNK`));
    }
  });

  it("lists flagged passages for flagged scope chunks", () => {
    const t = tenderFixture();
    const chunks = chunkBySection(t);
    const map = buildDocumentMap(t, chunks);
    const scope = chunks.find((c) => c.ref === "2.4")!;
    const zone = map.zones.find((z) => z.chunkId === scope.id)!;
    expect(zone.hasBidClause).toBe(true);
    const ctx = buildChunkContext(map, scope);
    expect(ctx).toMatch(/Flagged bid-stage passages/);
  });

  it("is deterministic for the same inputs", () => {
    const t = tenderFixture();
    const chunks = chunkBySection(t);
    const map = buildDocumentMap(t, chunks);
    expect(buildChunkContext(map, chunks[0])).toBe(buildChunkContext(map, chunks[0]));
  });

  it("caps a huge outline with an omission note", () => {
    const t = tenderFixture();
    const chunks = chunkBySection(t);
    const map = buildDocumentMap(t, chunks);
    const big = {
      ...map,
      outline: Array.from({ length: 200 }, (_, i) => ({
        ref: `9.${i}`,
        title: `Section ${i}`,
        page: 1,
        chunkId: chunks[0].id,
      })),
    };
    const ctx = buildChunkContext(big, chunks[0]);
    expect(ctx).toMatch(/more outline entries omitted/);
  });
});

describe("hashPages", () => {
  it("is deterministic and content-sensitive", () => {
    const a = pages("hello world, enough words here", "second page of tender text here");
    expect(hashPages(a)).toBe(hashPages(a));
    expect(hashPages(a)).toMatch(/^[0-9a-f]{64}$/);
    const b = pages("hello world, enough words here!", "second page of tender text here");
    expect(hashPages(b)).not.toBe(hashPages(a));
  });
});

describe("chunkCacheKey", () => {
  const base = {
    tenderHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    promptVersion: PROMPT_VERSION_V2,
    schemaVersion: SCHEMA_VERSION_V2,
    chunkId: "c3",
  };

  it("is deterministic for the same parts", () => {
    expect(chunkCacheKey(base)).toBe(chunkCacheKey({ ...base }));
  });

  it("changes when prompt or schema version changes", () => {
    expect(chunkCacheKey({ ...base, promptVersion: "extract-prompt/v3" })).not.toBe(chunkCacheKey(base));
    expect(chunkCacheKey({ ...base, schemaVersion: "extract/v3" })).not.toBe(chunkCacheKey(base));
  });

  it("changes per tender hash and chunk id", () => {
    expect(chunkCacheKey({ ...base, tenderHash: "0".repeat(64) })).not.toBe(chunkCacheKey(base));
    expect(chunkCacheKey({ ...base, chunkId: "c4" })).not.toBe(chunkCacheKey(base));
  });

  it("embeds versions and chunk id in plain text", () => {
    const key = chunkCacheKey(base);
    expect(key).toMatch(/c3\.json$/);
    expect(key).toContain("extract-prompt_v2");
    expect(key).toContain("extract_v2");
  });
});

describe("chunk cache file roundtrip", () => {
  function tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "tf-chunk-cache-"));
  }

  it("writes then reads back a value", () => {
    const dir = tmpDir();
    const key = chunkCacheKey({
      tenderHash: "a".repeat(64),
      promptVersion: PROMPT_VERSION_V2,
      schemaVersion: SCHEMA_VERSION_V2,
      chunkId: "c1",
    });
    expect(readChunkCache(dir, key)).toBeNull();
    writeChunkCache(dir, key, { rows: [{ title: "Method statement" }] });
    expect(readChunkCache<{ rows: { title: string }[] }>(dir, key)).toEqual({
      rows: [{ title: "Method statement" }],
    });
  });

  it("returns null for corrupt entries instead of throwing", () => {
    const dir = tmpDir();
    const key = "broken.json";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, key), "{not json", "utf8");
    expect(readChunkCache(dir, key)).toBeNull();
  });

  it("overwrites prior entries", () => {
    const dir = tmpDir();
    const key = "k.json";
    writeChunkCache(dir, key, { v: 1 });
    writeChunkCache(dir, key, { v: 2 });
    expect(readChunkCache<{ v: number }>(dir, key)).toEqual({ v: 2 });
  });
});
