const NOMEADAS = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  atilde: "ã",
  otilde: "õ",
  ccedil: "ç",
  acirc: "â",
  ecirc: "ê",
  ocirc: "ô",
  agrave: "à",
  Aacute: "Á",
  Eacute: "É",
  Ccedil: "Ç",
  Atilde: "Ã",
  Otilde: "Õ",
};

export function decodificarEntidades(valor) {
  return String(valor ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => ponto(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => ponto(Number(n)))
    .replace(/&([a-z]+);/gi, (todo, nome) => NOMEADAS[nome] ?? NOMEADAS[nome.toLowerCase()] ?? todo);
}

function ponto(codigo) {
  if (!Number.isInteger(codigo) || codigo < 0 || codigo > 0x10ffff) return "";
  try {
    return String.fromCodePoint(codigo);
  } catch {
    return "";
  }
}

export function htmlParaTexto(valor) {
  return decodificarEntidades(String(valor ?? ""))
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizarChave(valor) {
  return htmlParaTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function paraIso(valor) {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const ms = valor < 1e12 ? valor * 1000 : valor;
    const data = new Date(ms);
    return Number.isNaN(data.getTime()) ? null : data.toISOString();
  }
  const texto = String(valor).trim();
  if (!texto) return null;
  if (/^\d{10,13}$/.test(texto)) return paraIso(Number(texto));
  const temFuso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto);
  const lido = Date.parse(/T\d/.test(texto) && !temFuso ? `${texto}Z` : texto);
  if (Number.isNaN(lido)) return null;
  return new Date(lido).toISOString();
}

export function tipoContrato(valor) {
  const texto = String(valor ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (!texto) return null;
  if (texto.includes("intern")) return "internship";
  if (texto.includes("freelan")) return "freelance";
  if (texto.includes("tempor")) return "temporary";
  if (texto.includes("part")) return "part_time";
  if (texto.includes("full")) return "full_time";
  if (texto.includes("contract") || texto.includes("contractor")) return "contract";
  return null;
}

const RASTREIO = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "mc_cid", "mc_eid", "fs", "ref", "referrer",
]);

export function urlCanonica(valor) {
  let url;
  try {
    url = new URL(String(valor).trim());
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (url.port === "443" || url.port === "80") url.port = "";
  const params = [...url.searchParams.entries()]
    .filter(([chave]) => !RASTREIO.has(chave.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [chave, item] of params) url.searchParams.append(chave, item);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

export function httpsAbsoluto(valor) {
  try {
    const url = new URL(String(valor).trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function httpsNoHost(valor, hosts) {
  let url;
  try {
    url = new URL(String(valor).trim());
  } catch {
    return "";
  }
  const host = url.hostname.toLowerCase();
  const permitido = hosts.some((item) => host === item || host.endsWith(`.${item}`));
  if (url.protocol !== "https:" || !permitido) return "";
  return url.href;
}

export function tagTexto(bloco, nome) {
  const seguro = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(bloco).match(new RegExp(`<${seguro}\\b[^>]*>([\\s\\S]*?)</${seguro}>`, "i"));
  if (!match) return "";
  const interno = match[1].trim();
  const cdata = interno.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodificarEntidades((cdata ? cdata[1] : interno).trim());
}

export function itensRss(xml) {
  const blocos = String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return blocos.map((bloco) => ({
    title: tagTexto(bloco, "title"),
    link: tagTexto(bloco, "link"),
    pubDate: tagTexto(bloco, "pubDate"),
    description: tagTexto(bloco, "content:encoded") || tagTexto(bloco, "description"),
    company: tagTexto(bloco, "job_listing:company"),
    location: tagTexto(bloco, "job_listing:location") || tagTexto(bloco, "region") || tagTexto(bloco, "category"),
    type: tagTexto(bloco, "type"),
  }));
}

export function limitar(texto, max = 20000) {
  const limpo = htmlParaTexto(texto);
  return limpo.length > max ? limpo.slice(0, max) : limpo;
}
