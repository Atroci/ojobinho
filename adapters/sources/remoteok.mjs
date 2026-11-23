import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsAbsoluto, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["remoteok.com"];

export function normalizarRemoteOk(vaga) {
  if (!vaga || typeof vaga !== "object" || typeof vaga.position !== "string" || !vaga.position.trim()) return null;
  const url = httpsAbsoluto(vaga.url);
  if (!url) return null;
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: vaga.position.trim(),
    company: typeof vaga.company === "string" && vaga.company.trim() ? vaga.company.trim() : "RemoteOK",
    location: typeof vaga.location === "string" ? vaga.location.trim() : "",
    remote: true,
    description: limitar(vaga.description),
    posted_at: paraIso(vaga.date),
    raw: vaga,
  };
}

export default {
  id: "remoteok",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const data = await buscarJson("https://remoteok.com/api", HOSTS, ctx);
    if (!Array.isArray(data)) throw new Error("remoteok: resposta não é uma lista");
    return { listings: data, errors: [] };
  },
  normalize: normalizarRemoteOk,
};
