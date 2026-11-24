import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsAbsoluto, limitar, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["remotive.com"];

export function normalizarRemotive(vaga) {
  if (!vaga || typeof vaga !== "object" || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsAbsoluto(vaga.url);
  if (!url) return null;
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.company_name === "string" && vaga.company_name.trim() ? vaga.company_name.trim() : "Remotive",
    location: typeof vaga.candidate_required_location === "string" ? vaga.candidate_required_location.trim() : "",
    remote: true,
    employment_type: tipoContrato(vaga.job_type),
    description: limitar(vaga.description),
    posted_at: paraIso(vaga.publication_date),
    raw: vaga,
  };
}

export default {
  id: "remotive",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const json = await buscarJson("https://remotive.com/api/remote-jobs", HOSTS, ctx);
    if (!json || !Array.isArray(json.jobs)) throw new Error("remotive: resposta sem jobs");
    return { listings: json.jobs, errors: [] };
  },
  normalize: normalizarRemotive,
};
