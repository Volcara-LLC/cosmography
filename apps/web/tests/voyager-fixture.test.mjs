import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedSha256 = "d5fb20227607ff652e109977a068f28aff0a13cf8bf1cbc55a8bf40cfdca1252";
const fixtureUrl = new URL(
  "./fixtures/horizons/voyager-1-vectors-2026-07-19.txt",
  import.meta.url,
);

test("pins the exact Voyager 1 Horizons response used by the experience", async () => {
  const fixture = await readFile(fixtureUrl);
  const text = fixture.toString("utf8");

  assert.equal(fixture.byteLength, 8_983);
  assert.equal(createHash("sha256").update(fixture).digest("hex"), expectedSha256);
  assert.match(text, /API VERSION:\s+1\.2/);
  assert.match(text, /\$\$SOE[\s\S]*2461240\.500000000[\s\S]*\$\$EOE/);
  assert.match(text, /5191\s+PRA\s+01-JAN-1981 03:52:18/);

  const source = await readFile(
    new URL("../app/data/missions/voyager-1.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, new RegExp(expectedSha256));
  assert.match(source, /apiVersion:\s*"1\.2"/);
  assert.match(source, /byteLength:\s*8_?983/);
});
