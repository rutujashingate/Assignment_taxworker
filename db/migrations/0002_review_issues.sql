CREATE TABLE workpaper_issue (
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  version text NOT NULL CHECK (version IN ('v1','v2','v3')),
  issue_key text NOT NULL,
  finding jsonb NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','waiting','explained','resolved_with_evidence')),
  assignee_id text REFERENCES demo_identity(id),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  evidence_refs jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(evidence_refs) = 'array'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_by text NOT NULL REFERENCES demo_identity(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, tax_year, version, issue_key),
  FOREIGN KEY (client_id,tax_year) REFERENCES engagement(client_id,tax_year),
  CHECK (finding->>'key' = issue_key AND finding->>'version' = version),
  CHECK (status NOT IN ('waiting','explained','resolved_with_evidence') OR length(trim(note)) >= 10),
  CHECK (status <> 'resolved_with_evidence' OR jsonb_array_length(evidence_refs) > 0)
);
CREATE INDEX workpaper_issue_assignee ON workpaper_issue(assignee_id);
