# Session handover — operational rules

Hard rules for any Claude Code session working on this repo. These are
non-negotiable; ignoring them has caused at least one mid-sprint loss
of state already (see "Working directory" below).

## Working directory — non-negotiable

All Claude Code sessions operate from `~/zap-deploy` on macOS. Never
`/tmp/zap-fresh`, never `/tmp/zap-deploy` — `/tmp` is reaped by the
OS and by various background services, which silently destroys the
local clone (and any uncommitted state) mid-session.

The first command of every session is:

```bash
cd ~/zap-deploy && git fetch --all && git checkout railway-build && git pull origin railway-build
```

If you ever see `fatal: not a git repository` mid-session, the
working directory was reaped. Stop, re-clone into `~/zap-deploy`,
and re-issue the last sprint prompt.

### One-time setup (already done if `~/zap-deploy` exists)

```bash
mkdir -p ~/zap-deploy && \
  git clone https://github.com/successunforgettable/coachflow.git ~/zap-deploy && \
  cd ~/zap-deploy && \
  git checkout railway-build
```

## Deploy verification pattern

After every push to `railway-build`, wait ~3 minutes for Railway to
build and deploy, then probe:

```bash
curl -sS -o /dev/null -w "root HTTP %{http_code} | time %{time_total}s\n" https://zapcampaigns.com/
curl -sS -o /dev/null -w "api  HTTP %{http_code}\n" https://zapcampaigns.com/api/trpc/auth.me
```

Both should return `HTTP 200`. The deploy is alive when both pass.
This does not verify the active commit SHA (no build-SHA endpoint
exists today) — for that, check Railway's Deployments tab.

## Migration application

Database migrations under `drizzle/migrations/*.sql` are NOT applied
automatically. Arfeen applies each manually via the Railway Data tab
in numerical order. Do not assume a migration is live just because
the SQL file is in the repo. If a feature gates on a column that a
pending migration adds, flag it explicitly in the sprint summary.

Migration order as of this writing: 0001 → 0002 → 0003 → 0004 → 0005
→ 0006. Always confirm with `DESCRIBE <table>;` before flipping
feature flags that depend on schema changes.

## Feature flags

`ENABLE_COMPLIANCE_REWRITES` (env var on Railway) gates the W5
compliance rewrite engine. Currently `true` in production. Flip-off
fully reverts the feature with no rollback needed.
