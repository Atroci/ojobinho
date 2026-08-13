import { obterJson, validarSlug, validarUrlHttps } from "./transport.mjs";

const API_HOST = "boards-api.greenhouse.io";
const JOB_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"];

function erroPayload() {
  return new TypeError("Payload Greenhouse malformado.");
}

function normalizarVaga(vaga, board, sourceUrl, capturedAt) {
  if (
    !vaga ||
    typeof vaga !== "object" ||
    !Number.isSafeInteger(vaga.id) ||
    vaga.id <= 0 ||
    typeof vaga.title !== "string" ||
    !vaga.title.trim() ||
    typeof vaga.content !== "string" ||
    !vaga.location ||
    typeof vaga.location !== "object" ||
    typeof vaga.location.name !== "string" ||
    !vaga.location.name.trim()
  ) {
    throw erroPayload();
  }

  const url = validarUrlHttps(vaga.absolute_url, JOB_HOSTS, "URL da vaga Greenhouse");
  if ((url.pathname.split("/")[1] ?? "") !== board) throw erroPayload();

  const providerId = String(vaga.id);
  return {
    id: `greenhouse:${providerId}`,
    providerId,
    source: "greenhouse",
    sourceUrl,
    capturedAt,
    title: vaga.title.trim(),
    location: vaga.location.name.trim(),
    description: vaga.content,
    url: url.href,
  };
}

export async function buscarVagasGreenhouse(boardInformado, options = {}) {
  const board = validarSlug(boardInformado, "Board Greenhouse");
  const endpoint = new URL(`/v1/boards/${board}/jobs`, `https://${API_HOST}`);
  endpoint.searchParams.set("content", "true");
  const payload = await obterJson(endpoint, {
    hostsPermitidos: [API_HOST],
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes,
  });

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.jobs)) throw erroPayload();
  const agora = options.now ? options.now() : new Date();
  if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) throw new TypeError("Data de captura inválida.");
  const capturedAt = agora.toISOString();
  return payload.jobs.map((vaga) => normalizarVaga(vaga, board, endpoint.href, capturedAt));
}
