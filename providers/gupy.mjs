import { obterHtml, validarSlug } from "./transport.mjs";

function erroPayload() {
  return new TypeError("Payload Gupy malformado.");
}

function normalizarLocal(workplace) {
  if (!workplace || typeof workplace !== "object") return "Não informado";
  const address = workplace.address && typeof workplace.address === "object" ? workplace.address : {};
  const local = [address.city, address.stateShortName, address.country].filter(Boolean).join(" / ");
  return local || workplace.workplaceType || "Não informado";
}

function normalizarVaga(vaga, tenant, sourceUrl, capturedAt) {
  if (!vaga || typeof vaga !== "object" || !Number.isSafeInteger(vaga.id) || vaga.id <= 0 || typeof vaga.title !== "string" || !vaga.title.trim()) {
    throw erroPayload();
  }
  const providerId = String(vaga.id);
  const department = typeof vaga.department === "string" ? vaga.department.trim() : "";
  return {
    id: `gupy:${providerId}`,
    providerId,
    source: "gupy",
    sourceUrl,
    capturedAt,
    title: vaga.title.trim(),
    location: normalizarLocal(vaga.workplace),
    description: department,
    contract: typeof vaga.type === "string" ? vaga.type : "",
    workplaceType: typeof vaga.workplace?.workplaceType === "string" ? vaga.workplace.workplaceType : "",
    url: `https://${tenant}.gupy.io/jobs/${providerId}`,
  };
}

export async function buscarVagasGupy(tenantInformado, options = {}) {
  const tenant = validarSlug(tenantInformado, "Tenant Gupy");
  if (tenant.includes("_")) throw new TypeError("Tenant Gupy inválido.");
  const host = `${tenant}.gupy.io`;
  const sourceUrl = `https://${host}/`;
  const html = await obterHtml(sourceUrl, {
    hostsPermitidos: [host],
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes ?? 5_000_000,
  });
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw erroPayload();
  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    throw erroPayload();
  }
  const jobs = payload?.props?.pageProps?.jobs;
  if (!Array.isArray(jobs)) throw erroPayload();
  const agora = options.now ? options.now() : new Date();
  if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) throw new TypeError("Data de captura inválida.");
  return jobs.map((vaga) => normalizarVaga(vaga, tenant, sourceUrl, agora.toISOString()));
}
