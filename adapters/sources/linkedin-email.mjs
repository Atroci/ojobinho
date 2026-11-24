import { decodificarEntidades, htmlParaTexto, paraIso } from "../../lib/careerops/text.mjs";

const RE_URL = /https?:\/\/((?:[a-z0-9-]+\.)?linkedin\.com)\/(?:comm\/)?jobs\/view\/(\d{6,19})(?!\d)/gi;

export function urlsDeLinkedin(texto) {
  const limpo = decodificarEntidades(String(texto ?? ""));
  const achados = [];
  const vistos = new Set();
  for (const match of limpo.matchAll(RE_URL)) {
    const inicio = match.index ?? 0;
    const antes = inicio > 0 ? limpo[inicio - 1] : "";
    if (antes && /[a-z0-9.-]/i.test(antes)) continue;
    const host = match[1].toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) continue;
    if (vistos.has(match[2])) continue;
    vistos.add(match[2]);
    achados.push({ id: match[2], index: inicio });
  }
  return achados;
}

export function urlCanonicaLinkedin(id) {
  if (!/^\d{6,19}$/.test(String(id ?? ""))) return "";
  return `https://www.linkedin.com/jobs/view/${id}`;
}

function tituloDoAncora(html, id) {
  const re = new RegExp(`<a\\b[^>]*href=["'][^"']*jobs/view/${id}[^"']*["'][^>]*>([\\s\\S]*?)</a>`, "i");
  const match = html.match(re);
  if (!match) return "";
  return htmlParaTexto(match[1]).replace(/\s+/g, " ").trim();
}

function contextoHtml(html, id) {
  const re = new RegExp(`<a\\b[^>]*href=["'][^"']*jobs/view/${id}[^"']*["'][^>]*>[\\s\\S]*?</a>`, "i");
  const match = re.exec(html);
  if (!match) return "";
  const resto = html.slice(match.index + match[0].length, match.index + match[0].length + 800);
  const cortado = resto.split(/<a\b/i)[0];
  const comQuebras = cortado
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h\d|span)>/gi, "\n");
  return htmlParaTexto(comQuebras);
}

function empresaELocal(texto) {
  const linhas = String(texto ?? "").split(/\n/).map((linha) => linha.trim()).filter(Boolean).slice(0, 4);
  if (!linhas.length) return { company: "", location: "" };
  const partes = linhas[0].split(/\s+[·|]\s+|\s+\|\s+/);
  if (partes.length >= 2 && partes[0].trim() && partes[1].trim()) {
    return { company: partes[0].trim(), location: partes.slice(1).join(" ").trim() };
  }
  return { company: linhas[0], location: linhas[1] || "" };
}

function doTexto(texto, id) {
  const linhas = String(texto ?? "").split(/\n/);
  let indice = -1;
  for (let i = 0; i < linhas.length; i += 1) {
    if (linhas[i].includes(`/jobs/view/${id}`)) {
      indice = i;
      break;
    }
  }
  if (indice < 0) return null;
  const anteriores = [];
  for (let i = indice - 1; i >= 0 && anteriores.length < 3; i -= 1) {
    const linha = linhas[i].trim();
    if (linha && !/^https?:/i.test(linha)) anteriores.push(linha);
  }
  anteriores.reverse();
  if (anteriores.length >= 3) return { title: anteriores[0], company: anteriores[1], location: anteriores[2] };
  if (anteriores.length === 2) {
    const par = empresaELocal(anteriores[1]);
    if (par.location) return { title: anteriores[0], company: par.company, location: par.location };
    return { title: anteriores[0], company: anteriores[1], location: "" };
  }
  if (anteriores.length === 1) return { title: anteriores[0], company: "", location: "" };
  return null;
}

function remotoDe(local) {
  if (/\b(remote|remoto|worldwide|anywhere)\b/i.test(local)) return true;
  if (/\bhybrid\b/i.test(local)) return null;
  return false;
}

function dataDaMensagem(mensagem) {
  return paraIso(mensagem?.date ?? mensagem?.internalDate ?? mensagem?.receivedAt ?? null);
}

function idMensagem(mensagem) {
  const valor = mensagem?.id ?? mensagem?.messageId ?? mensagem?.message_id ?? "";
  return String(valor).slice(0, 80);
}

export function vagasDaMensagem(mensagem) {
  if (!mensagem || typeof mensagem !== "object") return [];
  const html = String(mensagem.html ?? mensagem.bodyHtml ?? mensagem.body_html ?? "");
  const text = String(mensagem.text ?? mensagem.bodyText ?? mensagem.body_text ?? mensagem.body ?? "");
  const juntos = `${html}\n${text}`;
  const urls = urlsDeLinkedin(juntos);
  const posted = dataDaMensagem(mensagem);
  const messageId = idMensagem(mensagem);
  const saida = [];
  for (const item of urls) {
    const url = urlCanonicaLinkedin(item.id);
    if (!url) continue;
    const htmlTitulo = tituloDoAncora(html, item.id);
    const htmlLugar = empresaELocal(contextoHtml(html, item.id));
    const texto = doTexto(text, item.id);
    const title = htmlTitulo || texto?.title || "";
    const company = htmlLugar.company || texto?.company || "";
    const location = htmlLugar.location || texto?.location || "";
    if (!title) continue;
    saida.push({
      native_id: item.id,
      url,
      title,
      company,
      location,
      remote: remotoDe(location),
      posted_at: posted,
      description: "",
      raw: { message_id: messageId, job_id: item.id },
    });
  }
  return saida;
}

function mesclar(atual, novo) {
  if (!atual) return novo;
  return {
    ...atual,
    title: atual.title || novo.title,
    company: atual.company || novo.company,
    location: atual.location || novo.location,
    remote: atual.remote === true || atual.remote === false ? atual.remote : novo.remote,
    posted_at: atual.posted_at || novo.posted_at,
  };
}

function pareceMensagem(item) {
  if (!item || typeof item !== "object") return false;
  return Boolean(item.html || item.text || item.body || item.bodyHtml || item.body_html || item.bodyText || item.body_text || item.subject);
}

export function expandLinkedin(payload) {
  const mensagens = Array.isArray(payload)
    ? payload
    : (payload?.messages ?? payload?.emails ?? null);
  if (!Array.isArray(mensagens)) {
    if (payload && Array.isArray(payload.listings)) return payload.listings;
    throw new TypeError("JSON de alerta LinkedIn precisa de messages.");
  }
  const porId = new Map();
  for (const mensagem of mensagens) {
    if (!pareceMensagem(mensagem) && mensagem?.title && mensagem?.url) {
      const id = String(mensagem.native_id ?? "");
      if (id) porId.set(id, mesclar(porId.get(id), mensagem));
      continue;
    }
    for (const vaga of vagasDaMensagem(mensagem)) {
      porId.set(vaga.native_id, mesclar(porId.get(vaga.native_id), vaga));
    }
  }
  return [...porId.values()];
}

export function normalizarLinkedin(vaga) {
  if (!vaga || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const id = String(vaga.native_id ?? "").match(/\d{6,19}/)?.[0]
    ?? String(vaga.url ?? "").match(/\/jobs\/view\/(\d{6,19})/)?.[1];
  const url = urlCanonicaLinkedin(id);
  if (!url) return null;
  const location = typeof vaga.location === "string" ? vaga.location.trim() : "";
  return {
    native_id: id,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.company === "string" ? vaga.company.trim() : "",
    location,
    remote: vaga.remote === true || vaga.remote === false ? vaga.remote : remotoDe(location),
    posted_at: vaga.posted_at ?? null,
    description: "",
    raw: vaga.raw ?? { job_id: id },
  };
}

export default {
  id: "linkedin-email",
  profile: ["emprego", "freelance"],
  hosts: [],
  async fetch() {
    return { listings: [], errors: [], skipped: "email-only" };
  },
  expand: expandLinkedin,
  normalize: normalizarLinkedin,
};
