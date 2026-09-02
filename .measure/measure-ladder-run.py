#!/usr/bin/env python3
"""
POST-RUN MEASUREMENT — the ladder's typed fraction.

READ-ONLY. Issues SELECTs only. Never writes, never deletes.

Run as:
  railway run --environment production --service coachflow -- \
      python3 .measure/measure-ladder-run.py --svc <N> --icp <N> --kit <N>

The three baseline ids are the HIGHEST ids that existed BEFORE the run. They are
passed in, never hard-coded, because a baseline is measured at run time and never
read out of a document (CLAUDE.md 15f).

Where a step cannot be answered from the data it STOPS and says which step and why.
It never estimates.
"""
import argparse, json, os, subprocess, sys, urllib.parse

# buildCoachCorpus field order — server/_core/groundingCorpus.ts:99-107, verbatim.
CORPUS_FIELDS = [
    "name", "category", "description", "targetCustomer", "mainBenefit",
    "painPoints", "whyProblemExists", "uniqueMechanismSuggestion",
    "coachBackground", "pressFeatures", "socialProofStat",
    "testimonial1Name", "testimonial2Name", "testimonial3Name",
    "testimonial1Quote", "testimonial2Quote", "testimonial3Quote",
]
# coachBackground is read by buildCoachCorpus but is NOT a column on `services`
# (verified against drizzle/schema.ts:134-268). It always resolves undefined.
NOT_A_COLUMN = {"coachBackground"}
SQL_FIELDS = [f for f in CORPUS_FIELDS if f not in NOT_A_COLUMN]

LADDER_KEYS = ["trigger", "priorAttempts", "hesitation", "successMoment"]
LADDER_TEXT = {
    "trigger":       "Think of the last person who hired you. What was going on in their life right when they reached out?",
    "priorAttempts": "What had they already tried that didn't work?",
    "hesitation":    "What nearly stopped them from saying yes?",
    "successMoment": "Six months in, what made them say it was worth it?",
}

def q(sql):
    u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
    cmd = ["mysql", "-h", u.hostname, "-P", str(u.port or 3306),
           "-u", urllib.parse.unquote(u.username or ""),
           f"-p{urllib.parse.unquote(u.password or '')}",
           "-D", u.path.lstrip("/"), "--batch", "--raw", "-N"]
    r = subprocess.run(cmd, input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        err = "\n".join(l for l in r.stderr.splitlines() if "Using a password" not in l)
        sys.exit(f"SQL FAILED — stopping rather than reporting a partial number.\n{err}")
    return [ln.split("\t") for ln in r.stdout.splitlines() if ln.strip()]

def rule(t):  print("\n" + "=" * 78 + f"\n{t}\n" + "=" * 78)
def stop(step, why):
    print(f"\n>>> STOPPED AT {step}.\n>>> {why}\n>>> Not estimating past this point.")
    sys.exit(2)

ap = argparse.ArgumentParser()
ap.add_argument("--svc", type=int, required=True)
ap.add_argument("--icp", type=int, required=True)
ap.add_argument("--kit", type=int, required=True)
a = ap.parse_args()

print(f"BASELINE PASSED IN (measured immediately before the run, not read from a document):")
print(f"  services max id {a.svc} | idealCustomerProfiles max id {a.icp} | campaignKits max id {a.kit}")

# ---- STEP 1: the rows the run created -------------------------------------
rule("STEP 1 — NEW ROWS CREATED BY THIS RUN")
svc = q(f"SELECT id, COALESCE(name,'<NULL>'), createdAt FROM services WHERE id > {a.svc} ORDER BY id;")
icp = q(f"SELECT id, name, COALESCE(serviceId,-1), createdAt FROM idealCustomerProfiles WHERE id > {a.icp} ORDER BY id;")
kit = q(f"SELECT id, icpId, COALESCE(path,'<NULL>'), COALESCE(campaignType,'<NULL>'), createdAt FROM campaignKits WHERE id > {a.kit} ORDER BY id;")
for r in svc: print(f"  service  id={r[0]:>4}  name={r[1]!r}  created={r[2]}")
for r in icp: print(f"  ICP      id={r[0]:>4}  name={r[1]!r}  serviceId={r[2]}  created={r[3]}")
for r in kit: print(f"  kit      id={r[0]:>4}  icpId={r[1]}  path={r[2]}  type={r[3]}  created={r[4]}")
if not svc: stop("STEP 1", "No new services row above the baseline. The run did not reach service creation.")
if not icp: stop("STEP 1", "No new ICP row above the baseline. The run did not reach ICP generation.")
if len(svc) > 1 or len(icp) > 1:
    print(f"  !! {len(svc)} services and {len(icp)} ICPs above baseline — more than one run is in this window.")
    stop("STEP 1", "Cannot attribute the corpus to a single run without guessing which rows are yours.")
SVC, ICP = int(svc[0][0]), int(icp[0][0])
KIT = int(kit[0][0]) if kit else None

# ---- STEP 2: the kit's path -----------------------------------------------
rule("STEP 2 — THE KIT'S PATH VALUE")
if KIT is None:
    print("  No kit row above the baseline.")
    print("  NOTE: on the auto branch the ladder is persisted BEFORE getOrCreateKit,")
    print("        so steps 3-6 can still be answered. Path is simply unknown.")
    PATH = None
else:
    PATH = kit[0][2]
    print(f"  kit {KIT}  path = {PATH}")
    if PATH != "auto":
        print(f"  !! EXPECTED 'auto'. A non-auto path means runAutoInChat was not the code that ran,")
        print(f"     and the ladder has no call site on that branch.")

# ---- STEP 3: the four ladder answers, verbatim -----------------------------
rule("STEP 3 — THE FOUR LADDER ANSWERS, VERBATIM")
gm = q(f"SELECT COALESCE(CAST(groundingMeta AS CHAR),'<NULL>') FROM idealCustomerProfiles WHERE id = {ICP};")
raw = gm[0][0] if gm else "<NULL>"
if raw == "<NULL>":
    stop("STEP 3", f"ICP {ICP} has groundingMeta NULL. No provenance was written at all.")
meta = json.loads(raw)
answered = meta.get("ladderAnswered")
answers = meta.get("ladderAnswers")
print(f"  groundingMeta top-level keys : {sorted(meta.keys())}")
print(f"  ladderAnswered (always written): {answered!r}")
if answers is None:
    print(f"  ladderAnswers  (written only when non-empty): KEY ABSENT")
    stop("STEP 3",
         "No ladder answers were persisted. `ladderAnswers` is omitted by "
         "server/_core/icpGrounding.ts:409 whenever ladderAnswered is empty, so this "
         "means every question was skipped, declined, or answered blank. "
         "The typed fraction is zero again and there is nothing further to measure.")
total_ladder = 0
for k in LADDER_KEYS:
    v = answers.get(k)
    if v is None:
        print(f"\n  [{k}] NOT ANSWERED (skipped)\n      Q: {LADDER_TEXT[k]}")
        continue
    total_ladder += len(v)
    print(f"\n  [{k}] {len(v)} chars\n      Q: {LADDER_TEXT[k]}\n      A: {v!r}")
extra = [k for k in answers if k not in LADDER_KEYS]
if extra: print(f"\n  !! unexpected extra keys in ladderAnswers: {extra}")
print(f"\n  ANSWERED {len(answers)} of 4    TOTAL LADDER CHARACTERS: {total_ladder}")

# ---- STEP 4: the corpus ----------------------------------------------------
rule("STEP 4 — THE FULL CORPUS buildCoachCorpus ASSEMBLES")
cols = ", ".join(f"COALESCE(`{c}`, '')" for c in SQL_FIELDS)
srow = q(f"SELECT {cols} FROM services WHERE id = {SVC};")
if not srow: stop("STEP 4", f"services row {SVC} vanished between queries.")
sval = dict(zip(SQL_FIELDS, srow[0]))
sval["coachBackground"] = ""   # not a column; buildCoachCorpus always sees undefined

parts, provenance = [], []
for f in CORPUS_FIELDS:
    v = sval.get(f, "")
    if isinstance(v, str) and v.strip():
        parts.append(v); provenance.append((f, v, "service"))
for k in LADDER_KEYS:
    v = answers.get(k)
    if isinstance(v, str) and v.strip():
        parts.append(v); provenance.append((f"ladderAnswers.{k}", v, "ladder"))
corpus = " \n".join(parts)
print(f"  corpus fields populated : {len(parts)}")
print(f"  CORPUS TOTAL CHARACTERS : {len(corpus)}  (joined with ' \\n', exactly as the code does)")
print(f"\n----- CORPUS VERBATIM -----\n{corpus}\n----- END CORPUS -----")

# ---- STEP 5: what the coach actually typed ---------------------------------
rule("STEP 5 — WHAT THE COACH TYPED, AND THE TYPED/GENERATED SPLIT")
typed_src, transcript_ok = [], False
if KIT is not None:
    tr = q(f"SELECT COALESCE(CAST(messages AS CHAR),'<NONE>') FROM chatTranscripts WHERE campaignKitId = {KIT};")
    if tr and tr[0][0] != "<NONE>":
        try:
            msgs = json.loads(tr[0][0])
            typed_src = [m.get("text", "") for m in msgs if isinstance(m, dict) and m.get("type") == "user-bubble"]
            transcript_ok = True
        except Exception as e:
            print(f"  !! transcript present but unparseable: {e}")
if not transcript_ok:
    print("  NO TRANSCRIPT. appendMessagesMutation is wrapped in try/catch in")
    print("  V2TrailIntake.tsx (\"transcript is a nice-to-have\"), so a flush failure")
    print("  loses the coach's opening description.")
    print("\n  The ladder answers are still known to be coach-typed — they arrive through")
    print("  handleSendText and no generator writes them. Reporting the split on that")
    print("  basis alone, and marking the service fields UNVERIFIABLE rather than generated.")

typed_blob = "\n".join(typed_src) + "\n" + "\n".join(v for v in answers.values() if v)
print(f"\n  coach's typed messages captured : {len(typed_src)}")
print(f"  coach's typed characters TOTAL   : {sum(len(t) for t in typed_src) + total_ladder}"
      f"  (opening/description {sum(len(t) for t in typed_src)} + ladder {total_ladder})")

def classify(field, value):
    if field.startswith("ladderAnswers."):
        return "coach-typed"          # arrives via handleSendText; no generator writes it
    if not transcript_ok:
        return "UNVERIFIABLE"         # cannot test containment without the typed text
    return "coach-typed" if value.strip() and value.strip() in typed_blob else "generated"

marks = [(f, v, classify(f, v)) for f, v, _ in provenance]
typed_chars = sum(len(v) for f, v, m in marks if m == "coach-typed")
gen_chars   = sum(len(v) for f, v, m in marks if m == "generated")
unk_chars   = sum(len(v) for f, v, m in marks if m == "UNVERIFIABLE")
all_chars   = typed_chars + gen_chars + unk_chars
typed_n     = sum(1 for _, _, m in marks if m == "coach-typed")

print(f"\n  TYPED CHARACTERS IN CORPUS     : {typed_chars}")
print(f"  GENERATED CHARACTERS IN CORPUS : {gen_chars}")
if unk_chars:
    print(f"  UNVERIFIABLE CHARACTERS        : {unk_chars}   <-- no transcript; NOT counted as generated")
print(f"  SUM OF FIELD CHARACTERS        : {all_chars}  (corpus string is {len(corpus)}, "
      f"difference {len(corpus) - all_chars} is the ' \\n' separators)")
print(f"\n  FRACTION: {typed_chars} of {all_chars} characters typed by the coach"
      f"  =  {typed_chars / all_chars:.1%}" if all_chars else "  FRACTION: corpus is empty")
print(f"  FRACTION: {typed_n} of {len(marks)} populated fields typed by the coach")
print("\n  QUALIFIER, stated not hidden: this fraction is set by how much the coach chose")
print("  to type. It is not comparable across runs of different brief lengths without")
print("  quoting both raw character counts, which are given above.")

# ---- STEP 6: every field, one line each ------------------------------------
rule("STEP 6 — EVERY FIELD FEEDING buildCoachCorpus, ONE LINE EACH")
for f in CORPUS_FIELDS:
    v = sval.get(f, "")
    if f in NOT_A_COLUMN:
        print(f"  {f:<28} {0:>5} chars  NOT-A-COLUMN   (read by buildCoachCorpus; absent from `services`)")
    elif not (isinstance(v, str) and v.strip()):
        print(f"  {f:<28} {0:>5} chars  EMPTY")
    else:
        print(f"  {f:<28} {len(v):>5} chars  {classify(f, v)}")
for k in LADDER_KEYS:
    v = answers.get(k)
    lbl = f"ladderAnswers.{k}"
    if isinstance(v, str) and v.strip():
        print(f"  {lbl:<28} {len(v):>5} chars  coach-typed")
    else:
        print(f"  {lbl:<28} {0:>5} chars  NOT ANSWERED")
print(f"  {'importedText':<28} {0:>5} chars  N/A — blank-slate coach, nothing imported")
print("\nDone. Read-only throughout; no row was written.")
