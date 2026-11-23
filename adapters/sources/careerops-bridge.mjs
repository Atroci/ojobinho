import { adaptadorManual } from "./_manual.mjs";

const base = adaptadorManual("careerops-bridge");
export default {
  ...base,
  profile: ["emprego", "freelance"],
  async fetch() {
    throw new Error("careerops-bridge: ponte opcional desabilitada; não há checkout externo configurado");
  },
};
