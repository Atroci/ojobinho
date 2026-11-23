import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsNoHost, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["apply.remote.com"];

export function normalizarRemoteCom(vaga) {
  if (!vaga || typeof vaga.title !== "string" || !vaga.title.trim() || !vaga.public_id) return null;
  const url = httpsNoHost(`https://apply.remote.com/jobs/${vaga.public_id}`, HOSTS);
  if (!url) return null;
  const location = [vaga.location, vaga.workplace].filter((item) => typeof item === "string" && item.trim()).join(", ");
  return {
    native_id: String(vaga.public_id),
    url,
    title: vaga.title.trim(),
    company: "Remote",
    location,
    remote: /remote/i.test(String(vaga.workplace ?? vaga.location ?? "")),
    employment_type: tipoContrato(vaga.employment_type),
    posted_at: paraIso(vaga.opened_at),
    description: "",
    raw: vaga,
  };
}

export default {
  id: "remote-com",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const json = await buscarJson("https://apply.remote.com/api/public/jobs", HOSTS, ctx);
    if (!json || !Array.isArray(json.jobs)) throw new Error("remote-com: resposta sem jobs");
    return { listings: json.jobs, errors: [] };
  },
  normalize: normalizarRemoteCom,
};
