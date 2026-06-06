-- Placeholder Editor (P1 migration): registry table for user-provided
-- placeholder values. Two-level scoping:
--   serviceId IS NULL  → account-level default (remembered across campaigns)
--   serviceId = N      → per-campaign override (frozen at save time)
--
-- No UNIQUE constraint: MySQL treats NULL != NULL in unique indexes,
-- which would allow duplicate default rows. Uniqueness enforced at
-- app level via upsert-by-query in P2.
--
-- PROD-APPLY GATE: Railway does not auto-run drizzle migrations.
-- After this commit ships, apply manually against
-- trolley.proxy.rlwy.net:14382 / railway DB. Verification query:
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
--   FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='placeholderValues'
--   ORDER BY ORDINAL_POSITION;
--
--   SHOW INDEX FROM placeholderValues;

CREATE TABLE placeholderValues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  serviceId INT NULL,
  token VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pv_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pv_serviceId FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE,
  INDEX idx_pv_user_service_token (userId, serviceId, token),
  INDEX idx_pv_user_defaults (userId, token)
);
