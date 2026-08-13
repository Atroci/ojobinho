import { obterJson, validarSlug, validarUrlHttps } from "./transport.mjs";

const INSTANCES = {
  global: { apiHost: "api.lever.co", jobHost: "jobs.lever.co" },
  eu: { apiHost: "api.eu.lever.co", jobHost: "jobs.eu.lever.co" },
};

function erroPayload() {
  return new TypeError("Payload Lever malformado.");
}

function normalizarVaga(vaga, site, jobHost, sourceUrl, capturedAt) {
  if (
    !vaga ||
    typeof vaga !== "object" ||
    typeof vaga.id !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(vaga.id) ||
    typeof vaga.text !== "string" ||
    !vaga.text.trim() ||
    typeof vaga.descriptionPlain !== "string" ||
    !vaga.categories ||
    typeof vaga.categories !== "object" ||
    typeof vaga.categories.location !== "string" ||
    !vaga.categories.location.trim()
  ) {
    throw erroPayload();
  }

  const url = validarUrlHttps(vaga.hostedUrl, [jobHost], "URL da vaga Lever");
  if ((url.pathname.split("/")[1] ?? "") !== site) throw erroPayload();

  return {
    id: `lever:${vaga.id}`,
    providerId: vaga.id,
    source: "lever",
    sourceUrl,
    capturedAt,
    title: vaga.text.trim(),
    location: vaga.categories.location.trim(),
    description: vaga.descriptionPlain,
    url: url.href,
  };
}

export async function buscarVagasLever(siteInformado, options = {}) {
  const site = validarSlug(siteInformado, "Site Lever");
  const instance = INSTANCES[options.instance ?? "global"];
  if (!instance) throw new TypeError("Instância Lever inválida.");
  const endpoint = new URL(`/v0/postings/${site}`, `https://${instance.apiHost}`);
  endpoint.searchParams.set("mode", "json");
  const payload = await obterJson(endpoint, {
    hostsPermitidos: [instance.apiHost],
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes,
  });

  if (!Array.isArray(payload)) throw erroPayload();
  const agora = options.now ? options.now() : new Date();
  if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) throw new TypeError("Data de captura inválida.");
  const capturedAt = agora.toISOString();
  return payload.map((vaga) => normalizarVaga(vaga, site, instance.jobHost, endpoint.href, capturedAt));
}
