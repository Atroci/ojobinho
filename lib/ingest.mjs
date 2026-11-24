import { createHash } from "node:crypto";

import { juntarEtiquetas, etiquetar } from "./careerops/tags.mjs";
import { htmlParaTexto, normalizarChave, urlCanonica } from "./careerops/text.mjs";

const CAMPOS_HASH = ["title", "company", "location", "pay_min", "pay_max", "pay_currency", "pay_period", "description"];

export function hashConteudo(vaga) {
  const partes = CAMPOS_HASH.map((campo) => {
    if (campo.startsWith("pay_min") || campo.startsWith("pay_max")) return vaga[campo] ?? "";
    if (campo === "pay_currency") return String(vaga.pay_currency ?? "").toUpperCase();
    if (campo === "description") return normalizarChave(htmlParaTexto(vaga.description));
    return normalizarChave(vaga[campo]);
  });
  return createHash("sha256").update(partes.join("|")).digest("hex");
}

export function idNativo(vaga) {
  if (vaga.native_id != null && String(vaga.native_id).trim()) return String(vaga.native_id).trim();
  const canonica = urlCanonica(vaga.url);
  if (!canonica) throw new TypeError("Vaga sem id nativo e sem URL canônica.");
  return createHash("sha1").update(canonica).digest("hex").slice(0, 16);
}

export function idVaga(fonte, nativo) {
  return `${fonte}:${nativo}`;
}

function resumoDiff(antes, depois) {
  const campos = [];
  for (const campo of ["title", "company", "location", "description", "pay_min", "pay_max", "pay_currency", "pay_period"]) {
    const a = antes[campo] ?? "";
    const b = depois[campo] ?? "";
    if (String(a) !== String(b)) campos.push(campo);
  }
  return campos.join(",");
}

function preparar(fonte, bruto, agora) {
  const canonica = urlCanonica(bruto.url);
  if (!canonica) throw new TypeError("URL da vaga inválida.");
  const nativo = idNativo({ ...bruto, url: canonica });
  const description = htmlParaTexto(bruto.description ?? "").slice(0, 20000);
  const title = String(bruto.title ?? "").trim();
  if (!title) throw new TypeError("Vaga sem título.");
  const company = String(bruto.company ?? "").trim();
  const location = String(bruto.location ?? "").trim();
  const registro = {
    id: idVaga(fonte, nativo),
    source: fonte,
    native_id: nativo,
    url: String(bruto.url).trim(),
    canonical_url: canonica,
    title,
    company,
    location,
    title_key: normalizarChave(title),
    company_key: normalizarChave(company),
    remote: bruto.remote == null ? null : (bruto.remote ? 1 : 0),
    employment_type: bruto.employment_type ?? null,
    pay_min: numeroOuNulo(bruto.pay_min),
    pay_max: numeroOuNulo(bruto.pay_max),
    pay_currency: bruto.pay_currency ? String(bruto.pay_currency).toUpperCase() : null,
    pay_period: bruto.pay_period ?? null,
    posted_at: bruto.posted_at ?? null,
    description,
    proposals: Number.isInteger(bruto.proposals) ? bruto.proposals : null,
    tags: juntarEtiquetas(etiquetar(`${title}\n${company}`), bruto.tags ?? []).join(","),
    raw_json: JSON.stringify(bruto.raw ?? bruto),
  };
  registro.content_hash = hashConteudo(registro);
  registro.visto = agora;
  return registro;
}

function numeroOuNulo(valor) {
  if (valor == null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function acharCluster(db, registro) {
  const porUrl = db.prepare("SELECT id, cluster_id FROM listings WHERE canonical_url = ? AND id != ? LIMIT 1").get(registro.canonical_url, registro.id);
  if (porUrl) return porUrl.cluster_id || porUrl.id;
  if (!registro.company_key || !registro.title_key) return registro.id;
  const limite = new Date(Date.parse(registro.visto) - 30 * 864e5).toISOString();
  const porTexto = db.prepare(`
    SELECT id, cluster_id FROM listings
    WHERE company_key = ? AND title_key = ? AND first_seen_at >= ? AND id != ?
    ORDER BY first_seen_at ASC LIMIT 1
  `).get(registro.company_key, registro.title_key, limite, registro.id);
  if (porTexto) return porTexto.cluster_id || porTexto.id;
  return registro.id;
}

export function ingerirVaga(db, fonte, bruto, agora = new Date().toISOString(), extras = {}) {
  const registro = preparar(fonte, bruto, extras.first_seen_at ?? agora);
  const existente = db.prepare("SELECT * FROM listings WHERE id = ?").get(registro.id);
  const cluster = acharCluster(db, registro);
  if (!existente) {
    db.prepare(`
      INSERT INTO listings (
        id, source, native_id, url, canonical_url, title, company, location, title_key, company_key,
        remote, employment_type, pay_min, pay_max, pay_currency, pay_period, posted_at,
        first_seen_at, last_seen_at, status, content_hash, version, cluster_id, tags, proposals, raw_json, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      registro.id, registro.source, registro.native_id, registro.url, registro.canonical_url,
      registro.title, registro.company, registro.location, registro.title_key, registro.company_key,
      registro.remote, registro.employment_type, registro.pay_min, registro.pay_max, registro.pay_currency, registro.pay_period,
      registro.posted_at, extras.first_seen_at ?? agora, extras.last_seen_at ?? agora,
      extras.status ?? "active", registro.content_hash, cluster, registro.tags, registro.proposals, registro.raw_json, registro.description,
    );
    db.prepare("INSERT INTO listing_versions (listing_id, version, content_hash, seen_at, diff_summary) VALUES (?, 1, ?, ?, 'nova')").run(registro.id, registro.content_hash, agora);
    return { acao: "new", id: registro.id, version: 1, content_hash: registro.content_hash };
  }

  const mudou = existente.content_hash !== registro.content_hash;
  const versao = mudou ? existente.version + 1 : existente.version;
  db.prepare(`
    UPDATE listings SET
      url = ?, canonical_url = ?, title = ?, company = ?, location = ?, title_key = ?, company_key = ?,
      remote = ?, employment_type = ?, pay_min = ?, pay_max = ?, pay_currency = ?, pay_period = ?,
      posted_at = COALESCE(?, posted_at), last_seen_at = ?, status = 'active', content_hash = ?, version = ?,
      cluster_id = ?, tags = ?, proposals = ?, raw_json = ?, description = ?
    WHERE id = ?
  `).run(
    registro.url, registro.canonical_url, registro.title, registro.company, registro.location, registro.title_key, registro.company_key,
    registro.remote, registro.employment_type, registro.pay_min, registro.pay_max, registro.pay_currency, registro.pay_period,
    registro.posted_at, agora, registro.content_hash, versao, cluster, registro.tags, registro.proposals, registro.raw_json, registro.description,
    registro.id,
  );
  if (mudou) {
    const diff = resumoDiff(existente, registro);
    db.prepare("INSERT INTO listing_versions (listing_id, version, content_hash, seen_at, diff_summary) VALUES (?, ?, ?, ?, ?)").run(registro.id, versao, registro.content_hash, agora, diff || "conteudo");
    return { acao: "changed", id: registro.id, version: versao, content_hash: registro.content_hash };
  }
  return { acao: "same", id: registro.id, version: versao, content_hash: registro.content_hash };
}

export function encerrarAusentes(db, fonte, idsVistos, { completo, linhas, agora }) {
  const fonteRow = db.prepare("SELECT last_rows, suspect_streak FROM sources WHERE id = ?").get(fonte);
  const anteriores = Number(fonteRow?.last_rows ?? 0);
  const streak = Number(fonteRow?.suspect_streak ?? 0);
  if (!completo) return { fechadas: 0, suspeito: false };
  const queda = anteriores >= 10 && linhas < anteriores * 0.5;
  const vazio = linhas === 0 && anteriores > 0;
  if ((queda || vazio) && streak < 1) {
    db.prepare("UPDATE sources SET suspect_streak = suspect_streak + 1, last_attempt_at = ? WHERE id = ?").run(agora, fonte);
    return { fechadas: 0, suspeito: true };
  }
  const vistos = new Set(idsVistos);
  const ativas = db.prepare("SELECT id FROM listings WHERE source = ? AND status = 'active'").all(fonte);
  let fechadas = 0;
  const marcar = db.prepare("UPDATE listings SET status = 'gone', last_seen_at = ? WHERE id = ?");
  for (const vaga of ativas) {
    if (vistos.has(vaga.id)) continue;
    marcar.run(agora, vaga.id);
    fechadas += 1;
  }
  db.prepare("UPDATE sources SET suspect_streak = 0, last_rows = ?, last_ok_at = ?, last_attempt_at = ?, fail_streak = 0 WHERE id = ?").run(linhas, agora, agora, fonte);
  return { fechadas, suspeito: false };
}
