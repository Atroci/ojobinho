import { buscarJson } from "../../lib/careerops/http.mjs";

const HOSTS = ["www.getmanfred.com"];

function moeda(valor) {
  if (typeof valor !== "string") return "";
  const limpo = valor.replace(/\s/g, "").toUpperCase();
  if (limpo === "€") return "EUR";
  if (limpo === "$" || limpo === "US$") return "USD";
  return /^[A-Z]{3}$/.test(limpo) ? limpo : "";
}

export function normalizarManfred(oferta) {
  if (!oferta || oferta.status !== "ACTIVE" || typeof oferta.position !== "string" || !oferta.position.trim()) return null;
  const id = Number(oferta.id);
  const slug = typeof oferta.slug === "string" ? oferta.slug.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !slug) return null;
  let encoded;
  try {
    encoded = encodeURIComponent(slug);
  } catch {
    return null;
  }
  const url = `https://www.getmanfred.com/ofertas-empleo/${id}/${encoded}`;
  const listed = Array.isArray(oferta.locations) ? oferta.locations.filter((item) => typeof item === "string" && item.trim()) : [];
  let location = listed.join(", ");
  if (!location) {
    const remoto = Number(oferta.remotePercentage);
    if (remoto >= 100) location = "Remote";
    else if (remoto > 0) location = "Hybrid";
  }
  const de = Number(oferta.salaryFrom);
  const ate = Number(oferta.salaryTo);
  const temDe = Number.isFinite(de) && de > 0;
  const temAte = Number.isFinite(ate) && ate > 0;
  return {
    native_id: String(id),
    url,
    title: oferta.position.trim(),
    company: typeof oferta.company?.name === "string" && oferta.company.name.trim() ? oferta.company.name.trim() : "getManfred",
    location,
    remote: location === "Remote",
    pay_min: temDe || temAte ? (temDe ? de : ate) : null,
    pay_max: temDe || temAte ? (temAte ? ate : de) : null,
    pay_currency: moeda(oferta.currency) || null,
    pay_period: temDe || temAte ? "year" : null,
    posted_at: null,
    description: "",
    raw: oferta,
  };
}

export function urlManfred(params = {}) {
  const lang = String(params.lang ?? "ES").trim().toUpperCase();
  if (lang !== "EN" && lang !== "ES") throw new Error("manfred: lang deve ser EN ou ES");
  return `https://www.getmanfred.com/api/v2/public/offers?lang=${lang}`;
}

export default {
  id: "manfred",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const json = await buscarJson(urlManfred(params), HOSTS, ctx);
    if (!Array.isArray(json)) throw new Error("manfred: resposta não é uma lista");
    return { listings: json, errors: [] };
  },
  normalize: normalizarManfred,
};
