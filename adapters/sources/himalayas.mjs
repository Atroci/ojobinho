import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["himalayas.app"];
const FEED = "https://himalayas.app/jobs/api?limit=20";

export function normalizarHimalayas(vaga) {
  if (!vaga || typeof vaga !== "object" || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsNoHost(vaga.applicationLink, HOSTS) || httpsNoHost(vaga.guid, HOSTS);
  if (!url) return null;
  const locais = Array.isArray(vaga.locationRestrictions) ? vaga.locationRestrictions.filter((item) => typeof item === "string" && item.trim()) : [];
  return {
    native_id: vaga.guid ? String(vaga.guid) : null,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.companyName === "string" ? vaga.companyName.trim() : "",
    location: locais.length ? locais.map((item) => item.trim()).join(", ") : "Remote (worldwide)",
    remote: true,
    employment_type: tipoContrato(vaga.employmentType),
    posted_at: paraIso(vaga.pubDate),
    description: "",
    raw: vaga,
  };
}

export default {
  id: "himalayas",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const max = Math.min(Number(params.max_pages ?? 2) || 2, 10);
    const listings = [];
    const errors = [];
    let cursor = null;
    for (let pagina = 0; pagina < max; pagina += 1) {
      if (pagina > 0) await pausa(ctx, 200);
      const url = new URL(FEED);
      if (cursor) url.searchParams.set("cursor", cursor);
      try {
        const json = await buscarJson(url.href, HOSTS, ctx);
        if (!json || !Array.isArray(json.jobs)) throw new Error("himalayas: resposta sem jobs");
        listings.push(...json.jobs);
        if (!json.nextCursor || typeof json.nextCursor !== "string") break;
        cursor = json.nextCursor;
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    return { listings, errors };
  },
  normalize: normalizarHimalayas,
};
