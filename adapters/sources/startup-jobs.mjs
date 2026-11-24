import { buscarTexto } from "../../lib/careerops/http.mjs";
import { httpsNoHost, itensRss, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["startup.jobs"];

export function normalizarStartupJobs(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const url = httpsNoHost(item.link ?? item.url, HOSTS);
  if (!url) return null;
  return {
    native_id: null,
    url,
    title: item.title.trim(),
    company: item.company || "",
    location: item.location || "",
    remote: /remote/i.test(`${item.title} ${item.location}`),
    description: limitar(item.description),
    posted_at: paraIso(item.pubDate),
    raw: item,
  };
}

export default {
  id: "startup-jobs",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const xml = await buscarTexto("https://startup.jobs/feeds/jobs", HOSTS, ctx);
    return { listings: itensRss(xml), errors: [] };
  },
  normalize: normalizarStartupJobs,
};
