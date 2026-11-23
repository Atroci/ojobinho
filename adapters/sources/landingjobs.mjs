import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsNoHost, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["landing.jobs"];

export function empresaDaUrl(url) {
  try {
    const partes = new URL(url).pathname.split("/").filter(Boolean);
    if (partes[0] !== "at" || !partes[1]) return "";
    return partes[1].replace(/[-_]+/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
  } catch {
    return "";
  }
}

export function normalizarLanding(vaga) {
  if (!vaga || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsNoHost(vaga.url, HOSTS);
  if (!url) return null;
  const primeiro = Array.isArray(vaga.locations) ? vaga.locations[0] ?? {} : {};
  const base = [primeiro.city, primeiro.country_code].filter((item) => typeof item === "string" && item.trim()).join(", ");
  const location = [base, vaga.remote === true ? "Remote" : ""].filter(Boolean).join(", ");
  const baixo = Number(vaga.gross_salary_low);
  const alto = Number(vaga.gross_salary_high);
  const temBaixo = Number.isFinite(baixo) && baixo >= 0;
  const temAlto = Number.isFinite(alto) && alto >= 0;
  const moeda = typeof vaga.currency_code === "string" ? vaga.currency_code.trim().toUpperCase() : "";
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: vaga.title.trim(),
    company: empresaDaUrl(url) || "Landing.jobs",
    location,
    remote: vaga.remote === true,
    pay_min: temBaixo || temAlto ? Math.min(temBaixo ? baixo : alto, temAlto ? alto : baixo) : null,
    pay_max: temBaixo || temAlto ? Math.max(temBaixo ? baixo : alto, temAlto ? alto : baixo) : null,
    pay_currency: moeda || null,
    pay_period: temBaixo || temAlto ? "year" : null,
    posted_at: paraIso(vaga.published_at) ?? paraIso(vaga.created_at),
    description: "",
    raw: vaga,
  };
}

export default {
  id: "landingjobs",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const json = await buscarJson("https://landing.jobs/api/v1/jobs", HOSTS, ctx);
    if (!Array.isArray(json)) throw new Error("landingjobs: resposta não é uma lista");
    return { listings: json, errors: [] };
  },
  normalize: normalizarLanding,
};
