#!/usr/bin/env python3
"""
Generates docs/RESEARCH_INDEX.md by SWEEPING THE FILESYSTEM.

Nothing in the output is hand-written: every row is produced from a file that
exists on disk at run time. Re-run it to re-measure rather than to trust.

    python3 tools/research-index.py > docs/RESEARCH_INDEX.md

Taxonomy is FIXED (Arfeen, 2026-09-01) and must not be extended here:
  STANDARD    prescriptive; defines what good looks like
  TEARDOWN    a real live asset reverse-engineered; grounded in something that ran
  PLATFORM    how Meta ingests, reads or ranks the asset; delivery mechanics, not craft
  DELIVERABLE client output or system output; not research
"""
import os, re, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NODES = ["service","icp","offer","uniqueMethod","freeOptIn","headlines",
         "adCopy","landingPage","emailSequence","whatsappSequence","adCreatives"]
NODE_LABEL = {
    "service":"1. Service","icp":"2. ICP","offer":"3. Offer","uniqueMethod":"4. Unique Method",
    "freeOptIn":"5. Free Opt-In (Lead Magnet)","headlines":"6. Headlines","adCopy":"7. Ad Copy",
    "landingPage":"8. Landing Page","emailSequence":"9. Email Sequence",
    "whatsappSequence":"10. WhatsApp Sequence","adCreatives":"11. Ad Creatives",
}

# dir prefix -> node. Longest prefix wins. "*" = cross-cutting, not node-specific.
DIR_NODE = [
    ("docs/icp-research","icp"),
    ("docs/offer-research","offer"),
    ("docs/bonus-research","offer"),
    ("docs/lead-magnet-research","freeOptIn"),
    ("docs/landing-page-research","landingPage"),
    ("docs/landing-page-references","landingPage"),
    ("docs/landing-page-analysis","landingPage"),
    ("docs/andromeda/landing-page-research","landingPage"),
    ("docs/andromeda/copy-research","adCopy"),
    ("docs/andromeda/image-research","adCreatives"),
    ("docs/andromeda/script-research","adCreatives"),
    ("docs/andromeda/prospecting-research","*"),
    ("docs/copy-research","*"),
    ("docs/compliance","*"),
    ("docs/kong-analysis","*"),
    ("docs/zap-marketing-site-reference","*"),
]
ROOT_FILE_NODE = {
    "LANDING_PAGE_VISUAL_QUALITY_STANDARD.md":"landingPage",
    "AD_IMAGE_VISUAL_QUALITY_STANDARD.md":"adCreatives",
}
# Directories that hold session records / plans / proofs, never research.
DELIVERABLE_DIRS = ("docs/handover","docs/handovers","docs/screenshots","docs/superpowers",
                    "docs/testing","docs/walkthrough-screenshots","docs/ad-references")

def words(path):
    ext = path.rsplit(".",1)[-1].lower()
    try:
        if ext == "docx":
            with zipfile.ZipFile(path) as z:
                x = z.read("word/document.xml").decode("utf8","ignore")
            return len(re.sub(r"<[^>]*>"," ",x).split())
        if ext == "pdf":
            out = subprocess.run(["pdftotext","-q",path,"-"],capture_output=True,timeout=25)
            return len(out.stdout.decode("utf8","ignore").split())
        with open(path,encoding="utf8",errors="ignore") as f:
            return len(f.read().split())
    except Exception:
        return -1

def text(path):
    ext = path.rsplit(".",1)[-1].lower()
    try:
        if ext == "docx":
            with zipfile.ZipFile(path) as z:
                return re.sub(r"<[^>]*>"," ",z.read("word/document.xml").decode("utf8","ignore"))
        if ext == "pdf":
            return subprocess.run(["pdftotext","-q",path,"-"],capture_output=True,timeout=25).stdout.decode("utf8","ignore")
        return open(path,encoding="utf8",errors="ignore").read()
    except Exception:
        return ""

B2B = re.compile(r"\bb2b\b|\bsaas\b|enterprise|procurement|stakeholder|account executive|demo request|\bMQL\b|agency client",re.I)
B2C = re.compile(r"\bcoach\b|\bcoaches\b|consultant|course|webinar|challenge|membership|\bb2c\b",re.I)

def framing(t):
    b, c = len(B2B.findall(t)), len(B2C.findall(t))
    if c == 0 and b == 0: return "—"
    if b == 0 or c >= b*4: return "B2C"
    if c == 0 or b >= c*4: return "B2B"
    return "mixed"

def kind(rel, name):
    if "replication-specs" in rel or "Replication_Report" in name or "Replication Spec" in name:
        return "TEARDOWN"
    if rel.startswith(DELIVERABLE_DIRS):
        return "DELIVERABLE"
    if re.match(r"^(Technical Report|Technical Analysis|Policy Analysis)", name) or "Andromeda" in name:
        return "PLATFORM"
    if re.search(r"Meta['’]s |Meta Ads |Meta Ad ", name):
        return "PLATFORM"
    if name.upper().startswith("README"):
        return "DELIVERABLE"
    return "STANDARD"

def node_of(rel, name):
    if "/" not in rel and name in ROOT_FILE_NODE: return ROOT_FILE_NODE[name]
    best, bn = "", None
    for d, n in DIR_NODE:
        if rel.startswith(d + "/") and len(d) > len(best): best, bn = d, n
    return bn

CODE = []
for base in ("server","client/src"):
    for dp,_,fns in os.walk(os.path.join(ROOT,base)):
        if "node_modules" in dp: continue
        for fn in fns:
            if fn.endswith((".ts",".tsx")): CODE.append(os.path.join(dp,fn))
CODE_TEXT = ""
for p in CODE:
    try: CODE_TEXT += open(p,encoding="utf8",errors="ignore").read()
    except Exception: pass

def applied(name):
    stem = name.rsplit(".",1)[0]
    for cand in {stem, stem.replace("_"," "), stem.replace(" ","_")}:
        if len(cand) > 12 and cand in CODE_TEXT: return "applied"
    return "unapplied"

# ─── STATUS OVERLAY ────────────────────────────────────────────────────────────
# NOT derivable from the filesystem. Supplied by Arfeen 2026-09-01 and labelled as
# such wherever it prints, so a zero row is never silently read as "nothing exists".
STATUS = {
  "offer":       ("✅ DONE ELSEWHERE", "Recorded complete outside the coverage map. The map still lists it as needing research; the map is wrong."),
  "uniqueMethod":("✅ DONE ELSEWHERE", "Recorded complete outside the coverage map, though NOTHING is banked in the repo. The map still lists it as needing research; the map is wrong on the status and the repo is empty on the artefact."),
  "emailSequence":("🟡 HELD, NOT BANKED", "Research EXISTS and Arfeen holds it. It is not in the repo. Record as HELD — not missing."),
  "whatsappSequence":("🟡 HELD, NOT BANKED", "Research EXISTS and Arfeen holds it. It is not in the repo. Record as HELD — not missing."),
}

rows = []
for dp,dns,fns in os.walk(os.path.join(ROOT,"docs")):
    dns[:] = [d for d in dns if d != "node_modules"]
    for fn in fns:
        if not fn.lower().endswith((".md",".pdf",".docx",".txt")): continue
        full = os.path.join(dp,fn); rel = os.path.relpath(full,ROOT)
        if rel.startswith(DELIVERABLE_DIRS): continue      # session records, not research
        n = node_of(rel,fn)
        if n is None: continue
        rows.append((n,kind(rel,fn),framing(text(full)),applied(fn),words(full),rel))
for fn,n in ROOT_FILE_NODE.items():
    full = os.path.join(ROOT,fn)
    if os.path.exists(full):
        rows.append((n,kind(fn,fn),framing(text(full)),applied(fn),words(full),fn))

out = sys.stdout.write
out("# RESEARCH INDEX — generated, not written\n\n")
out("> **Regenerate with:**\n>\n> ```\n> python3 tools/research-index.py > docs/RESEARCH_INDEX.md\n> ```\n>\n")
out("> Every row below is produced by sweeping the filesystem at run time. **Re-measure rather than\n")
out("> trust it** — if a future session's run differs from this file, the run wins.\n\n")
out("**Taxonomy (fixed, Arfeen 2026-09-01):** `STANDARD` prescriptive, defines what good looks like · ")
out("`TEARDOWN` a real live asset reverse-engineered, grounded in something that ran · ")
out("`PLATFORM` how Meta ingests/reads/ranks the asset, delivery mechanics not craft · ")
out("`DELIVERABLE` client or system output, not research.\n\n")
out("**`applied`** means a string matching the document's filename appears in `server/` or `client/src/`. ")
out("It is a conservative test: a document used as background but never named in code reads as `unapplied`.\n\n---\n\n")

tot = {}
for n in NODES:
    sel = sorted([r for r in rows if r[0]==n], key=lambda r:(r[1],-r[4]))
    w = sum(max(r[4],0) for r in sel)
    tot[n] = (len(sel),w)
    out(f"## {NODE_LABEL[n]}\n\n")
    if n in STATUS:
        tag, note = STATUS[n]
        out(f"> **{tag}** — *status supplied by Arfeen 2026-09-01; NOT measured from the filesystem.*\n>\n> {note}\n\n")
    if not sel:
        out("🔴 **NOTHING BANKED IN THE REPO — 0 documents.**\n\n")
        continue
    out(f"**{len(sel)} document(s), {w:,} words.**\n\n")
    out("| kind | framing | applied | words | path |\n|---|---|---|---|---|\n")
    for _,k,f,a,wc,p in sel:
        out(f"| `{k}` | {f} | {a} | {wc if wc>=0 else '?'} | `{p}` |\n")
    out("\n")
    dirs = sorted({os.path.dirname(r[5]) or "(repo root)" for r in sel})
    expected = "docs/%s-research" % {"freeOptIn":"lead-magnet","landingPage":"landing-page",
        "adCopy":"copy","adCreatives":"image","uniqueMethod":"method"}.get(n, n.lower())
    off = [d for d in dirs if d != expected]
    if off:
        out(f"⚠️ **SCATTERED — does not follow the `docs/<node>-research/` convention.** Expected `{expected}/`; actually in: ")
        out(", ".join("`%s`" % d for d in off) + ". **Recorded, NOT moved.**\n\n")

cross = sorted([r for r in rows if r[0]=="*"], key=lambda r:(r[1],-r[4]))
out("## CROSS-CUTTING — not attributable to one node\n\n")
out(f"**{len(cross)} document(s), {sum(max(r[4],0) for r in cross):,} words.**\n\n")
out("| kind | framing | applied | words | path |\n|---|---|---|---|---|\n")
for _,k,f,a,wc,p in cross:
    out(f"| `{k}` | {f} | {a} | {wc if wc>=0 else '?'} | `{p}` |\n")
out("\n---\n\n## TOTALS BY NODE\n\n| node | docs | words |\n|---|---|---|\n")
for n in NODES:
    c,w = tot[n]
    out(f"| {NODE_LABEL[n]} | {c} | {w:,} |\n")
out(f"| CROSS-CUTTING | {len(cross)} | {sum(max(r[4],0) for r in cross):,} |\n")
