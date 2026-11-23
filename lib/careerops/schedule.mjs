const DIA_MS = 24 * 60 * 60 * 1000;

export function diaLisboa(data) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

export function intervaloDaFonte(agenda, id) {
  const especifico = agenda.sources?.[id] ?? {};
  const min = Number(especifico.min_interval_minutes ?? agenda.default_min_interval_minutes ?? 240);
  const tetoDia = especifico.max_runs_per_day ?? null;
  const pisoPorTeto = tetoDia ? Math.ceil((24 * 60) / tetoDia) : Number(agenda.floor_minutes ?? 180);
  return {
    min_interval_minutes: min,
    max_runs_per_day: tetoDia,
    floor_minutes: Math.max(Number(agenda.floor_minutes ?? 180), pisoPorTeto),
    ceiling_minutes: Number(especifico.ceiling_minutes ?? agenda.ceiling_minutes ?? 1440),
    max_pages: especifico.max_pages ?? null,
  };
}

export function fonteDevida(agenda, id, ultimaExecucao, agora = new Date()) {
  if (!ultimaExecucao) return { due: true };
  const { min_interval_minutes } = intervaloDaFonte(agenda, id);
  const decorrido = agora.getTime() - Date.parse(ultimaExecucao);
  if (!Number.isFinite(decorrido)) return { due: true };
  if (decorrido < min_interval_minutes * 60 * 1000) {
    return { due: false, reason: "not-due", wait_minutes: Math.ceil((min_interval_minutes * 60 * 1000 - decorrido) / 60000) };
  }
  return { due: true };
}

export function estourouTetoDiario(execucoesIso, teto, agora = new Date()) {
  if (!teto) return false;
  const hoje = diaLisboa(agora);
  const noDia = execucoesIso.filter((iso) => iso && diaLisboa(new Date(iso)) === hoje).length;
  return noDia >= teto;
}

export function recomendarIntervalo(estatistica, agendaFonte) {
  const atual = Number(agendaFonte.min_interval_minutes);
  const piso = Number(agendaFonte.floor_minutes);
  const teto = Number(agendaFonte.ceiling_minutes);
  const rodadas = Number(estatistica.runs ?? 0);
  const ok = Number(estatistica.runs_ok ?? 0);
  const falhas = Number(estatistica.runs_failed ?? 0);
  const novas = Number(estatistica.new_listings ?? 0);
  if (rodadas < 3) {
    return { action: "keep", suggested_minutes: atual, reason: "amostra curta" };
  }
  const erro = falhas / rodadas;
  if (erro >= 0.5) {
    return { action: "slower", suggested_minutes: Math.min(teto, Math.round(atual * 1.5)), reason: "taxa de erro alta" };
  }
  const media = ok ? novas / ok : 0;
  if (media === 0) {
    return { action: "slower", suggested_minutes: Math.min(teto, Math.round(atual * 1.5)), reason: "nenhuma vaga nova na amostra" };
  }
  if (media >= 3 && atual > piso) {
    return { action: "faster", suggested_minutes: Math.max(piso, Math.round(atual * 0.75)), reason: "rendimento alto" };
  }
  return { action: "keep", suggested_minutes: atual, reason: "ritmo compatível com o rendimento" };
}

export { DIA_MS };
