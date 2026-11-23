import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsAbsoluto, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.workingnomads.com", "workingnomads.com"];

export function normalizarWorkingNomads(vaga) {
  if (!vaga || typeof vaga !== "object" || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsAbsoluto(vaga.url);
  if (!url) return null;
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.company_name === "string" && vaga.company_name.trim() ? vaga.company_name.trim() : "Working Nomads",
    location: typeof vaga.location === "string" ? vaga.location.trim() : "",
    remote: true,
    description: limitar(vaga.description),
    posted_at: paraIso(vaga.pub_date),
    raw: vaga,
  };
}

export default {
  id: "workingnomads",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const data = await buscarJson("https://www.workingnomads.com/api/exposed_jobs/", HOSTS, ctx);
    if (!Array.isArray(data)) throw new Error("workingnomads: resposta não é uma lista");
    return { listings: data, errors: [] };
  },
  normalize: normalizarWorkingNomads,
};
