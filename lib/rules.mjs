const MERCADOS = new Set(["99freelas", "upwork", "workana", "fiverr", "contra", "peopleperhour", "freelanceradar", "workana-email", "freelanceradar-email"]);
const CACHE = new Map();

function escapar(termo) {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function termoPresente(texto, termo) {
  const agulha = String(termo ?? "").trim().normalize("NFC");
  if (!agulha) return false;
  const palheiro = String(texto ?? "").normalize("NFC");
  let expressao = CACHE.get(agulha);
  if (!expressao) {
    expressao = new RegExp(`(?<![\\p{L}\\p{N}_.+#])${escapar(agulha)}(?![\\p{L}\\p{N}_.+#])`, "iu");
    CACHE.set(agulha, expressao);
  }
  expressao.lastIndex = 0;
  return expressao.test(palheiro);
}

function algum(texto, termos) {
  return (termos ?? []).some((termo) => termoPresente(texto, termo));
}

function lista(valor) {
  return Array.isArray(valor) ? valor.filter((item) => String(item ?? "").trim()) : [];
}

function fontePermitida(fonte, regras) {
  const nome = String(fonte ?? "");
  const negadas = lista(regras.sources_deny).map((item) => String(item));
  if (negadas.some((item) => item === nome)) return false;
  const permitidas = lista(regras.sources_allow).map((item) => String(item));
  if (permitidas.length && !permitidas.includes(nome)) return false;
  return true;
}

export function aplicarRegras(vaga, regras = {}, agora = new Date()) {
  const titulo = `${vaga.title ?? ""}`;
  const etiquetas = String(vaga.tags ?? "");
  const tituloEEtiquetas = `${titulo}\n${etiquetas}`;
  const descricao = `${vaga.description ?? ""}`;
  const tudo = `${titulo}\n${vaga.company ?? ""}\n${vaga.location ?? ""}\n${descricao}\n${etiquetas}`;

  if (!fontePermitida(vaga.source, regras)) {
    return { passed: false, score: 0, reasons: [`fonte fora do perfil: ${vaga.source}`] };
  }

  if (algum(titulo, regras.exclude_title)) {
    return { passed: false, score: 0, reasons: ["título excluído"] };
  }

  if (algum(tudo, regras.exclude)) {
    return { passed: false, score: 0, reasons: ["excluído por termo"] };
  }

  const noTitulo = lista(regras.include_title_any);
  const emQualquer = lista(regras.include_any);
  if (noTitulo.length) {
    if (!algum(tituloEEtiquetas, noTitulo)) {
      return { passed: false, score: 0, reasons: ["título fora do perfil"] };
    }
    if (emQualquer.length && !algum(descricao, emQualquer)) {
      return { passed: false, score: 0, reasons: ["descrição fora do perfil"] };
    }
  } else if (emQualquer.length && !algum(tudo, emQualquer)) {
    return { passed: false, score: 0, reasons: ["fora das palavras do perfil"] };
  }

  const locais = lista(regras.locations_allow).map((item) => String(item).toLowerCase());
  if (locais.length && vaga.location) {
    const local = String(vaga.location).toLowerCase();
    const remoto = vaga.remote === 1 || vaga.remote === true || /\b(remote|remoto|worldwide|anywhere)\b/i.test(local);
    if (!remoto && !locais.some((item) => local.includes(item))) {
      return { passed: false, score: 0, reasons: ["localização fora do perfil"] };
    }
  }

  const fonte = String(vaga.source ?? "");
  const mercado = MERCADOS.has(fonte) || [...MERCADOS].some((item) => fonte.startsWith(`${item}-`) || fonte.startsWith(item));
  if (mercado && regras.max_age_hours && vaga.posted_at) {
    const idade = (agora.getTime() - Date.parse(vaga.posted_at)) / 36e5;
    if (Number.isFinite(idade) && idade > regras.max_age_hours) {
      return { passed: false, score: 0, reasons: ["anúncio antigo demais para marketplace"] };
    }
  }

  if (regras.max_proposals != null && vaga.proposals != null && vaga.proposals > regras.max_proposals) {
    return { passed: false, score: 0, reasons: ["concorrência acima do teto"] };
  }

  if (regras.pay_floor_hourly_usd != null && vaga.pay_period === "hour" && vaga.pay_currency === "USD" && vaga.pay_max != null) {
    if (Number(vaga.pay_max) < regras.pay_floor_hourly_usd) {
      return { passed: false, score: 0, reasons: ["abaixo do piso por hora"] };
    }
  }

  if (regras.pay_floor_fixed != null && vaga.pay_period === "fixed" && vaga.pay_max != null && regras.pay_floor_currency) {
    if (vaga.pay_currency === regras.pay_floor_currency && Number(vaga.pay_max) < regras.pay_floor_fixed) {
      return { passed: false, score: 0, reasons: ["abaixo do piso do projeto"] };
    }
  }

  return { passed: true, score: 1, reasons: ["passou no filtro sem modelo"] };
}

export function gravarRegras(db, vaga, perfil, resultado, agora) {
  db.prepare(`
    INSERT INTO rule_results (listing_id, version, profile_id, passed, score, reasons_json, at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (listing_id, version, profile_id) DO UPDATE SET
      passed = excluded.passed, score = excluded.score, reasons_json = excluded.reasons_json, at = excluded.at
  `).run(vaga.id, vaga.version, perfil, resultado.passed ? 1 : 0, resultado.score, JSON.stringify(resultado.reasons), agora);
}
