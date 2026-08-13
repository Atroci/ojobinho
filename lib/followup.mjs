import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CADENCIAS = {
  "candidatura-enviada": [5, 7],
  triagem: [3, 5],
  entrevista: [2, 5],
};

const EVENTOS = new Set([
  "candidatura-enviada",
  "triagem",
  "entrevista",
  "desafio",
  "follow-up",
  "proposta",
  "contratado",
  "reprovado",
  "desistido",
]);

function dataValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(valor)) {
    throw new Error("Informe uma data ISO válida.");
  }
  const data = new Date(valor);
  if (Number.isNaN(data.valueOf())) throw new Error("Informe uma data ISO válida.");
  if (valor.length === 10 && data.toISOString().slice(0, 10) !== valor) throw new Error("Informe uma data ISO válida.");
  return data;
}

function adicionarDiasUteis(valor, dias) {
  const data = dataValida(valor);
  for (let adicionados = 0; adicionados < dias; ) {
    data.setUTCDate(data.getUTCDate() + 1);
    if (![0, 6].includes(data.getUTCDay())) adicionados += 1;
  }
  return data.toISOString().slice(0, 10);
}

export function calcularProximoFollowUp({ status, dataReferencia, followUps = 0 }) {
  if (!EVENTOS.has(status)) throw new Error("Status de candidatura inválido.");
  dataValida(dataReferencia);
  if (!Number.isInteger(followUps) || followUps < 0) throw new Error("Quantidade de follow-ups inválida.");
  const cadencia = CADENCIAS[status];
  if (!cadencia || followUps >= cadencia.length) return null;
  return adicionarDiasUteis(dataReferencia, cadencia[followUps]);
}

export async function registrarEvento(idCandidatura, evento, base = process.cwd()) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(idCandidatura)) throw new Error("ID de candidatura inválido.");
  if (!EVENTOS.has(evento.status)) throw new Error("Status de candidatura inválido.");
  const data = dataValida(evento.data).toISOString();
  const observacao = String(evento.observacao ?? "").trim();
  if (observacao.length > 500) throw new Error("Observação deve ter até 500 caracteres.");

  const caminho = resolve(base, "data/history", `${idCandidatura}.jsonl`);
  await mkdir(dirname(caminho), { recursive: true });
  await appendFile(caminho, `${JSON.stringify({ data, status: evento.status, observacao })}\n`, "utf8");
  return caminho;
}
