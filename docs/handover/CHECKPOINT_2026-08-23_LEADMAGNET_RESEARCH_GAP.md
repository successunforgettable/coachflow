# CHECKPOINT 2026-08-23 — Lead-magnet research does not exist. That is the finding.

**For a cold session with no memory of the one that produced this.** Nothing here is recalled —
every claim below was verified in-session. Read this file, then `docs/handovers/STATE.md` and
`CHECKPOINT.md` §0.

---

## 1. Current state — nothing is mid-build

| | |
|---|---|
| HEAD | **`f5be0b0`** on `railway-build`, matching `origin/railway-build` |
| Migrations | **0097–0104 are APPLIED to production. Never re-apply any of them.** |
| Node 4 — Unique Method | **Built, deployed, and validated live on production** |
| Work in progress | **None.** No uncommitted change you need to worry about, nothing half-finished |

**Node 4 carries seven parked polish items** for a pre-launch pass — none of them blocking. The
first is the **durable "Tell Zappy how I work" button in `client/src/v2/V2CampaignKit.tsx`**, which
is **designed but not built**. The full list of all seven lives in `CHECKPOINT.md` under the Node 4
section of the Phase-2 node pass.

You are not picking up a half-done task. You are picking up a clean tree and a waiting decision.

---

## 2. What the 2026-08-23 session did — an exhaustive search, and what it found

A full search for lead-magnet research across **17,485 documents**: the entire repo, plus
`~/Downloads`, `~/Desktop` and `~/Documents` — including **content extraction of all 1,417 PDFs and
Word files** in those three directories, not merely a filename scan.

### 🔴 THE FINDING — no dedicated lead-magnet research exists anywhere on this machine

No NotebookLM report. No research brief. No standards document. **There is no equivalent of
`docs/offer-research/` or `docs/bonus-research/` for the lead magnet**, and no equivalent of the
`landing page research/` folder that sits in Downloads for the landing-page node.

**This is a genuine gap, not a search failure.** Do not re-run the search hoping for a different
answer, and do not conclude from a stray mention that the research exists. It does not.

### What was collected anyway

**39 related files were copied to `~/Downloads/ZAP-Lead-Magnet-Research`** — copies only, every
original left untouched. What those files actually are, so nobody mistakes them for research:

- **Kong HVCO training** — the Kong platform training transcript and the Section 7 task/completion
  docs worked up from it. This is the closest thing to lead-magnet methodology on the machine.
- **ZAP build handovers** — the July lead-magnet delivery checkpoints from this repo.
- **Generated samples** — ZAP campaign exports of Node 5 titles across five coaching niches.
- **Product documentation** — ZAP/CoachFlow journey docs, gap analyses and generator docs in which
  the lead-magnet node is documented as one section among many.

### 🔑 HVCO IS OUR INTERNAL NAME FOR THE LEAD MAGNET

`HVCO` = High-Value Content Offer. It is what the lead magnet is called in the codebase, the DB
(`hvcoTitles`, `hvcoTopic`), the Kong training, and most of the older docs. **Any future search
must cover both terms** — searching only for "lead magnet" misses the large majority of the
material, and searching only for "HVCO" misses the recent work.

---

## 3. Three things to flag prominently

1. **The "research-backed quality bar" document does not exist.** The lead-magnet delivery
   checkpoints dated **7–9 July** state that the three formats (guide / checklist / toolkit) were
   built to a *"research-backed quality bar"*. That document is **nowhere** — not in the repo, not
   in Downloads, Desktop or Documents. **The shipped formats therefore rest on an asserted standard,
   not a sourced one.** Treat any claim of conformance to it as unverified.

2. **Lead Magnet is Node 5, not Node 6. Unique Method is Node 4.** Get this right before touching
   anything — a mis-numbered node sends work at the wrong generator.

3. **The Google Drive mount on this machine is empty and unsynced.**
   `~/Library/CloudStorage/GoogleDrive-akshat@arfeenkhan.com` contains nothing, so anything held in
   Drive is **unreachable from here**. Drive is read separately, by Arfeen. Never report "not found"
   as "does not exist anywhere" without saying that Drive was out of reach.

---

## 4. ⚠️ Search reliability on this machine — read before trusting any zero

**`grep` here is `ugrep`**, and it **silently returns nothing when multiple `--include` flags are
stacked** in one invocation. **`timeout` also causes `pdftotext` to produce empty output.**

Both of these produced **false zeros** during this session, and both were caught only because
positive controls were run. A sweep that "found nothing" looked identical to a sweep that never
read a single byte.

**Always run a positive control before trusting any zero result on this machine.** Grep for a word
you know is present in the corpus; if the control returns nothing, your tooling is broken, not the
corpus. Run one `--include` per invocation, and drop `timeout` when shelling out to `pdftotext`.

---

## 5. What happens next — and it is not yours to start

**Arfeen is commissioning fresh B2C lead-magnet research through NotebookLM — six Studio reports.**

**Nothing is required from CC until those reports come back.**

When they do arrive, the work is, in this order:

1. **Bank them** to `docs/lead-magnet-research/`.
2. **Rebuild Node 5 propose-first** — investigation and recommendation before any code.
3. **A/B on a real service row.**
4. **Ship.**

**Do not start any of that on your own. Wait to be asked.**

---

## 6. Standing guardrails — unchanged, and they still apply

- Nothing commits, applies, pushes or deletes without Arfeen's explicit word in the immediately
  preceding message. Each authorisation is one-time.
- **Pushing `railway-build` is an instant production deploy.**
- Protected services **272–277 and 285** are untouchable.
- **Migrations 0097–0104 are applied — do not re-apply.**
- Stage named paths only. `git add -A` is always wrong in this repo.
- Off-machine backups go only to `backup/publish-path-sprint-2026-08-08`.
- The step-4c Meta publish scripts under `server/scripts/` shipped **dormant** — do not invoke them.
