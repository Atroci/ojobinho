import { buscarTexto } from "../../lib/careerops/http.mjs";
import { httpsNoHost, itensRss, limitar, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["weworkremotely.com"];

export function normalizarWwr(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const url = httpsNoHost(item.link ?? item.url, HOSTS);
  if (!url) return null;
  const texto = (item.title ?? item.rawTitle ?? "").trim();
  const doisPontos = texto.indexOf(":");
  let company = "We Work Remotely";
  let title = texto;
  if (doisPontos > 0) {
    const esquerda = texto.slice(0, doisPontos).trim();
    const direita = texto.slice(doisPontos + 1).trim();
    if (esquerda && direita) {
      company = esquerda;
      title = direita;
    }
  }
  return {
    native_id: null,
    url,
    title,
    company: item.company || company,
    location: item.location || "",
    remote: true,
    employment_type: tipoContrato(item.type),
    description: limitar(item.description),
    posted_at: paraIso(item.pubDate),
    raw: item,
  };
}

export default {
  id: "weworkremotely",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const xml = await buscarTexto("https://weworkremotely.com/remote-jobs.rss", HOSTS, ctx);
    return { listings: itensRss(xml), errors: [] };
  },
  normalize: normalizarWwr,
};
