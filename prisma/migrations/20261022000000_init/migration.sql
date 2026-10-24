-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'FECHAMENTO', 'PERDIDA');

-- CreateEnum
CREATE TYPE "FollowupTaskStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "company" TEXT NOT NULL,
    "seller_id" UUID NOT NULL,
    "stage" "Stage" NOT NULL DEFAULT 'PRIMEIRO_CONTATO',
    "estimated_value" DECIMAL(12,2),
    "last_contact_at" DATE,
    "proposal_valid_until" DATE,
    "event_date" DATE,
    "loss_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_items" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "opportunity_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_histories" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "from_stage" "Stage",
    "to_stage" "Stage" NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_logs" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "seller_id" UUID,
    "contacted_at" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followup_tasks" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "reason_key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "FollowupTaskStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "followup_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_name_key" ON "sellers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_email_key" ON "sellers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_number_key" ON "opportunities"("number");

-- CreateIndex
CREATE INDEX "opportunities_seller_id_idx" ON "opportunities"("seller_id");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_stage_seller_id_idx" ON "opportunities"("stage", "seller_id");

-- CreateIndex
CREATE INDEX "opportunities_event_date_idx" ON "opportunities"("event_date");

-- CreateIndex
CREATE INDEX "opportunity_items_opportunity_id_idx" ON "opportunity_items"("opportunity_id");

-- CreateIndex
CREATE INDEX "stage_histories_opportunity_id_changed_at_idx" ON "stage_histories"("opportunity_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "contact_logs_opportunity_id_contacted_at_idx" ON "contact_logs"("opportunity_id", "contacted_at" DESC);

-- CreateIndex
CREATE INDEX "followup_tasks_seller_id_status_due_date_idx" ON "followup_tasks"("seller_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "followup_tasks_opportunity_id_due_date_reason_key_key" ON "followup_tasks"("opportunity_id", "due_date", "reason_key");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_items" ADD CONSTRAINT "opportunity_items_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_histories" ADD CONSTRAINT "stage_histories_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_tasks" ADD CONSTRAINT "followup_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_tasks" ADD CONSTRAINT "followup_tasks_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

