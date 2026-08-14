import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buscarVagasGreenhouse } from "../providers/greenhouse.mjs";
import { buscarVagasGupy } from "../providers/gupy.mjs";
import { buscarVagasLever } from "../providers/lever.mjs";

const PROVIDERS = {
  greenhouse: (fonte, options) => buscarVagasGreenhouse(fonte.id, options),
  gupy: (fonte, options) => buscarVagasGupy(fonte.id, options),
  lever: (fonte, options) => buscarVagasLever(fonte.id, { ...options, instance: fonte.instance }),
};

async function lerJsonLocal(baseDir, caminho, fallback) {
  const arquivo = resolve(baseDir, caminho);
  try {
    const item = await lstat(arquivo);
    if (item.isSymbolicLink() || !item.isFile()) throw new Error(`${caminho} deve ser arquivo regular.`);
    return JSON.parse(await readFile(arquivo, "utf8"));
  } catch (erro) {
    if (erro.code === "ENOENT" && fallback !== undefined) return fallback;
    if (erro instanceof SyntaxError) throw new Error(`${caminho} contém JSON inválido.`);
    throw erro;
  }
}

function validarFonte(fonte) {
  if (!fonte || typeof fonte !== "object" || !PROVIDERS[fonte.provider] || typeof fonte.id !== "string" || !fonte.id || typeof fonte.company !== "string" || !fonte.company.trim()) {
    throw new TypeError("Fonte inválida em config/fontes.json.");
  }
  if (fonte.instance && !["global", "eu"].includes(fonte.instance)) throw new TypeError("Instância Lever inválida em config/fontes.json.");
  return { ...fonte, company: fonte.company.trim(), key: `${fonte.provider}:${fonte.id}` };
}

async function salvarAtomico(caminho, valor) {
  await mkdir(dirname(caminho), { recursive: true });
  const diretorio = await lstat(dirname(caminho));
  if (diretorio.isSymbolicLink() || !diretorio.isDirectory()) throw new Error("data/ deve ser diretório regular.");
  const temporario = `${caminho}.${randomUUID()}.tmp`;
  await writeFile(temporario, `${JSON.stringify(valor, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporario, caminho);
}

export async function descobrir({ baseDir = process.cwd(), fetchImpl = globalThis.fetch, now = () => new Date(), dryRun = false } = {}) {
  const config = await lerJsonLocal(baseDir, "config/fontes.json");
  if (!Array.isArray(config?.fontes) || config.fontes.length === 0) throw new Error("config/fontes.json precisa conter ao menos uma fonte.");
  const fontes = config.fontes.map(validarFonte);
  const atuais = await lerJsonLocal(baseDir, "data/descobertas.json", []);
  if (!Array.isArray(atuais)) throw new Error("data/descobertas.json precisa conter uma lista.");
  const porId = new Map(atuais.map((vaga) => [vaga.discoveryId ?? `${vaga.sourceKey}:${vaga.providerId}`, vaga]));
  const erros = [];
  let encontradas = 0;
  let fontesOk = 0;

  for (const fonte of fontes) {
    let vagas;
    try {
      vagas = await PROVIDERS[fonte.provider](fonte, { fetchImpl, now });
    } catch (erro) {
      erros.push({ source: fonte.key, error: erro.message });
      continue;
    }
    fontesOk += 1;
    const idsAtivos = new Set(vagas.map((vaga) => `${fonte.key}:${vaga.providerId}`));
    const checkedAt = now().toISOString();
    for (const vaga of vagas) {
      const discoveryId = `${fonte.key}:${vaga.providerId}`;
      const anterior = porId.get(discoveryId);
      porId.set(discoveryId, {
        ...vaga,
        discoveryId,
        company: fonte.company,
        sourceKey: fonte.key,
        firstSeen: anterior?.firstSeen ?? vaga.capturedAt,
        lastSeen: vaga.capturedAt,
        lastCheckedAt: checkedAt,
        status: "ativa",
      });
      if (!anterior) encontradas += 1;
    }
    for (const [discoveryId, vaga] of porId) {
      if (vaga.sourceKey === fonte.key && vaga.status === "ativa" && !idsAtivos.has(discoveryId)) {
        porId.set(discoveryId, { ...vaga, lastCheckedAt: checkedAt, status: "indisponivel" });
      }
    }
  }

  const vagas = [...porId.values()].sort((a, b) => Number(b.status === "ativa") - Number(a.status === "ativa") || b.lastSeen.localeCompare(a.lastSeen));
  if (!dryRun) await salvarAtomico(resolve(baseDir, "data/descobertas.json"), vagas);
  return { vagas, encontradas, erros, fontes: fontes.length, fontesOk };
}
