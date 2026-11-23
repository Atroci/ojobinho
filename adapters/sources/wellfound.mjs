import { adaptadorManual } from "./_manual.mjs";

const base = adaptadorManual("wellfound");
export default { ...base, profile: ["emprego"] };
