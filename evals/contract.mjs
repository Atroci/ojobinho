import { isDeepStrictEqual } from "node:util";

export const CONTRACT_VERSION = 1;

const ENUMS = {
  contract: ["CLT", "PJ", "UNKNOWN"],
  visibility: ["DISCLOSED", "HIDDEN", "UNSPECIFIED"],
  period: ["MONTHLY", "ANNUAL", "UNSPECIFIED"],
  basis: ["GROSS", "NET", "UNSPECIFIED"],
  territory: ["ELIGIBLE", "RESTRICTED", "UNKNOWN"],
  mei: ["NOT_APPLICABLE", "AMBIGUOUS", "REQUIRED", "OPTIONAL", "UNKNOWN"],
  requirement: ["NOT_APPLICABLE", "MET", "MISSING", "UNKNOWN"],
  scam: ["EARLY_SENSITIVE_DATA", "MANDATORY_PURCHASE", "UNOFFICIAL_CONTACT", "UPFRONT_PAYMENT"],
  blocker: ["AUTHORIZATION", "LEGITIMACY", "REGULATION", "TERRITORY"],
  decision: ["APPLY", "ASK", "DO_NOT_APPLY", "BLOCKED"],
};

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path}: objeto esperado`);
}

function keys(value, expected, path) {
  object(value, path);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) throw new TypeError(`${path}: campos esperados ${wanted.join(",")}`);
}

function oneOf(value, allowed, path) {
  if (!allowed.includes(value)) throw new TypeError(`${path}: valor inválido`);
}

function sortedUnique(values, allowed, path) {
  if (!Array.isArray(values)) throw new TypeError(`${path}: lista esperada`);
  if (!isDeepStrictEqual(values, [...new Set(values)].sort())) throw new TypeError(`${path}: lista deve ser única e ordenada`);
  values.forEach((value, index) => oneOf(value, allowed, `${path}[${index}]`));
}

function validateSalary(salary, path) {
  keys(salary, ["visibility", "amount", "currency", "period", "basis", "variable"], path);
  oneOf(salary.visibility, ENUMS.visibility, `${path}.visibility`);
  oneOf(salary.period, ENUMS.period, `${path}.period`);
  oneOf(salary.basis, ENUMS.basis, `${path}.basis`);
  if (salary.currency !== null && salary.currency !== "BRL") throw new TypeError(`${path}.currency: BRL ou null esperado`);
  if (salary.amount !== null && (!Number.isFinite(salary.amount) || salary.amount <= 0)) throw new TypeError(`${path}.amount: número positivo ou null esperado`);
  if (salary.variable !== null && typeof salary.variable !== "boolean") throw new TypeError(`${path}.variable: booleano ou null esperado`);
  if (salary.visibility === "DISCLOSED" && (salary.amount === null || salary.currency === null)) throw new TypeError(`${path}: salário divulgado precisa de valor e moeda`);
  if (salary.visibility !== "DISCLOSED" && (salary.amount !== null || salary.currency !== null)) throw new TypeError(`${path}: salário não divulgado não pode ter valor ou moeda`);
}

function expectedBlockers(facts) {
  const blockers = [];
  if (facts.authorization === "MISSING") blockers.push("AUTHORIZATION");
  if (facts.scamSignals.length) blockers.push("LEGITIMACY");
  if (facts.regulation === "MISSING") blockers.push("REGULATION");
  if (facts.territory === "RESTRICTED") blockers.push("TERRITORY");
  return blockers.sort();
}

export function validateResult(result, path = "result") {
  keys(result, ["contractVersion", "caseId", "facts", "rubric", "score", "blockers", "decision"], path);
  if (result.contractVersion !== CONTRACT_VERSION) throw new TypeError(`${path}.contractVersion: versão ${CONTRACT_VERSION} esperada`);
  if (typeof result.caseId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.caseId)) throw new TypeError(`${path}.caseId: slug esperado`);

  keys(result.facts, ["contract", "salary", "territory", "mei", "authorization", "regulation", "scamSignals"], `${path}.facts`);
  oneOf(result.facts.contract, ENUMS.contract, `${path}.facts.contract`);
  validateSalary(result.facts.salary, `${path}.facts.salary`);
  oneOf(result.facts.territory, ENUMS.territory, `${path}.facts.territory`);
  oneOf(result.facts.mei, ENUMS.mei, `${path}.facts.mei`);
  oneOf(result.facts.authorization, ENUMS.requirement, `${path}.facts.authorization`);
  oneOf(result.facts.regulation, ENUMS.requirement, `${path}.facts.regulation`);
  sortedUnique(result.facts.scamSignals, ENUMS.scam, `${path}.facts.scamSignals`);

  keys(result.rubric, ["A", "B", "C", "D", "E", "F", "G"], `${path}.rubric`);
  for (const key of ["A", "B", "C", "D", "E", "F"]) {
    const value = result.rubric[key];
    if (!Number.isFinite(value) || value < 1 || value > 5 || !Number.isInteger(value * 2)) throw new TypeError(`${path}.rubric.${key}: nota de 1 a 5 em passos de 0,5 esperada`);
  }
  oneOf(result.rubric.G, ["CLEAR", "BLOCKED"], `${path}.rubric.G`);

  const score = Math.round((result.rubric.A * 30 + result.rubric.B * 20 + result.rubric.C * 15 + result.rubric.D * 15 + result.rubric.E * 10 + result.rubric.F * 10) / 10) / 10;
  if (result.score !== score) throw new TypeError(`${path}.score: esperado ${score}`);
  const blockers = expectedBlockers(result.facts);
  sortedUnique(result.blockers, ENUMS.blocker, `${path}.blockers`);
  if (!isDeepStrictEqual(result.blockers, blockers)) throw new TypeError(`${path}.blockers: incoerente com fatos`);
  if (result.rubric.G !== (result.facts.scamSignals.length ? "BLOCKED" : "CLEAR")) throw new TypeError(`${path}.rubric.G: incoerente com sinais de fraude`);

  oneOf(result.decision, ENUMS.decision, `${path}.decision`);
  const decision = blockers.length ? "BLOCKED" : score >= 4 ? "APPLY" : score >= 3.5 ? "ASK" : "DO_NOT_APPLY";
  if (result.decision !== decision) throw new TypeError(`${path}.decision: esperado ${decision}`);
  return result;
}

export function validateEnvelope(envelope, path = "output") {
  keys(envelope, ["contractVersion", "results"], path);
  if (envelope.contractVersion !== CONTRACT_VERSION) throw new TypeError(`${path}.contractVersion: versão ${CONTRACT_VERSION} esperada`);
  if (!Array.isArray(envelope.results)) throw new TypeError(`${path}.results: lista esperada`);
  envelope.results.forEach((result, index) => validateResult(result, `${path}.results[${index}]`));
  const ids = envelope.results.map(({ caseId }) => caseId);
  if (new Set(ids).size !== ids.length) throw new TypeError(`${path}.results: caseId duplicado`);
  return envelope;
}
