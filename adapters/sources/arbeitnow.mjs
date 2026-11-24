import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.arbeitnow.com"];

export function normalizarArbeitnow(vaga) {
  if (!vaga || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsNoHost(vaga.url, HOSTS);
  if (!url) return null;
  const base = typeof vaga.location === "string" ? vaga.location.trim() : "";
  return {
    native_id: vaga.slug ? String(vaga.slug) : null,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.company_name === "string" && vaga.company_name.trim() ? vaga.company_name.trim() : "Arbeitnow",
    location: [base, vaga.remote === true ? "Remote" : ""].filter(Boolean).join(", "),
    remote: vaga.remote === true,
    description: limitar(vaga.description),
    posted_at: paraIso(vaga.created_at),
    raw: vaga,
  };
}

export default {
  id: "arbeitnow",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const max = Math.min(Number(params.max_pages ?? 1) || 1, 3);
    const listings = [];
    const errors = [];
    for (let pagina = 1; pagina <= max; pagina += 1) {
      if (pagina > 1) await pausa(ctx, 200);
      try {
        const json = await buscarJson(`https://www.arbeitnow.com/api/job-board-api?page=${pagina}`, HOSTS, ctx);
        if (!json || !Array.isArray(json.data)) throw new Error("arbeitnow: resposta sem data");
        listings.push(...json.data);
        if (json.data.length < 100) break;
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    return { listings, errors };
  },
  normalize: normalizarArbeitnow,
};
