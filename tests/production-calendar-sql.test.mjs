import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("all calendar queries execute against the joined orders and production schema", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const directory = new URL("../drizzle/", import.meta.url);
    for (const file of readdirSync(directory).filter(f => f.endsWith(".sql")).sort()) {
      const migration = readFileSync(new URL(file, directory), "utf8");
      for (const match of migration.matchAll(/(?:CREATE TABLE [\s\S]*?;|CREATE (?:UNIQUE )?INDEX [\s\S]*?;|ALTER TABLE [\s\S]*?;)/g)) db.exec(match[0]);
    }
    const source = readFileSync(new URL("../app/admin/production/calendar/page.tsx", import.meta.url), "utf8");
    const queries = [...source.matchAll(/database\.prepare\(`([\s\S]*?)`\)/g)];
    assert.equal(queries.length, 3);
    for (const [, sql] of queries) {
      const dates = Array((sql.match(/\?/g) || []).length).fill("2026-09-15");
      assert.deepEqual(db.prepare(sql).all(...dates), []);
    }
  } finally { db.close(); }
});
