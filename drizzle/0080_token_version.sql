-- F6-2: Session revocation via tokenVersion.
-- Default 0 matches the JWT fallback for pre-migration tokens (no forced logout).
-- NOT in the Drizzle schema (raw SQL access only) to avoid breaking
-- select().from(users) during the deploy window before migration runs.
ALTER TABLE users ADD COLUMN tokenVersion INT NOT NULL DEFAULT 0;
