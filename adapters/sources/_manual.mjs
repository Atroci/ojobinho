import { httpsAbsoluto } from "../../lib/careerops/text.mjs";

export function normalizarManual(vaga) {
  if (!vaga || typeof vaga !== "object") return null;
  const title = typeof vaga.title === "string" ? vaga.title.trim() : "";
  const url = httpsAbsoluto(vaga.url);
  if (!title || !url) return null;
  const orcamento = vaga.budget && typeof vaga.budget === "object" ? vaga.budget : {};
  return {
    native_id: vaga.native_id != null ? String(vaga.native_id) : (vaga.id != null ? String(vaga.id) : null),
    url,
    title,
    company: typeof vaga.company === "string" ? vaga.company : (typeof vaga.client?.name === "string" ? vaga.client.name : ""),
    location: typeof vaga.location === "string" ? vaga.location : (vaga.client?.country ?? ""),
    remote: vaga.remote !== false,
    employment_type: vaga.employment_type ?? "freelance",
    pay_min: vaga.pay_min ?? orcamento.min ?? null,
    pay_max: vaga.pay_max ?? orcamento.max ?? null,
    pay_currency: vaga.pay_currency ?? orcamento.currency ?? null,
    pay_period: vaga.pay_period ?? orcamento.type ?? null,
    posted_at: vaga.posted_at ?? null,
    description: typeof vaga.description === "string" ? vaga.description : "",
    proposals: Number.isInteger(vaga.proposals) ? vaga.proposals : null,
    raw: vaga,
  };
}

export function adaptadorManual(id) {
  return {
    id,
    profile: ["freelance"],
    hosts: [],
    async fetch() {
      throw new Error(`${id}: esta fonte não é varrida; use ingerir com um JSON local`);
    },
    normalize: normalizarManual,
  };
}
