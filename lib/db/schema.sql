-- CareerOps / oJobinho. SQLite (node:sqlite) é a fonte de verdade das vagas coletadas.
-- Markdown e CSV continuam como exportação e como estado do fluxo humano já existente.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  adapter TEXT NOT NULL,
  profile TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  params_json TEXT NOT NULL DEFAULT '{}',
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  last_ok_at TEXT,
  last_attempt_at TEXT,
  fail_streak INTEGER NOT NULL DEFAULT 0,
  suspect_streak INTEGER NOT NULL DEFAULT 0,
  last_rows INTEGER
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  trigger TEXT NOT NULL,
  sources_ok INTEGER NOT NULL DEFAULT 0,
  sources_failed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS run_sources (
  run_id INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  ok INTEGER NOT NULL,
  rows INTEGER NOT NULL DEFAULT 0,
  new_rows INTEGER NOT NULL DEFAULT 0,
  changed_rows INTEGER NOT NULL DEFAULT 0,
  ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  skipped TEXT,
  suspect INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, source_id)
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  native_id TEXT NOT NULL,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  title_key TEXT NOT NULL DEFAULT '',
  company_key TEXT NOT NULL DEFAULT '',
  remote INTEGER,
  employment_type TEXT,
  pay_min REAL,
  pay_max REAL,
  pay_currency TEXT,
  pay_period TEXT,
  posted_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  content_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  cluster_id TEXT,
  tags TEXT NOT NULL DEFAULT '',
  proposals INTEGER,
  raw_json TEXT,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE (source, native_id)
);

CREATE INDEX IF NOT EXISTS listings_source_status ON listings (source, status);
CREATE INDEX IF NOT EXISTS listings_cluster ON listings (cluster_id);
CREATE INDEX IF NOT EXISTS listings_company_title ON listings (company_key, title_key, first_seen_at);

CREATE TABLE IF NOT EXISTS listing_versions (
  listing_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  diff_summary TEXT,
  PRIMARY KEY (listing_id, version)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  rubric_mode TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cvs (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  label TEXT NOT NULL,
  path TEXT,
  text TEXT,
  sha256 TEXT,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_results (
  listing_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  profile_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  score REAL,
  reasons_json TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (listing_id, version, profile_id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  listing_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  evaluator TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  verdict TEXT NOT NULL,
  fit_score REAL,
  json TEXT NOT NULL,
  PRIMARY KEY (listing_id, content_hash, profile_id, evaluator)
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  listing_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  channel TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  sent_at TEXT,
  cost_connects REAL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  at TEXT NOT NULL,
  amount REAL,
  currency TEXT,
  source_ref TEXT
);

CREATE TABLE IF NOT EXISTS owners (
  source_id TEXT NOT NULL,
  bot TEXT NOT NULL,
  PRIMARY KEY (source_id, bot)
);

CREATE TABLE IF NOT EXISTS model_calls (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  command TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  tokens INTEGER,
  listing_id TEXT,
  profile_id TEXT
);

CREATE TABLE IF NOT EXISTS source_yield (
  source_id TEXT PRIMARY KEY,
  runs INTEGER NOT NULL DEFAULT 0,
  runs_ok INTEGER NOT NULL DEFAULT 0,
  runs_failed INTEGER NOT NULL DEFAULT 0,
  new_listings INTEGER NOT NULL DEFAULT 0,
  last_new_at TEXT,
  last_run_at TEXT,
  last_error TEXT
);
