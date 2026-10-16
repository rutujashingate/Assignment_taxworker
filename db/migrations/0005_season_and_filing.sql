CREATE TABLE season_clock (
  client_id text NOT NULL, tax_year integer NOT NULL, as_of timestamptz NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), updated_by text NOT NULL REFERENCES demo_identity(id),
  PRIMARY KEY(client_id,tax_year), FOREIGN KEY(client_id,tax_year) REFERENCES engagement(client_id,tax_year)
);
CREATE TABLE filing_simulation (
  id uuid PRIMARY KEY, client_id text NOT NULL, tax_year integer NOT NULL,
  parent_id uuid REFERENCES filing_simulation(id),
  status text NOT NULL CHECK(status IN ('draft','submitted','rejected','federal_accepted','accepted')),
  revision integer NOT NULL CHECK(revision > 0), model jsonb NOT NULL,
  attestations jsonb NOT NULL DEFAULT '{}', approval jsonb, correction jsonb,
  snapshot jsonb, snapshot_hash text,
  created_by text NOT NULL REFERENCES demo_identity(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(client_id,tax_year) REFERENCES engagement(client_id,tax_year),
  CHECK ((snapshot IS NULL) = (snapshot_hash IS NULL)),
  CHECK(status NOT IN ('federal_accepted','accepted') OR snapshot IS NOT NULL)
);
CREATE INDEX filing_scope ON filing_simulation(client_id,tax_year,created_at,id);
CREATE TABLE filing_simulation_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, filing_id uuid NOT NULL REFERENCES filing_simulation(id),
  actor_id text NOT NULL REFERENCES demo_identity(id), action text NOT NULL, record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX filing_events_scope ON filing_simulation_event(filing_id,id);
CREATE TRIGGER filing_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON filing_simulation_event FOR EACH STATEMENT EXECUTE FUNCTION refuse_record_change();
CREATE FUNCTION protect_filing_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'accepted' THEN
    RAISE EXCEPTION 'Accepted filing simulation is immutable; create an amendment branch';
  END IF;
  IF OLD.status = 'federal_accepted' AND
    (NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
      OR NEW.model IS DISTINCT FROM OLD.model OR NEW.approval IS DISTINCT FROM OLD.approval
      OR NEW.attestations IS DISTINCT FROM OLD.attestations OR NEW.correction IS DISTINCT FROM OLD.correction
      OR NEW.status <> 'accepted') THEN
    RAISE EXCEPTION 'Federally accepted snapshot is immutable';
  END IF;
  IF NEW.id <> OLD.id OR NEW.client_id <> OLD.client_id OR NEW.tax_year <> OLD.tax_year
    OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION 'Filing simulation identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER filing_snapshot_guard BEFORE UPDATE OR DELETE ON filing_simulation FOR EACH ROW EXECUTE FUNCTION protect_filing_snapshot();
CREATE TRIGGER filing_no_truncate BEFORE TRUNCATE ON filing_simulation FOR EACH STATEMENT EXECUTE FUNCTION refuse_record_change();
