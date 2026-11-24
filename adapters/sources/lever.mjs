import { buscarVagasLever } from "../../providers/lever.mjs";

export function normalizarLever(vaga) {
  if (!vaga?.title || !vaga?.url) return null;
  return {
    native_id: vaga.providerId ?? null,
    url: vaga.url,
    title: vaga.title,
    company: vaga.company || "",
    location: vaga.location || "",
    description: vaga.description || "",
    remote: /remote|remoto/i.test(vaga.location || ""),
    raw: vaga,
  };
}

export default {
  id: "lever",
  profile: ["emprego"],
  hosts: ["api.lever.co", "api.eu.lever.co"],
  async fetch(params, ctx) {
    if (!params.site) throw new Error("lever: informe params.site");
    const vagas = await buscarVagasLever(params.site, {
      instance: params.instance,
      fetchImpl: ctx.fetchImpl,
      timeoutMs: ctx.timeoutMs,
      now: () => ctx.now ?? new Date(),
    });
    return { listings: vagas.map((vaga) => ({ ...vaga, company: params.company || params.site })), errors: [] };
  },
  normalize: normalizarLever,
};
