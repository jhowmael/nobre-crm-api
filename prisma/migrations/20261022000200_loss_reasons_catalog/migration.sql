CREATE TABLE "loss_reasons" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loss_reasons_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "loss_reasons"
  ADD CONSTRAINT "loss_reasons_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  ADD CONSTRAINT "loss_reasons_label_check" CHECK (btrim("label") <> '');

INSERT INTO "loss_reasons" ("code", "label", "sort_order", "active") VALUES
  ('PRICE', 'Preço acima do orçamento do cliente', 10, true),
  ('DEADLINE', 'Prazo de entrega inviável', 20, true),
  ('COMPETITOR', 'Escolheu outro fornecedor', 30, true),
  ('EVENT_CANCELLED', 'Evento cancelado ou adiado', 40, true),
  ('NO_RESPONSE', 'Sem resposta do cliente', 50, true),
  ('OTHER', 'Outro motivo', 60, true),
  ('NOT_INFORMED', 'Não informado (migração)', 99, false);

ALTER TABLE "opportunities"
ADD COLUMN     "loss_note" TEXT,
ADD COLUMN     "loss_reason_code" TEXT;

UPDATE "opportunities" AS o
SET "loss_reason_code" = r."code"
FROM "loss_reasons" AS r
WHERE o."loss_reason" IS NOT NULL
  AND lower(btrim(o."loss_reason")) = lower(r."label");

UPDATE "opportunities"
SET "loss_reason_code" = 'OTHER', "loss_note" = btrim("loss_reason")
WHERE "loss_reason_code" IS NULL
  AND "loss_reason" IS NOT NULL
  AND btrim("loss_reason") <> '';

UPDATE "opportunities"
SET "loss_reason_code" = 'NOT_INFORMED'
WHERE "stage" = 'PERDIDA' AND "loss_reason_code" IS NULL;

UPDATE "opportunities"
SET "loss_reason_code" = NULL, "loss_note" = NULL
WHERE "stage" <> 'PERDIDA' AND ("loss_reason_code" IS NOT NULL OR "loss_note" IS NOT NULL);

ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_loss_reason_check";

ALTER TABLE "opportunities" DROP COLUMN "loss_reason";

ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_loss_reason_code_fkey" FOREIGN KEY ("loss_reason_code") REFERENCES "loss_reasons"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_loss_reason_check"
    CHECK ("stage" <> 'PERDIDA' OR "loss_reason_code" IS NOT NULL),
  ADD CONSTRAINT "opportunities_loss_reason_stage_check"
    CHECK ("stage" = 'PERDIDA' OR ("loss_reason_code" IS NULL AND "loss_note" IS NULL)),
  ADD CONSTRAINT "opportunities_loss_note_check"
    CHECK ("loss_note" IS NULL OR btrim("loss_note") <> '');
