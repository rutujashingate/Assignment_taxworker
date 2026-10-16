CREATE TABLE sales_lot_review (
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  version text NOT NULL CHECK (version IN ('v1','v2','v3')),
  line_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('reviewed','needs_review')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 2000),
  source_refs jsonb NOT NULL CHECK (jsonb_typeof(source_refs) = 'array'),
  revision integer NOT NULL CHECK (revision > 0),
  updated_by text NOT NULL REFERENCES demo_identity(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id,tax_year,version,line_key),
  FOREIGN KEY (client_id,tax_year) REFERENCES engagement(client_id,tax_year)
);
CREATE TABLE firm_standard (
  packet_hash text PRIMARY KEY REFERENCES packet_import(packet_hash),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  revision integer NOT NULL CHECK (revision > 0),
  updated_by text NOT NULL REFERENCES demo_identity(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE work_time_entry (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  actor_id text NOT NULL REFERENCES demo_identity(id),
  category text NOT NULL,
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  worked_on date NOT NULL,
  note text NOT NULL CHECK (length(trim(note)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id,tax_year) REFERENCES engagement(client_id,tax_year)
);
CREATE INDEX work_time_scope ON work_time_entry(client_id,tax_year,actor_id,worked_on);
CREATE TRIGGER work_time_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON work_time_entry FOR EACH STATEMENT EXECUTE FUNCTION refuse_record_change();
