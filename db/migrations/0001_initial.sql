CREATE TABLE packet_import (
  packet_hash text PRIMARY KEY CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
  raw_bytes bytea NOT NULL,
  raw_json jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CHECK (encode(sha256(raw_bytes), 'hex') = packet_hash),
  CHECK (convert_from(raw_bytes, 'UTF8')::jsonb = raw_json)
);
CREATE TABLE engagement (
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  packet_hash text NOT NULL REFERENCES packet_import(packet_hash),
  name text NOT NULL,
  PRIMARY KEY (client_id, tax_year),
  UNIQUE (packet_hash)
);
CREATE TABLE source_document (
  packet_hash text NOT NULL REFERENCES packet_import(packet_hash),
  document_id text NOT NULL,
  received_at timestamptz NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (packet_hash, document_id)
);
CREATE INDEX source_document_availability ON source_document(packet_hash, received_at);
CREATE TABLE source_value (
  packet_hash text NOT NULL,
  value_id text NOT NULL,
  document_id text NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (packet_hash, value_id),
  FOREIGN KEY (packet_hash, document_id) REFERENCES source_document(packet_hash, document_id)
);
CREATE INDEX source_value_document ON source_value(packet_hash, document_id);
CREATE TABLE engine_version (
  packet_hash text NOT NULL REFERENCES packet_import(packet_hash),
  version text NOT NULL,
  computed_at timestamptz NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (packet_hash, version)
);
CREATE TABLE engine_line (
  packet_hash text NOT NULL,
  version text NOT NULL,
  line_key text NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (packet_hash, version, line_key),
  FOREIGN KEY (packet_hash, version) REFERENCES engine_version(packet_hash, version)
);
CREATE TABLE packet_auxiliary (
  packet_hash text NOT NULL REFERENCES packet_import(packet_hash),
  section text NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (packet_hash, section)
);
CREATE TABLE demo_identity (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('preparer','reviewer','partner','firm_administrator','quality_reviewer','client')),
  sensitive_data_clearance boolean NOT NULL,
  active_from date NOT NULL
);
CREATE TABLE engagement_access (
  actor_id text NOT NULL REFERENCES demo_identity(id),
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  PRIMARY KEY (actor_id, client_id, tax_year),
  FOREIGN KEY (client_id, tax_year) REFERENCES engagement(client_id, tax_year)
);
CREATE TABLE demo_session (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES demo_identity(id),
  signing_key bytea NOT NULL CHECK (octet_length(signing_key) = 32),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_session_expiry ON demo_session(expires_at);
CREATE TABLE workpaper_preference (
  actor_id text NOT NULL,
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  selected_version text NOT NULL CHECK (selected_version IN ('v1','v2','v3')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, client_id, tax_year),
  FOREIGN KEY (actor_id, client_id, tax_year) REFERENCES engagement_access(actor_id, client_id, tax_year)
);
CREATE TABLE audit_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL REFERENCES demo_identity(id),
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  before_json jsonb,
  after_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id, tax_year) REFERENCES engagement(client_id, tax_year)
);
CREATE INDEX audit_event_engagement ON audit_event(client_id, tax_year, id);

CREATE FUNCTION refuse_record_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable; use a workpaper overlay', TG_TABLE_NAME;
END;
$$;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'packet_import','engagement','source_document','source_value','engine_version',
    'engine_line','packet_auxiliary','demo_identity','engagement_access','audit_event'
  ] LOOP
    EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION refuse_record_change()', table_name);
  END LOOP;
END;
$$;
