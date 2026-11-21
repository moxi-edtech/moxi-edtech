import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const worker = read("inngest/functions/push-notifications.ts");
const signal = read("lib/notificacoes/signalCommittedPushNotifications.ts");

test("push notifications use a targeted Inngest event plus a five-minute recovery cron", () => {
  assert.match(worker, /event: "klasse\/notification\.push\.requested"/);
  assert.match(worker, /cron: "\*\/5 \* \* \* \*"/);
  assert.doesNotMatch(worker, /cron: "\* \* \* \* \*"/);
  assert.match(worker, /concurrency: 1/);
});

test("targeted events validate identifiers without falling back to an unrestricted scan", () => {
  assert.match(worker, /isTargetedEvent && \(!escolaId \|\| !eventoId/);
  assert.match(worker, /return \{ skipped: "invalid_event" \}/);
  assert.match(worker, /query\.eq\("escola_id", escolaId\)\.eq\("evento_id", eventoId\)/);
});

test("Web Push subscriptions must match the notification's tenant", () => {
  assert.match(worker, /\.eq\("user_id", notification\.destinatario_id\)/);
  assert.match(worker, /\.eq\("escola_id", notification\.escola_id\)/);
});

test("signal only sends opaque committed identifiers and never fails persistence", () => {
  assert.match(signal, /name: "klasse\/notification\.push\.requested"/);
  assert.match(signal, /data: \{ escolaId, eventoId \}/);
  assert.match(signal, /id: `klasse-push-\$\{eventoId\}`/);
  assert.match(signal, /catch \(error\)/);
  assert.doesNotMatch(signal, /titulo|corpo|destinatarioId|service_role/);
});

for (const role of ["Aluno", "Admin", "Financeiro", "Professor", "Secretaria"]) {
  test(`${role} notifications signal after persistence, once per event`, () => {
    const dispatcher = read(`lib/notificacoes/dispatch${role}Notificacao.ts`);
    const write = dispatcher.indexOf('.from("notificacoes").insert(inserts)');
    const signalCall = dispatcher.indexOf('await signalCommittedPushNotifications({ escolaId, eventoId: evento.id });');
    assert.ok(write >= 0, "expected canonical notification insert");
    assert.ok(signalCall > write, "Inngest must be signalled only after INSERT returns");
    assert.equal(dispatcher.match(/await signalCommittedPushNotifications\(/g)?.length, 1);
  });
}
