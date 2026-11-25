const PAISES_UE = [
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech republic", "czechia",
  "denmark", "estonia", "finland", "france", "germany", "greece", "hungary",
  "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands",
  "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
];

const CIDADES_UE = [
  "lisbon", "lisboa", "madrid", "barcelona", "berlin", "paris", "amsterdam",
  "dublin", "munich", "milan", "rome", "roma", "brussels", "vienna", "prague",
  "warsaw", "stockholm", "copenhagen", "helsinki", "athens", "bucharest",
  "budapest", "frankfurt", "lyon", "valencia", "rotterdam", "braga", "coimbra",
];

const FORA = [
  "united states", "u s a", "u s", "usa", "us", "canada", "mexico", "brazil",
  "argentina", "colombia", "chile", "peru", "uruguay", "united kingdom",
  "northern ireland", "uk", "england", "scotland", "wales", "britain", "london",
  "switzerland", "norway", "iceland", "serbia", "ukraine", "turkey",
  "united arab emirates", "uae", "singapore", "india", "australia", "new zealand",
  "japan", "china", "hong kong", "taiwan", "south korea", "korea", "indonesia",
  "malaysia", "thailand", "vietnam", "philippines", "pakistan", "bangladesh",
  "south africa", "nigeria", "egypt", "asia pacific", "apac", "asia", "latam",
  "latin america", "texas", "california", "new york", "san francisco", "seattle",
  "austin", "los angeles", "boston", "chicago", "toronto", "vancouver", "montreal",
  "tx", "ca", "ny", "wa", "fl", "ma", "il", "pa", "va",
];

function expressao(termos) {
  const lista = [...termos].sort((a, b) => b.length - a.length).map((termo) => termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${lista.join("|")})\\b`, "i");
}

const RE_UE = expressao(PAISES_UE);
const RE_CIDADE = expressao(CIDADES_UE);
const RE_FORA = expressao(FORA);

export function normalizarGeo(valor) {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function temEuropa(texto) {
  const semIrlandaDoNorte = texto.replace(/\bnorthern ireland\b/g, " ");
  if (/\b(?:europe|european union|european|emea|europa)\b/.test(semIrlandaDoNorte)) return true;
  if (/\beu\b/.test(semIrlandaDoNorte)) return true;
  if (/\b(?:portugal|lisboa|lisbon)\b/.test(semIrlandaDoNorte)) return true;
  if (/\bporto\b/.test(semIrlandaDoNorte) && !/\bporto alegre\b/.test(semIrlandaDoNorte)) return true;
  return RE_UE.test(semIrlandaDoNorte);
}

export function localCompativel(valor) {
  const texto = normalizarGeo(valor);
  if (!texto) return false;
  if (/^(?:remote|remoto|global)$/.test(texto)) return true;
  if (/\b(?:worldwide|work from anywhere|anywhere in the world)\b/.test(texto) || /\bworld\b/.test(texto)) return true;
  if (temEuropa(texto)) return true;
  if (RE_FORA.test(texto)) return false;
  if (/\banywhere\b/.test(texto)) return true;
  if (RE_CIDADE.test(texto)) return true;
  return false;
}
