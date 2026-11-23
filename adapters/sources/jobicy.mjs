import { buscarJson } from "../../lib/careerops/http.mjs";
import { decodificarEntidades, httpsNoHost, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["jobicy.com"];

export function normalizarJobicy(vaga) {
  if (!vaga || typeof vaga !== "object") return null;
  const title = typeof vaga.jobTitle === "string" ? decodificarEntidades(vaga.jobTitle).trim() : "";
  if (!title) return null;
  const url = httpsNoHost(vaga.url, HOSTS);
  if (!url) return null;
  const company = typeof vaga.companyName === "string" ? decodificarEntidades(vaga.companyName).trim() : "";
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title,
    company: company || "Jobicy",
    location: typeof vaga.jobGeo === "string" ? decodificarEntidades(vaga.jobGeo).trim() : "",
    remote: true,
    description: limitar(vaga.jobDescription),
    posted_at: paraIso(vaga.pubDate),
    raw: vaga,
  };
}

export default {
  id: "jobicy",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const json = await buscarJson("https://jobicy.com/api/v2/remote-jobs", HOSTS, ctx);
    if (!json || !Array.isArray(json.jobs)) throw new Error("jobicy: resposta sem jobs");
    return { listings: json.jobs, errors: [] };
  },
  normalize: normalizarJobicy,
};
