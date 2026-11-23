const REGRAS = [
  ["wordpress", /wordpress|woocommerce|elementor/i],
  ["seo", /\bseo\b|search engine optim/i],
  ["ads", /google ads|\bppc\b|m[ií]dia paga|meta ads|facebook ads/i],
  ["tracking", /\bgtm\b|tag manager|server-side|pixel/i],
  ["ga4", /\bga4\b|google analytics/i],
  ["automation", /automat|n8n|zapier|agente de ia|\bai agent/i],
  ["web", /\bweb\b|frontend|front-end|fullstack|full-stack|desenvolvedor|developer/i],
  ["travel", /turismo|travel|hotelaria de lazer/i],
  ["hospitality", /hospitality|hotelaria|hotel\b/i],
  ["restaurant", /restaurante|restaurant|card[aá]pio/i],
];

export function etiquetar(texto) {
  const origem = String(texto ?? "");
  return REGRAS.filter(([, regra]) => regra.test(origem)).map(([nome]) => nome);
}

export function juntarEtiquetas(...listas) {
  return [...new Set(listas.flat().filter(Boolean))].sort();
}
