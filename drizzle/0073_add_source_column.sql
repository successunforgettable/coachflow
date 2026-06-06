-- Existing-assets import (C1 migration): add source column to the 4
-- importable asset tables. Distinguishes user-imported rows from
-- AI-generated ones for UX badges and future analytics.
--
-- DEFAULT 'generated' means all existing rows are tagged correctly
-- with zero backfill. New import writes set source='imported'.
--
-- PROD-APPLY GATE: Railway does not auto-run drizzle migrations.
-- After this commit ships, apply manually against
-- trolley.proxy.rlwy.net:14382 / railway DB. Verification query:
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
--   FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA='railway'
--     AND COLUMN_NAME='source'
--     AND TABLE_NAME IN ('offers','idealCustomerProfiles','heroMechanisms','hvcoTitles');
-- Expected: 4 rows, all COLUMN_TYPE="enum('generated','imported')",
-- COLUMN_DEFAULT='generated'.

ALTER TABLE offers
  ADD COLUMN source ENUM('generated','imported') NOT NULL DEFAULT 'generated';

ALTER TABLE idealCustomerProfiles
  ADD COLUMN source ENUM('generated','imported') NOT NULL DEFAULT 'generated';

ALTER TABLE heroMechanisms
  ADD COLUMN source ENUM('generated','imported') NOT NULL DEFAULT 'generated';

ALTER TABLE hvcoTitles
  ADD COLUMN source ENUM('generated','imported') NOT NULL DEFAULT 'generated';
