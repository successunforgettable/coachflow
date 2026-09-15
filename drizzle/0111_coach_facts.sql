-- 0111 — coach facts: one row per fact the COACH supplied, with provenance and time
--        (travels ALONE — architectural invariant 6)
--
-- Creates ONE table, `coachFacts`. Alters nothing. Backfills nothing.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────
-- The fabrication gate grounds claims against `buildCoachCorpus`, one flattened string. Measured on
-- kit 225 (THREADB_GROUNDING_CHECK_2026-09-15): the corpus held 3,832 chars, and the coach typed 1,077
-- of them. The rest was model output, e.g. expandProfile's buyer inner monologue in `painPoints`,
-- which is where "HR for 12 years" and "my husband" came from. Nothing in the corpus says which is which.
--
-- And no stored coach fact carries its own time (ADDENDUM_SCRIPT_QUALITY_AND_GROUNDING §3): `updatedAt`
-- is row-level and moves when generated text overwrites the row. So an old people-trained figure and a
-- new one both ground. The latest coach-supplied value of a single-valued fact must supersede older ones.
--
-- ── SHAPE ───────────────────────────────────────────────────────────────────────────────────
--   factScope     account | service. Needed because serviceId is ON DELETE SET NULL. Without it, a
--                 service-scoped fact whose service is deleted would silently become account-wide
--                 (the 0110 testimonial defect, where NULL was read as "applies everywhere").
--                 service + NULL serviceId = orphaned; the builder drops it.
--                 Not a CHECK constraint: MySQL forbids FK referential actions on columns used in CHECKs.
--   slot          e.g. people_trained, countries, years_experience, clients_served, headline_credential
--   slotKind      practice | biography | credential | offer
--   factValue     the value, verbatim as the coach supplied it
--   sourceChannel coach channels ONLY. There is no value for generated text, so model output cannot be
--                 recorded as a fact. coach_confirmed_rewording counts for practice facts only, never
--                 biography (decision D-a, enforced in server/_core/coachFacts.ts).
--   sourceRef     where the value came from (e.g. "chatTranscripts:88#turn4"). NOT NULL: a fact
--                 nobody can trace is not a fact.
--   sourcedAt     when the coach supplied it. NO DEFAULT, deliberately: a default would stamp a backfill
--                 with today's date and make an old figure look current.
--   supersededAt  NULL = current. Older values are marked, never deleted.
--
-- Column names avoid MySQL keywords (CLAUDE.md §9): no `value`, `source`, `scope`, `kind`. JS keys equal
-- DB column names; there are no snake_case overrides.
--
-- ⚠️ ADDITIVE AND INERT. Nothing reads or writes this table in production code yet (CLAUDE.md §15d):
--   · no WRITER until the coach screen (sprint 6) or a separately approved backfill;
--   · no production READER until sprint 2 (F2). `buildCoachFacts` is pure and takes rows as input.
-- So applying it ahead of any code is safe, and the code can never ship ahead of it.
--
-- 🔴 NOT APPLIED TO PRODUCTION. A CREATE TABLE is a production write and needs Arfeen's explicit go-ahead
-- in the immediately preceding message (CLAUDE.md §10 — schema-only is NOT an exception). Before applying,
-- confirm the target by `@@version_comment` (production `MySQL Community Server - GPL`, local `Homebrew`);
-- VERSION() is 9.4.0 on both and cannot distinguish them.
--
-- REVERSIBILITY. Nothing depends on it yet:  DROP TABLE `coachFacts`;
-- Once a writer exists, dropping it loses coach-supplied facts that exist nowhere else.
--
-- IDEMPOTENCE. Re-running errors with ER_TABLE_EXISTS_ERROR (1050), which is safe.
--
-- VERIFY AFTER APPLYING — expect 12 columns in this order, with these types and nullability:
--   SELECT ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
--     FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coachFacts'
--    ORDER BY ORDINAL_POSITION;
--   id int NO · userId int NO · serviceId int YES · factScope enum('account','service') NO ·
--   slot varchar(64) NO · slotKind enum('practice','biography','credential','offer') NO ·
--   factValue text NO · sourceChannel enum('coach_typed','coach_confirmed_rewording','ladder_answer',
--   'operator_capture','account_profile') NO · sourceRef varchar(255) NO · sourcedAt timestamp NO (no default) ·
--   supersededAt timestamp YES · createdAt timestamp NO DEFAULT CURRENT_TIMESTAMP
--
-- AND the two foreign keys with their delete rules:
--   SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, DELETE_RULE
--     FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
--    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'coachFacts';
--   expect: fk_coachFacts_userId users CASCADE · fk_coachFacts_serviceId services SET NULL
--
-- AND nothing was backfilled:  SELECT COUNT(*) FROM coachFacts;  -- expect 0

CREATE TABLE `coachFacts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `serviceId` INT NULL,
  `factScope` ENUM('account','service') NOT NULL,
  `slot` VARCHAR(64) NOT NULL,
  `slotKind` ENUM('practice','biography','credential','offer') NOT NULL,
  `factValue` TEXT NOT NULL,
  `sourceChannel` ENUM('coach_typed','coach_confirmed_rewording','ladder_answer','operator_capture','account_profile') NOT NULL,
  `sourceRef` VARCHAR(255) NOT NULL,
  `sourcedAt` TIMESTAMP NOT NULL,
  `supersededAt` TIMESTAMP NULL DEFAULT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  -- Current facts per slot: WHERE userId = ? AND slot = ? AND supersededAt IS NULL.
  -- Also serves the userId FK (leftmost prefix).
  KEY `idx_coachFacts_user_slot_superseded` (`userId`, `slot`, `supersededAt`),
  KEY `idx_coachFacts_serviceId` (`serviceId`),
  CONSTRAINT `fk_coachFacts_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coachFacts_serviceId` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE SET NULL
);
