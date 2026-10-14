import assert from "node:assert/strict";
import test from "node:test";
import {
  RETURN_STUDENT_PARAM,
  readBalcaoStudentId,
  setBalcaoLocationContext,
} from "../../src/lib/balcao/return-context";

test("enrollment preserves a suspended student but never makes that student the new enrollment target", () => {
  const context = setBalcaoLocationContext(
    new URLSearchParams("alunoId=aluno-contexto&other=keep"), "aluno-contexto", "enrollment"
  );
  assert.equal(context.get("alunoId"), null);
  assert.equal(context.get(RETURN_STUDENT_PARAM), "aluno-contexto");
  assert.equal(context.get("other"), "keep");
  assert.equal(readBalcaoStudentId(context, "enrollment"), "aluno-contexto");
});

test("returning to desk restores student context and clears enrollment-only state", () => {
  const entered = setBalcaoLocationContext(new URLSearchParams(), "aluno-ficticio", "enrollment");
  const returned = setBalcaoLocationContext(entered, readBalcaoStudentId(entered, "enrollment"), "desk");
  assert.equal(returned.get("alunoId"), "aluno-ficticio");
  assert.equal(returned.has(RETURN_STUDENT_PARAM), false);
  assert.equal(returned.has("action"), false);
});

test("switching to no student cannot leak the previous student's identifier", () => {
  const oldContext = new URLSearchParams("alunoId=aluno-antigo&atendimentoAlunoId=aluno-suspenso");
  const reset = setBalcaoLocationContext(oldContext, null, "desk");
  assert.equal(reset.has("alunoId"), false);
  assert.equal(reset.has(RETURN_STUDENT_PARAM), false);
});
