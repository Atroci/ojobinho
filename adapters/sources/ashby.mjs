import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsNoHost, limitar, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["api.ashbyhq.com", "jobs.ashbyhq.com"];
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

export function normalizarAshby(vaga) {
  if (!vaga || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsNoHost(vaga.jobUrl ?? vaga.url, ["jobs.ashbyhq.com"]);
  if (!url) return null;
  const location = typeof vaga.location === "string" ? vaga.location.trim() : "";
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: vaga.title.trim(),
    company: vaga.company || "",
    location,
    remote: vaga.isRemote === true || /remote/i.test(vaga.workplaceType || location),
    employment_type: tipoContrato(vaga.employmentType),
    description: limitar(vaga.descriptionPlain || vaga.descriptionHtml),
    posted_at: paraIso(vaga.publishedAt),
    raw: vaga,
  };
}

export default {
  id: "ashby",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    if (!SLUG.test(params.board ?? "")) throw new Error("ashby: informe params.board");
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(params.board)}?includeCompensation=true`;
    const json = await buscarJson(url, ["api.ashbyhq.com"], ctx);
    if (!json || !Array.isArray(json.jobs)) throw new Error("ashby: resposta sem jobs");
    return { listings: json.jobs.map((vaga) => ({ ...vaga, company: params.company || params.board })), errors: [] };
  },
  normalize: normalizarAshby,
};
