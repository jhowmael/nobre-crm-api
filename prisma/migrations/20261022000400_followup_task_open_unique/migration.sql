UPDATE "followup_tasks" AS t
SET "status" = 'DISMISSED', "resolved_at" = COALESCE(t."resolved_at", CURRENT_TIMESTAMP)
WHERE t."status" = 'OPEN'
  AND EXISTS (
    SELECT 1
    FROM "followup_tasks" AS newer
    WHERE newer."opportunity_id" = t."opportunity_id"
      AND newer."reason_key" = t."reason_key"
      AND newer."status" = 'OPEN'
      AND (newer."created_at", newer."id") > (t."created_at", t."id")
  );

DROP INDEX "followup_tasks_opportunity_id_due_date_reason_key_key";

CREATE UNIQUE INDEX "followup_tasks_open_reason_key" ON "followup_tasks"("opportunity_id", "reason_key") WHERE (status = 'OPEN');
