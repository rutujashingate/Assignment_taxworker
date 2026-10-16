CREATE TABLE collaboration_item (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  tax_year integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('thread','question','review_note','task')),
  audience text NOT NULL CHECK (audience IN ('internal','client')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 3 AND 8000),
  source_refs jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(source_refs) = 'array'),
  assignee_id text REFERENCES demo_identity(id),
  due_date date,
  blocks_filing boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL REFERENCES demo_identity(id),
  updated_by text NOT NULL REFERENCES demo_identity(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id,tax_year) REFERENCES engagement(client_id,tax_year),
  UNIQUE (id,client_id,tax_year),
  CHECK (NOT blocks_filing OR (kind = 'review_note' AND audience = 'internal')),
  CHECK (kind <> 'review_note' OR audience = 'internal')
);
CREATE INDEX collaboration_item_scope ON collaboration_item(client_id,tax_year,audience,updated_at);
CREATE TABLE collaboration_message (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES collaboration_item(id),
  kind text NOT NULL CHECK (kind IN ('reply','answer')),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 3 AND 8000),
  created_by text NOT NULL REFERENCES demo_identity(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collaboration_message_item ON collaboration_message(item_id,created_at,id);
CREATE TABLE collaboration_attachment (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES collaboration_item(id),
  kind text NOT NULL CHECK (kind IN ('file','note')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  note text,
  content bytea,
  media_type text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  sensitive boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES demo_identity(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'file' AND content IS NOT NULL AND note IS NULL AND octet_length(content) BETWEEN 1 AND 2097152) OR
    (kind = 'note' AND content IS NULL AND length(trim(note)) BETWEEN 3 AND 8000))
);
CREATE INDEX collaboration_attachment_item ON collaboration_attachment(item_id,created_at,id);
CREATE TABLE collaboration_notification (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES collaboration_item(id),
  recipient_id text NOT NULL REFERENCES demo_identity(id),
  event text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collaboration_notification_recipient ON collaboration_notification(recipient_id,item_id,created_at DESC);
-- Messages and attachments are dated evidence. Corrections append a new record.
CREATE TRIGGER collaboration_message_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON collaboration_message FOR EACH STATEMENT EXECUTE FUNCTION refuse_record_change();
CREATE TRIGGER collaboration_attachment_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON collaboration_attachment FOR EACH STATEMENT EXECUTE FUNCTION refuse_record_change();
