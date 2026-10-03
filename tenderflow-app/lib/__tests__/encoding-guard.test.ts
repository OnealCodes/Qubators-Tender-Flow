// Encoding guard - fails if any source file under lib, app or scripts
// contains UTF-8 mojibake (double-encoded text from a file-encoding
// round-trip, e.g. commit 34d05bb's NUMBERED_RE corruption which silently
// dropped 4 Conductor chunk boundaries). Patterns use unicode escapes so
// this file itself stays pure ASCII. Run: npm test.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["lib", "app", "scripts"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".css"]);

// U+00E2 followed by U+20AC/U+2030 (double-encoded UTF-8 punctuation,
// e.g. an em-dash showing as three glyphs), lone U+00C3 / U+00C2, U+0393,
// U+FFFD.
const MOJIBAKE_RES = [
  /\u00e2[\u20ac\u2030]/,
  /\u00c3/,
  /\u00c2/,
  /\u0393/,
  /\ufffd/,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      out.push(...sourceFiles(p));
    } else if (SOURCE_EXT.has(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

describe("encoding guard - no mojibake in source", () => {
  it("lib, app and scripts contain no mojibake sequences", () => {
    const bad: string[] = [];
    for (const root of ROOTS) {
      const base = path.resolve(process.cwd(), root);
      for (const f of sourceFiles(base)) {
        const text = fs.readFileSync(f, "utf8");
        const lines = text.split("\n");
        lines.forEach((line, i) => {
          for (const re of MOJIBAKE_RES) {
            if (re.test(line)) {
              bad.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
              break;
            }
          }
        });
      }
    }
    expect(bad, `mojibake found:\n${bad.join("\n")}`).toEqual([]);
  });
});
