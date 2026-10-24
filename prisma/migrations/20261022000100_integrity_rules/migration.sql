ALTER SEQUENCE "opportunities_number_seq" RESTART WITH 2001;

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_estimated_value_check"
    CHECK ("estimated_value" IS NULL OR "estimated_value" >= 0),
  ADD CONSTRAINT "opportunities_version_check"
    CHECK ("version" >= 1),
  ADD CONSTRAINT "opportunities_company_check"
    CHECK (btrim("company") <> ''),
  ADD CONSTRAINT "opportunities_loss_reason_check"
    CHECK ("stage" <> 'PERDIDA' OR ("loss_reason" IS NOT NULL AND btrim("loss_reason") <> '')),
  ADD CONSTRAINT "opportunities_quote_value_check"
    CHECK ("stage" IN ('PRIMEIRO_CONTATO', 'PERDIDA') OR ("estimated_value" IS NOT NULL AND "estimated_value" > 0));

ALTER TABLE "opportunity_items"
  ADD CONSTRAINT "opportunity_items_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "opportunity_items_name_check" CHECK (btrim("name") <> '');

ALTER TABLE "stage_histories"
  ADD CONSTRAINT "stage_histories_transition_check"
    CHECK ("from_stage" IS NULL OR "from_stage" <> "to_stage");

CREATE FUNCTION enforce_stage_transition() RETURNS trigger AS $$
BEGIN
  IF NEW."stage" = OLD."stage" THEN
    RETURN NEW;
  END IF;

  IF OLD."stage" IN ('FECHAMENTO', 'PERDIDA') THEN
    RAISE EXCEPTION 'Etapa final % não pode ser alterada', OLD."stage" USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
    (OLD."stage" = 'PRIMEIRO_CONTATO' AND NEW."stage" IN ('APRESENTACAO_ORCAMENTO', 'PERDIDA')) OR
    (OLD."stage" = 'APRESENTACAO_ORCAMENTO' AND NEW."stage" IN ('FOLLOW_UP', 'PERDIDA')) OR
    (OLD."stage" = 'FOLLOW_UP' AND NEW."stage" IN ('FORECAST', 'APRESENTACAO_ORCAMENTO', 'PERDIDA')) OR
    (OLD."stage" = 'FORECAST' AND NEW."stage" IN ('FECHAMENTO', 'FOLLOW_UP', 'PERDIDA'))
  ) THEN
    RAISE EXCEPTION 'Transição inválida de % para %', OLD."stage", NEW."stage" USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "opportunities_enforce_stage_transition"
  BEFORE UPDATE OF "stage" ON "opportunities"
  FOR EACH ROW EXECUTE FUNCTION enforce_stage_transition();

CREATE FUNCTION enforce_quote_items() RETURNS trigger AS $$
DECLARE
  target_id uuid;
  current_stage "Stage";
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    target_id := NEW."id";
  ELSE
    target_id := OLD."opportunity_id";
  END IF;

  SELECT "stage" INTO current_stage FROM "opportunities" WHERE "id" = target_id;

  IF current_stage IS NULL OR current_stage IN ('PRIMEIRO_CONTATO', 'PERDIDA') THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "opportunity_items" WHERE "opportunity_id" = target_id) THEN
    RAISE EXCEPTION 'Oportunidade % em % exige ao menos um item de brinde', target_id, current_stage
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "opportunities_require_items"
  AFTER INSERT OR UPDATE OF "stage" ON "opportunities"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_quote_items();

CREATE CONSTRAINT TRIGGER "opportunity_items_keep_one"
  AFTER DELETE ON "opportunity_items"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_quote_items();
