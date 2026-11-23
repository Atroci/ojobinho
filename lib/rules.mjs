const MERCADOS = new Set(["99freelas", "upwork", "workana", "fiverr", "contra", "peopleperhour", "freelanceradar", "workana-email", "freelanceradar-email"]);

export function aplicarRegras(vaga, regras = {}, agora = new Date()) {
  const motivos = [];
  const texto = `${vaga.title ?? ""} ${vaga.company ?? ""} ${vaga.location ?? ""} ${vaga.description ?? ""} ${vaga.tags ?? ""}`.toLowerCase();
  const etiquetas = new Set(String(vaga.tags ?? "").split(",").map((item) => item.trim()).filter(Boolean));

  for (const termo of regras.exclude ?? []) {
    if (termo && texto.includes(String(termo).toLowerCase())) {
      return { passed: false, score: 0, reasons: [`excluído por termo: ${termo}`] };
    }
  }

  const inclui = regras.include_any ?? [];
  if (inclui.length) {
    const bateu = inclui.some((termo) => {
      const chave = String(termo).toLowerCase();
      return etiquetas.has(chave) || texto.includes(chave);
    });
    if (!bateu) return { passed: false, score: 0, reasons: ["fora das palavras do perfil"] };
  }

  const locais = (regras.locations_allow ?? []).map((item) => String(item).toLowerCase()).filter(Boolean);
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

  motivos.push("passou no filtro sem modelo");
  return { passed: true, score: 1, reasons: motivos };
}

export function gravarRegras(db, vaga, perfil, resultado, agora) {
  db.prepare(`
    INSERT INTO rule_results (listing_id, version, profile_id, passed, score, reasons_json, at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (listing_id, version, profile_id) DO UPDATE SET
      passed = excluded.passed, score = excluded.score, reasons_json = excluded.reasons_json, at = excluded.at
  `).run(vaga.id, vaga.version, perfil, resultado.passed ? 1 : 0, resultado.score, JSON.stringify(resultado.reasons), agora);
}
