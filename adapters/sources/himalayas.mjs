import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["himalayas.app"];
const FEED = "https://himalayas.app/jobs/api?limit=20";
const BUSCA = "https://himalayas.app/jobs/api/search";

const REGIAO = /(?:^|[^a-z])(?:portugal|worldwide|anywhere|global|europe|european union|eu|eea|emea)(?:[^a-z]|$)/i;

export function abertaPortugalUeMundo(vaga) {
  const locais = Array.isArray(vaga?.locationRestrictions)
    ? vaga.locationRestrictions.filter((item) => typeof item === "string" && item.trim())
    : [];
  const texto = locais.join(" | ").toLowerCase();
  const portugal = locais.some((item) => item.trim().toLowerCase() === "portugal");
  if (locais.length > 0 && !portugal && !REGIAO.test(texto)) return false;
  const fusos = Array.isArray(vaga?.timezoneRestrictions) ? vaga.timezoneRestrictions : [];
  const numeros = fusos.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (numeros.length && !numeros.some((item) => item === 0 || item === -1)) return false;
  return true;
}

export function consultasHimalayas(params = {}) {
  const lista = Array.isArray(params.queries) ? params.queries : [];
  const saida = [];
  for (const item of lista) {
    const texto = String(item ?? "").trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .+-]{0,40}$/u.test(texto)) continue;
    if (saida.includes(texto)) continue;
    saida.push(texto);
    if (saida.length >= 4) break;
  }
  return saida;
}

function chaveHimalayas(vaga) {
  if (vaga?.guid) return String(vaga.guid);
  if (typeof vaga?.applicationLink === "string") return vaga.applicationLink;
  return "";
}

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
    const vistos = new Set(listings.map(chaveHimalayas).filter(Boolean));
    for (const consulta of consultasHimalayas(params)) {
      await pausa(ctx, 200);
      const url = new URL(BUSCA);
      url.searchParams.set("q", consulta);
      url.searchParams.set("sort", "recent");
      try {
        const json = await buscarJson(url.href, HOSTS, ctx);
        if (!json || !Array.isArray(json.jobs)) throw new Error(`himalayas: busca sem jobs (${consulta})`);
        for (const vaga of json.jobs) {
          if (!abertaPortugalUeMundo(vaga)) continue;
          const chave = chaveHimalayas(vaga);
          if (chave && vistos.has(chave)) continue;
          if (chave) vistos.add(chave);
          listings.push(vaga);
        }
      } catch (erro) {
        errors.push(erro.message);
      }
    }
    return { listings, errors };
  },
  normalize: normalizarHimalayas,
};
