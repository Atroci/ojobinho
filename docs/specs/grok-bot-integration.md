# oJobinho x Grok Bot: Integration Specification v1

Status: Proposed (draft for operator validation)
Target: oJobinho 0.3.0
Objective: Run low-cost, continuous job discovery and selectively invoke Grok Bot for evaluation and application preparation.

## 0. Repository baseline (checked against `main` at 0c0f3eb)

What already exists and must be reused:

| Capability | Where | Notes |
|---|---|---|
| Discovery pipeline | `lib/discovery.mjs`, `npm run descobrir`, `config/fontes.json` | Independent per-source queries, atomic write by temp file + `rename`, `firstSeen`/`lastSeen`/`lastCheckedAt`, status `ativa`/`indisponivel`. A failed source keeps last known state. |
| Providers | `providers/gupy.mjs`, `greenhouse.mjs`, `lever.mjs`, `transport.mjs` | HTTPS only, fixed hosts, bounded duration and size, redirects refused. |
| Deterministic engine | `lib/motor/`, `npm run motor` | Hard gates, 0-100 score (score / 20 = rubric grade), duplicate ledger, rounds, attention queue. |
| Rubric A-G | `modes/avaliar.md` | Agent-written report. |
| Snapshot and bundle | `lib/vacancy-snapshot.mjs`, `lib/application-bundle.mjs` | Content SHA-256 and deterministic ID already exist for snapshots. |
| Portal registry | `adapters/portais.mjs` | Workana and 99Freelas are recognized as `portal` (manual handoff). |
| Agent skills | `skills/`, `hermes/SKILL.md`, `AGENTS.md` | No Grok Bot skill yet. |
| Systemd example | `docs/descoberta-brasil.md` | 6 hour timer. |

Gaps relative to this spec (each is covered by an issue):

1. No content hash, revision number, canonical fingerprint or listing-level evaluation state in `data/descobertas.json`.
2. No file lock; atomic rename protects against torn writes but not against two concurrent runs overwriting each other.
3. No adapter contract (providers are plain modules). No per-source health file, no declared access-policy status, no retry/backoff policy beyond the transport limits.
4. No queue concept, no `scan`/`queue`/`evaluate`/`prepare`/`digest`/`health` commands.
5. No freelance profile or rubric. Scoring and `modes/avaliar.md` assume employment.
6. **The "existing Python scanner" for Net-Empregos is not in this repository** (no `*.py` files, no references). Its location, license and behavior must be confirmed before the adapter can be scoped. See open question Q1.
7. No reference to "Grok Bot" anywhere in the repo, so its routine, skill and trigger capabilities are unverified. See open question Q2.

## 1. Architecture

One oJobinho installation, one canonical local data store, multiple source adapters, and separate employment and freelance evaluation profiles.

The deterministic pipeline must run without an AI model:

`Source -> Fetch -> Normalize -> Deduplicate -> Filter -> Queue -> Notify`

Grok Bot consumes queued opportunities only when human judgment or language generation is required.

## 2. Preserve existing functionality

Reuse the existing:

- `npm run descobrir` discovery pipeline.
- Gupy, Greenhouse and Lever providers.
- `npm run motor` deterministic scoring, eligibility gates and ledger.
- A-G evaluation rubric.
- Snapshot and application-bundle generation.
- Local profile and CV files.
- Human review and submission boundaries.

Do not replace the existing scoring engine or introduce a second source of truth.

## 3. Site adapter contract

Each adapter must declare:

- `id`, `sourceType`, `capabilities`.
- Supported discovery method: official API, public feed, permitted HTML, manual import or notification.
- Authentication requirements.
- Access-policy status and last verification date.
- Rate limits, timeout and retry policy.
- Stable listing identifiers.
- Normalization rules.
- Last successful collection time.

Initial sources:

- Gupy, Greenhouse, Lever: existing providers.
- Net-Empregos: integrate the existing Python scanner (see Q1).
- Remote job boards: prioritize official feeds and APIs.
- Workana, 99Freelas: retain handoff; enable collection only after access-policy validation.
- Upwork, Contra, Fiverr: permitted notifications, imports or approved APIs.

An adapter failure must not stop other adapters.

## 4. Incremental processing

Persist:

- Source-specific listing ID.
- Canonical URL and normalized fingerprint.
- Content hash and revision number.
- First-seen and last-seen timestamps.
- Listing status.
- Per-profile evaluation status.
- Model, prompt version and evaluation timestamp.

A listing should be evaluated again only when its relevant content changes, the scoring profile changes, or the operator requests reevaluation.

A failed collection must never mark listings as closed.

## 5. Grok Bot integration

Provide a reusable `ojobinho` skill with explicit commands, input schemas and output schemas.

Proposed commands:

- `ojobinho scan --all --json`
- `ojobinho queue --new --profile freelance --json`
- `ojobinho evaluate --id ID --json`
- `ojobinho prepare --id ID --review-required`
- `ojobinho digest --since 24h --json`
- `ojobinho health --json`

These are proposed commands, not currently implemented interfaces. In this repo the natural home is new subcommands of `ojobinho.mjs` (for example `npm run ojobinho -- scan --all --json`); the exact binary name is open question Q3.

The skill must:

1. Read a concise operational summary rather than the entire repository.
2. Call deterministic commands first.
3. Avoid invoking a model for empty queues.
4. Use employment or freelance-specific evaluation rules.
5. Produce concise structured results.
6. Never submit applications or messages automatically.

## 6. Freelance-specific evaluation

Add a freelance profile evaluating:

- Skills and portfolio fit.
- Project budget and estimated effort.
- Effective hourly rate.
- Scope clarity and client reliability.
- Likelihood of repeat business.
- Proposal competitiveness.
- Platform-specific restrictions.

Keep freelance pricing separate from employment salary calculations.

## 7. Scheduling

Use a system timer or approved scheduler for discovery. Do not create an AI routine merely to execute a deterministic scan.

Use Grok Bot routines for daily summaries, selected evaluations and application preparation when new opportunities exist.

Avoid assuming Grok Bot offers an undocumented external trigger API. If direct event triggering is unavailable, use a short scheduled check that reads a compact queue summary.

## 8. Reliability and security

- Atomic writes and locking for concurrent runs.
- Idempotent processing.
- Per-source health reporting.
- Bounded retries and backoff.
- No credential logging.
- No bypassing authentication or anti-bot controls.
- External listing text treated as untrusted data.
- Human approval before external submission.
- No personal data in public Git commits.

## 9. Acceptance tests

- Empty queue: zero model calls.
- Repeated listing: no duplicate evaluation.
- Materially changed listing: evaluation is invalidated.
- One failed source: other sources continue.
- Closed listing: status changes only after a successful source check.
- Two profiles: separate evaluation states.
- Unauthorized source: collection disabled.
- Application preparation: no external submission.
- Existing oJobinho tests continue passing.

## 10. Seven-day validation

Run the new pipeline alongside existing Grok Bot routines.

Measure:

- New listings discovered per source.
- Duplicate percentage.
- Missed opportunities.
- AI calls per qualified opportunity.
- Tokens and model costs.
- Collection failures.
- Time from publication to discovery.
- Applications prepared and approved.

Do not disable existing routines until the replacement demonstrates equivalent or better coverage.

## 11. Proposed design notes (for validation, not yet decided)

These are my proposals to make the spec implementable. Each needs your approval.

- **State layout.** Keep `data/descobertas.json` as the single listing store and extend each record with `sourceListingId`, `fingerprint`, `contentHash`, `revision`, `evaluations: { <profile>: { status, contentHash, profileVersion, model, promptVersion, evaluatedAt } }`. Add `data/source-health.json` (per adapter). No second store.
- **Material change definition.** Hash only normalized fields that affect the decision (title, company, location/modality, contract type, compensation, requirements text). Changes to view counts, timestamps or tracking parameters do not bump `revision`. The exact field list needs approval.
- **Evaluation invalidation.** An evaluation is stale when its `contentHash` differs from the listing, when the profile version (hash of `config/perfil.md` plus motor profile, or the freelance profile) differs, or when the operator passes `--force`.
- **Closed status.** Reuse the current rule (only after a successful fetch of that source). Add a guard against partial successes: a source returning zero listings, or far fewer than last time, is treated as suspect and does not close anything until confirmed by a second run. Threshold needs approval.
- **Locking.** Lock file in `data/` with PID and start time, stale-lock detection, fail-fast with exit code for concurrent runs.
- **Model call accounting.** Every model-invoking command appends a record (command, model, prompt version, token counts if available) to a local log so the seven-day measurements and the "zero model calls on empty queue" test are checkable.
- **Compact queue summary.** `queue --json` returns IDs, titles, companies, source, profile, prefilter score and reason only. No listing bodies. Bodies are fetched per ID by `evaluate`.
- **Prompt-injection posture.** Listing text is passed to the model only inside an explicit data envelope and the skill restates that it is untrusted, consistent with `AGENTS.md`.

## 12. Open questions for the operator

- **Q1.** Where is the existing Python Net-Empregos scanner? It is not in this repo. Need location, license, how it runs, what it outputs, and whether Net-Empregos terms permit automated collection.
- **Q2.** What does Grok Bot actually support today: routines, skills or plugins, custom commands, JSON tool output, external triggers? This spec avoids assuming any trigger API, but the skill packaging format depends on the answer.
- **Q3.** CLI name: extend `ojobinho.mjs` with the proposed verbs, or add a separate entry point? Existing verbs are Portuguese (`descobrir`, `motor`); should the new ones be `scan`/`queue` as written or Portuguese aliases?
- **Q4.** Freelance profile inputs: target hourly rate, minimum project budget, currency handling, preferred platforms, portfolio source. None exist in the repo.
- **Q5.** Which remote job boards, specifically? "Official feeds and APIs" needs a named list and a terms check per board.
- **Q6.** Access-policy validation for Workana, 99Freelas, Upwork, Contra and Fiverr: who validates and how is the verification date recorded? Until validated, collection stays disabled.
- **Q7.** Is this single-user only? The spec says one installation and one data store, which matches the current design.
- **Q8.** Notification channel for "Notify": local file digest only, or an external channel? Any external channel has privacy implications under `DATA_CONTRACT.md`.

## 13. Implementation order and issue map

Suggested order: A, B, C first (foundation), then D, E, then F-J in any order, K and L last.

| Id | Topic |
|---|---|
| A | Adapter contract, registry, per-source health |
| B | Incremental listing state (fingerprint, hash, revision, evaluation state) |
| C | Locking and idempotent runs |
| D | Queue and deterministic CLI commands (scan, queue, digest, health) |
| E | evaluate and prepare commands with evaluation invalidation |
| F | Freelance profile and rubric |
| G | Net-Empregos adapter (blocked by Q1) |
| H | Remote job board adapters |
| I | Freelance platform policy gate and permitted ingestion |
| J | `ojobinho` skill for Grok Bot |
| K | Scheduling documentation and examples |
| L | Acceptance test suite |
| M | Seven-day validation instrumentation |

Tracking issue: #21. Issues A to M are #8 to #20 in the same order (A=#8, B=#9, C=#10, D=#11, E=#12, F=#13, G=#14, H=#15, I=#16, J=#17, K=#18, L=#19, M=#20).
