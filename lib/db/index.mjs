import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = readFileSync(fileURLToPath(new URL("./schema.sql", import.meta.url)), "utf8");

export const DB_RELATIVE = "data/ojobinho.db";

export function caminhoBanco(base = process.cwd()) {
  return resolve(base, DB_RELATIVE);
}

export function abrirBanco(base = process.cwd(), { memory = false } = {}) {
  const caminho = memory ? ":memory:" : caminhoBanco(base);
  if (!memory) mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec(SCHEMA);
  return db;
}

export function fecharBanco(db) {
  db.close();
}
