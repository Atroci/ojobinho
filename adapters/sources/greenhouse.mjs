import { buscarVagasGreenhouse } from "../../providers/greenhouse.mjs";

export function normalizarGreenhouse(vaga) {
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
  id: "greenhouse",
  profile: ["emprego"],
  hosts: ["boards-api.greenhouse.io"],
  async fetch(params, ctx) {
    if (!params.board) throw new Error("greenhouse: informe params.board");
    const vagas = await buscarVagasGreenhouse(params.board, {
      fetchImpl: ctx.fetchImpl,
      timeoutMs: ctx.timeoutMs,
      now: () => ctx.now ?? new Date(),
    });
    return { listings: vagas.map((vaga) => ({ ...vaga, company: params.company || params.board })), errors: [] };
  },
  normalize: normalizarGreenhouse,
};
