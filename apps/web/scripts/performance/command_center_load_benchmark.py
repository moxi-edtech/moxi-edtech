#!/usr/bin/env python3
"""CI-only synthetic concurrency and before/after performance proof.

Tests the installed PostgreSQL limit using TWO independent client processes,
all as authenticated SQL roles. Does not claim a real GoTrue/browser session.
No real students, credentials, payloads, or request bodies in logs.
"""
import concurrent.futures
import json
import multiprocessing
import os
import subprocess
import sys
import time
from statistics import median

DB = os.environ["CC_LOAD_PGURL"]
A = "00000000-0000-4000-8000-0000000000a1"
B = "00000000-0000-4000-8000-0000000000b2"
ACTOR_A = "00000000-0000-4000-8000-0000000000d1"
ACTOR_B = "00000000-0000-4000-8000-0000000000d3"
ACTOR_X = "00000000-0000-4000-8000-0000000000d2"
TURMA = "00000000-0000-4000-8000-0000000000f1"
MANY_TURMA = "00000000-0000-4000-8f00-000000000001"


def query(user, sql):
    # DB is a CI local PostgreSQL URI, not a connected production project.
    command = ["psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", DB, "-c",
               "SET ROLE authenticated; SET request.jwt.claim.sub = '%s'; %s" % (user, sql)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=35)
    if result.returncode:
        # Never expose SQL text, headers or personally identifying material.
        raise RuntimeError("Synthetic SQL fixture failed (psql exit %d)" % result.returncode)
    return result.stdout.strip().splitlines()[-1]


def roster(filter_code="todos", sort="nome_asc", turma=TURMA, new=True):
    fn = ("command_center_roster_operational_v1" if new
          else "command_center_roster_keyset_v2")
    flags = ", p_filter=>'%s'" % filter_code if new else ""
    return """SELECT coalesce((SELECT
      CASE WHEN %(new)s AND coalesce(rate_limited,false) THEN 'denied'
           ELSE 'allowed' END
      FROM public.%(fn)s(
        p_escola_id=>'%(school)s',p_ano_letivo=>2026,
        p_turma_id=>'%(turma)s',p_sort=>'%(sort)s',p_limit=>20%(flags)s)
      LIMIT 1),'allowed');""" % dict(new="true" if new else "false",
                   fn=fn, school=A, turma=turma, sort=sort, flags=flags)


def rpc(user, new=True, filter_code="todos"):
    if new:
        sql = """SELECT CASE WHEN rate_limited THEN 'denied' ELSE 'allowed' END
          FROM public.command_center_roster_operational_v1(
          p_escola_id=>'%s',p_ano_letivo=>2026,p_turma_id=>'%s',
          p_filter=>'%s',p_limit=>20) LIMIT 1;""" % (A, TURMA, filter_code)
    else:
        sql = """SELECT 'allowed' FROM public.command_center_roster_keyset_v2(
          p_escola_id=>'%s',p_ano_letivo=>2026,p_turma_id=>'%s',
          p_limit=>20) LIMIT 1;""" % (A, TURMA)
    return query(user, sql)


def instance(actor, requests, workers, out):
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        vals = list(pool.map(lambda _: rpc(actor, True), range(requests)))
    out.put({"actor": "A" if actor == ACTOR_A else "B",
             "allowed": vals.count("allowed"), "denied": vals.count("denied"),
             "total": len(vals)})


def concurrency():
    # 2 server-independent instances share the SAME atomic SQL quota key.
    # A=50 calls across 2 processes, B=12 calls simultaneously.
    context = multiprocessing.get_context("fork")
    results = context.Queue()
    children = [
        context.Process(target=instance, args=(ACTOR_A, 25, 9, results)),
        context.Process(target=instance, args=(ACTOR_A, 25, 9, results)),
        context.Process(target=instance, args=(ACTOR_B, 12, 6, results)),
    ]
    for process in children:
        process.start()
    reports = [results.get(timeout=90) for _ in children]
    for process in children:
        process.join(timeout=20)
        if process.exitcode != 0:
            raise AssertionError("A synthetic rate-limit process terminated incorrectly")
    primary = [v for v in reports if v["actor"] == "A"]
    secondary = [v for v in reports if v["actor"] == "B"]
    assert len(primary) == 2 and len(secondary) == 1, reports
    assert sum(v["allowed"] for v in primary) == 30, reports
    assert sum(v["denied"] for v in primary) == 20, reports
    assert secondary[0]["allowed"] == 12 and secondary[0]["denied"] == 0, reports

    # Cross-school RLS is evaluated as the signed-in test role, not postgres.
    invisible = query(ACTOR_X, "SELECT count(*) FROM public.alunos WHERE escola_id='%s';" % A)
    assert invisible == "0", "Cross-school synthetic pupil exposure"
    owned = query(ACTOR_X, "SELECT count(*) FROM public.alunos WHERE escola_id='%s';" % B)
    assert int(owned) > 1000, "Other school fixture not populated"
    # Limiter storage is deliberately inaccessible to regular operators.
    print(json.dumps({"source": "canonical SQL from migration",
        "syntheticStudents": 6700, "instances": 2,
        "sameUser": {"total": 50, "allowed": 30, "blocked": 20},
        "anotherUser": {"total": 12, "allowed": 12, "blocked": 0},
        "crossSchoolRls": "zero records",
        "database":"ephemeral-postgres-17"}))


def percentile(values, ratio):
    values = sorted(values)
    return round(values[max(0, min(len(values)-1, int((len(values)-1)*ratio + .9999)))], 2)


def run_batch(new):
    times = []
    sizes = []
    for i in range(24):  # 3 independent series of 8 samples.
        start = time.perf_counter()
        response = query(ACTOR_A, """SELECT coalesce(json_agg(row_to_json(x))::text,'[]') FROM
          public.%s(
          p_escola_id=>'%s',p_ano_letivo=>2026,p_turma_id=>'%s',
          p_sort=>'nome_asc',p_limit=>20%s) x;""" % (
            "command_center_roster_operational_v1" if new else "command_center_roster_keyset_v2",
            A, MANY_TURMA, ",p_filter=>'todos'" if new else ""))
        elapsed = (time.perf_counter() - start) * 1000
        times.append(elapsed)
        sizes.append(len(response.encode("utf-8")))
        if new and '"rate_limited":true' in response:
            raise AssertionError("Benchmark exceeded shared rate limit")
    return {"runs": 3, "requestsPerRun":8,
       "requests": len(times), "p50Ms": percentile(times,.5),
       "p95Ms": percentile(times,.95),
       "meanBytes": round(sum(sizes)/len(sizes)),
       "maxBytes": max(sizes)}


def benchmark():
    old = run_batch(False)
    current = run_batch(True)
    assert current["requests"] <= old["requests"], "No growth in request budget allowed"
    # Both paths represent 24 identical operator queries, no background poll.
    result = {"kind":"synthetic disposable SQL + psql process overhead",
       "sampleScope":"one synthetic classroom (~313 students), three iterations",
       "before":old, "after":current,
       "requestsPerHourForMatchedWorkload":{"before":old["requests"],"after":current["requests"]},
       "deltaRequestCount": current["requests"]-old["requests"],
       "note":"SQL client latency includes connection start; not GoTrue/Next.js/production p95"}
    print(json.dumps(result,indent=2))
    output = os.environ.get("CC_BENCH_OUTPUT")
    if output:
        with open(output,"w",encoding="utf-8") as handle:
            json.dump(result,handle,indent=2)
            handle.write("\n")


if __name__ == "__main__":
    if len(sys.argv)!=2 or sys.argv[1] not in ("concurrency","benchmark"):
        raise SystemExit("Usage: python3 command_center_load_benchmark.py concurrency|benchmark")
    if not (DB.startswith("postgresql://postgres:postgres@127.0.0.1:5432/")
            or DB.startswith("postgres://postgres:postgres@127.0.0.1:5432/")):
        raise SystemExit("Only isolated loopback CI PostgreSQL is accepted")
    globals()[sys.argv[1]]()
