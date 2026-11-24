import { adaptadorManual } from "./_manual.mjs";

const base = adaptadorManual("computrabajo");
export default { ...base, profile: ["emprego"] };
