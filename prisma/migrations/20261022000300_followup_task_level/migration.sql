CREATE TYPE "FollowupTaskLevel" AS ENUM ('high', 'medium');

ALTER TABLE "followup_tasks" ADD COLUMN     "level" "FollowupTaskLevel" NOT NULL DEFAULT 'medium';

UPDATE "followup_tasks"
SET "level" = 'high'
WHERE "reason_key" IN ('PROPOSAL_EXPIRED', 'EVENT_NEAR', 'EVENT_PAST')
   OR ("reason_key" = 'NO_CONTACT' AND coalesce(substring("reason" FROM '(\d+) dias?')::int, 0) >= 7);

ALTER TABLE "followup_tasks" ALTER COLUMN "level" DROP DEFAULT;
