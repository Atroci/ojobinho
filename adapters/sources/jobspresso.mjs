import { buscarTexto } from "../../lib/careerops/http.mjs";
import { httpsNoHost, itensRss, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["jobspresso.co"];

export function normalizarJobspresso(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const url = httpsNoHost(item.link ?? item.url, HOSTS);
  if (!url) return null;
  return {
    native_id: null,
    url,
    title: item.title.trim(),
    company: item.company || "",
    location: item.location || "",
    remote: true,
    description: limitar(item.description),
    posted_at: paraIso(item.pubDate),
    raw: item,
  };
}

export default {
  id: "jobspresso",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const quantidade = Math.min(Number(params.posts_per_page ?? 50) || 50, 100);
    const xml = await buscarTexto(`https://jobspresso.co/feed/job_feed/?posts_per_page=${quantidade}`, HOSTS, ctx);
    return { listings: itensRss(xml), errors: [] };
  },
  normalize: normalizarJobspresso,
};
