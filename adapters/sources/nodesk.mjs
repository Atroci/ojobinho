import { buscarTexto } from "../../lib/careerops/http.mjs";
import { decodificarEntidades, httpsNoHost, itensRss, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["nodesk.co"];

export function normalizarNodesk(item) {
  if (!item) return null;
  const url = httpsNoHost(item.link ?? item.url, HOSTS);
  if (!url) return null;
  const bruto = decodificarEntidades(item.title ?? "").trim();
  if (!bruto) return null;
  const indice = bruto.toLowerCase().lastIndexOf(" at ");
  let title = bruto;
  let company = "NoDesk";
  if (indice > 0) {
    title = bruto.slice(0, indice).trim();
    company = bruto.slice(indice + 4).trim() || company;
  }
  return {
    native_id: null,
    url,
    title,
    company,
    location: "",
    remote: true,
    posted_at: paraIso(item.pubDate),
    description: "",
    raw: item,
  };
}

export default {
  id: "nodesk",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const xml = await buscarTexto("https://nodesk.co/remote-jobs/index.xml", HOSTS, ctx);
    return { listings: itensRss(xml), errors: [] };
  },
  normalize: normalizarNodesk,
};
