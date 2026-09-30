import assert from "node:assert/strict";
import test from "node:test";

import { buildActivityDetails } from "../../src/lib/admin/activityFeedDetails";
import type { ActivityFeedItem } from "../../src/lib/admin/activityFeed";

function item(overrides: Partial<ActivityFeedItem> = {}): ActivityFeedItem {
  return {
    id: "event-id-interno",
    escola_id: "escola-id-interno",
    occurred_at: "2026-09-26T12:30:00.000Z",
    event_family: "secretaria",
    event_type: "MATRICULA_STATUS_ATUALIZADO",
    actor_name: "Operador KLASSE",
    headline: "Matrícula atualizada",
    subline: null,
    amount_kz: null,
    turma_nome: null,
    aluno_nome: null,
    priority: "importante",
    action_label: null,
    action_url: null,
    payload: {},
    ...overrides,
  };
}

test("produz detalhes úteis mesmo quando o payload está vazio", () => {
  const details = buildActivityDetails(item());
  const labels = details.map((detail) => detail.label);

  assert.ok(labels.includes("Operação"));
  assert.ok(labels.includes("Responsável"));
  assert.ok(labels.includes("Data e hora"));
  assert.ok(details.length >= 3);
});

test("transforma campos funcionais em linguagem legível", () => {
  const details = buildActivityDetails(item({
    aluno_nome: "Ana Manuel",
    turma_nome: "7.ª A",
    payload: {
      from_status: "pendente",
      to_status: "ativo",
      motivo: "Documentação validada pela secretaria",
      aluno_id: "uuid-que-nao-deve-aparecer",
      turma_id: "outro-uuid-interno",
    },
  }));

  assert.ok(details.some((detail) => detail.label === "Aluno" && detail.value === "Ana Manuel"));
  assert.ok(details.some((detail) => detail.label === "Estado" && detail.value === "Pendente → Ativo"));
  assert.ok(details.some((detail) => detail.label === "Motivo"));
});

test("não expõe IDs nem chaves técnicas do payload", () => {
  const details = buildActivityDetails(item({
    payload: {
      aluno_id: "aluno-interno",
      escola_id: "escola-interna",
      source_audit_log_id: 123,
      dedupe_key: "chave-tecnica",
    },
  }));
  const rendered = JSON.stringify(details);

  assert.doesNotMatch(rendered, /aluno-interno|escola-interna|source_audit|dedupe/i);
});
