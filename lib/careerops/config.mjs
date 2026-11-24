import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function lerJson(caminho, fallback = null) {
  try {
    return JSON.parse(await readFile(caminho, "utf8"));
  } catch (erro) {
    if (erro.code === "ENOENT" && fallback !== null) return fallback;
    if (erro instanceof SyntaxError) throw new Error(`${caminho} contém JSON inválido.`);
    throw erro;
  }
}

export async function carregarFontes(base) {
  const publicado = await lerJson(resolve(base, "config/careerops.sources.json"), { sources: [] });
  const local = await lerJson(resolve(base, "config/careerops.local.json"), { sources: [] });
  let privadas = [];
  try {
    const fontes = await lerJson(resolve(base, "config/fontes.json"), {});
    if (Array.isArray(fontes.careerops)) privadas = fontes.careerops;
  } catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
  }
  const porId = new Map();
  for (const fonte of [...(publicado.sources ?? []), ...privadas, ...(local.sources ?? [])]) {
    if (!fonte || typeof fonte.id !== "string" || typeof fonte.adapter !== "string") {
      throw new TypeError("Fonte CareerOps sem id ou adapter.");
    }
    porId.set(fonte.id, {
      id: fonte.id,
      adapter: fonte.adapter,
      enabled: fonte.enabled !== false,
      profile: fonte.profile ?? ["emprego"],
      params: fonte.params ?? {},
    });
  }
  return [...porId.values()];
}

export async function carregarAgenda(base) {
  const baseAgenda = await lerJson(resolve(base, "config/agenda.json"));
  const local = await lerJson(resolve(base, "data/agenda.local.json"), { sources: {} });
  return {
    ...baseAgenda,
    sources: { ...(baseAgenda.sources ?? {}), ...(local.sources ?? {}) },
  };
}

export async function carregarRegras(base) {
  try {
    return JSON.parse(await readFile(resolve(base, "config/regras.json"), "utf8"));
  } catch (erro) {
    if (erro.code !== "ENOENT") {
      if (erro instanceof SyntaxError) throw new Error("config/regras.json contém JSON inválido.");
      throw erro;
    }
  }
  return lerJson(resolve(base, "config/regras.example.json"), { emprego: {}, freelance: {} });
}

export async function carregarCapacidades(base) {
  return lerJson(resolve(base, "config/source-capabilities.json"));
}

export function coletaPermitida(capacidade) {
  return capacidade?.access_policy === "approved" && capacidade?.discovery === "yes";
}
