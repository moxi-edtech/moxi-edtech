#!/usr/bin/env python3
"""No-merge rehearsal: git merge-tree --write-tree and ephemeral commit-tree.

Never advances main, merges a PR, pushes a branch or touches Supabase. All
conflicts and intentional synthetic choices are recorded in JSON. A new,
unrecognised conflict fails CI instead of silently choosing a version.
"""
import json
import os
import re
import subprocess
import sys

def git(*args, check=False):
    result = subprocess.run(["git", *args], text=True, capture_output=True,
                            env={**os.environ, "GIT_AUTHOR_NAME":"Synthetic CI",
                                 "GIT_AUTHOR_EMAIL":"synthetic@invalid.test",
                                 "GIT_COMMITTER_NAME":"Synthetic CI",
                                 "GIT_COMMITTER_EMAIL":"synthetic@invalid.test"})
    if check and result.returncode:
        raise RuntimeError("Git merge-tree fixture failed: "+ " ".join(args[:2]))
    return result

CC_REF="HEAD"
BASE_REF="origin/main"
branches=[
  ("financeiro-p0-232","origin/fix/finance-validar-pagamento-idempotency-20261021"),
  ("balcao-p1-213","origin/perf/balcao-measured-20261021"),
  ("balcao-p2-216","origin/feat/balcao-nice-to-haves-20261021"),
  ("klasse-ia-192","origin/work/klasse-ai-20261013"),
  ("operacoes-layout-247","origin/fix/operations-layout-composition-20261022"),
  ("professores-pesquisa-231","origin/fix/command-center-professor-search-modal-20261021"),
]
known_conflicts={
 "apps/web/src/components/layout/klasse/Topbar.tsx",
 "apps/web/src/components/secretaria/BalcaoWorkspace.tsx",
 "apps/web/visual-harness/main.tsx",
 "apps/web/src/hooks/useGlobalSearch.ts",
}
def inspect(left,right):
    result=git("merge-tree","--write-tree",left,right)
    lines=result.stdout.splitlines()
    conflicts=sorted(set(re.findall(r"CONFLICT \([^)]*\): Merge conflict in ([^\n]+)",
                              result.stdout)))
    return {
       "clean":result.returncode==0,
       "tree":lines[0] if lines else None,
       "conflictFiles":conflicts,
       "unknownConflict":not conflicts and result.returncode!=0,
    }

independent=[]
for label,ref in [("command-center-C",CC_REF),*branches]:
    if git("rev-parse","--verify",ref).returncode:
        raise RuntimeError("Missing expected integration head: "+ref)
    comparison=inspect(BASE_REF,ref)
    independent.append({"branch":label,"base":"main",
                        "clean":comparison["clean"],
                        "conflictFiles":comparison["conflictFiles"]})

# Synthetic composite starts with CC, then main, finance, Balcão, AI,
# responsive layout and professor search. No PR commit changes.
current=git("rev-parse",CC_REF,check=True).stdout.strip()
steps=[]
for label,ref in [("main",BASE_REF),*branches]:
    other=git("rev-parse",ref,check=True).stdout.strip()
    status=inspect(current,other)
    mode="clean"
    if not status["clean"]:
        if status["unknownConflict"] or not status["conflictFiles"] or not set(status["conflictFiles"]) <= known_conflicts:
            raise RuntimeError("Unexpected merge-tree conflict in "+label+":"+
                               ",".join(status["conflictFiles"]))
        # A simulated code tree can be built for combined tests. This is NOT
        # authorised resolution for a GitHub PR: all such paths remain gates
        # and must be reconciled by approved, reviewed production changes.
        trial=git("merge-tree","--write-tree","-Xours",current,other)
        if trial.returncode:
            raise RuntimeError("Even synthetic -Xours tree cannot be built for "+label)
        tree=trial.stdout.splitlines()[0]
        mode="simulation_ours_REQUIRES_REVIEW"
    else:
        tree=status["tree"]
    if not re.fullmatch(r"[0-9a-f]{40}",tree or ""):
        raise RuntimeError("No complete tree returned for "+label)
    commit=git("-c","commit.gpgsign=false","commit-tree",tree,"-p",current,"-p",other,"-m","Synthetic disposable integration",check=True).stdout.strip()
    steps.append({"name":label,"conflictFiles":status["conflictFiles"],
                  "simulatedResolution":mode,"commit":commit[:12]})
    current=commit

report={
 "kind":"disposable-merge-tree-rehearsal",
 "integrationOrder":["CC stacked","main",*[x[0] for x in branches]],
 "independent":independent,
 "combined":steps,
 "simulatedHead":current[:12],
 "requiresManualReview":sorted(set(
     path for step in steps for path in step["conflictFiles"])),
 "note":"-Xours only in disposable synthetic tree. Does NOT resolve production GitHub PR conflicts or authorise merge.",
}
with open("/tmp/cc-d-integration-report.json","w") as f:
    json.dump(report,f,indent=2);f.write("\n")
with open("/tmp/cc-d-composite-sha.txt","w") as f:
    f.write(current+"\n")
print(json.dumps({k:v for k,v in report.items() if k!="combined"}))
print("COMPOSITE_STEPS",json.dumps(steps))
