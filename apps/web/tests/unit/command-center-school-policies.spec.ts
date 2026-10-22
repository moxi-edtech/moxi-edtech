import test from "node:test";
import assert from "node:assert/strict";

import { resolveAcademicRule } from "../../src/lib/command-center/academic-rules";
import { resolveRosterExportPolicy, rosterExportAudit } from "../../src/lib/command-center/roster-export-policy";

const schoolA = "00000000-0000-4000-8000-0000000000a1";
const schoolB = "00000000-0000-4000-8000-0000000000b2";
const classe = "00000000-0000-4000-8000-0000000000c1";

test("CC-008: no school/class/type rule is a visible unavailable reason", () => {
  for(const invalid of [undefined, "", "{", "[]", '{"unknown":true}']) {
    const result = resolveAcademicRule(schoolA, classe, "novo", invalid);
    assert.equal(result.enabled,false);
    assert.match(result.reason,/configura|não foram aprovados/i);
  }
  const config=JSON.stringify({
    [schoolA]: { classes: {
      [classe]: { novo: {
        approved:true,
        requiredDocumentCodes:["codigo_documento_da_escola"],
        incompleteEnrollmentStatuses:["estado_aprovado_na_escola"],
      } },
    } },
  });
  const allowed=resolveAcademicRule(schoolA,classe,"novo",config);
  assert.equal(allowed.enabled,true);
  if(allowed.enabled){
    assert.deepEqual(allowed.rule.requiredDocumentCodes,["codigo_documento_da_escola"]);
    assert.deepEqual(allowed.rule.incompleteEnrollmentStatuses,["estado_aprovado_na_escola"]);
  }
  assert.equal(resolveAcademicRule(schoolB,classe,"novo",config).enabled,false);
  assert.equal(resolveAcademicRule(schoolA,classe,"transferido",config).enabled,false);
  assert.equal(resolveAcademicRule(schoolA,"00000000-0000-4000-8000-0000000000c2","novo",config).enabled,false);
});

test("CC-008: malformed, implicit, duplicate or empty rules never enable a filter", () => {
  const cases = [
    {approved:false, requiredDocumentCodes:["bi"], incompleteEnrollmentStatuses:["ativo"]},
    {approved:true, requiredDocumentCodes:[], incompleteEnrollmentStatuses:["ativo"]},
    {approved:true, requiredDocumentCodes:["bi","bi"], incompleteEnrollmentStatuses:["ativo"]},
    {approved:true, requiredDocumentCodes:["; DROP TABLE"], incompleteEnrollmentStatuses:["ativo"]},
    {approved:true, requiredDocumentCodes:["bi"], incompleteEnrollmentStatuses:[]},
  ];
  for(const rule of cases){
    assert.equal(resolveAcademicRule(schoolA,classe,"novo",JSON.stringify({
      [schoolA]:{classes:{[classe]:{novo:rule}}},
    })).enabled,false);
  }
});

test("CC-013: school-specific purpose and 1-30 day retention are mandatory", () => {
  const onlyLegacy=JSON.stringify({
    [schoolA]:{enabled:true,maxRows:50,roles:["secretaria"]},
  });
  assert.equal(resolveRosterExportPolicy(schoolA,onlyLegacy).enabled,false);
  for(const retentionDays of [0,31,-1,100,"30",null]){
    assert.equal(resolveRosterExportPolicy(schoolA,JSON.stringify({
      [schoolA]:{enabled:true,maxRows:50,roles:["secretaria"],
        purposeCode:"secretaria_atendimento",retentionDays},
    })).enabled,false);
  }
  const explicit=JSON.stringify({
    [schoolA]:{enabled:true,maxRows:50,roles:["secretaria"],
      purposeCode:"secretaria_atendimento",retentionDays:14},
  });
  const policy=resolveRosterExportPolicy(schoolA,explicit);
  assert.equal(policy.enabled,true);
  assert.equal(resolveRosterExportPolicy(schoolB,explicit).enabled,false);
  const audited=rosterExportAudit({
    userId:"synthetic-operator",escolaId:schoolA,type:"turma",
    entityId:"synthetic-turma",count:15,hasSearch:true,
    filter:"documentos_sinalizados",sort:"pendencias_primeiro",
    exportedAt:"2026-10-22T08:00:00.000Z",
    purposeCode:policy.purposeCode,retentionDays:policy.retentionDays,
  });
  assert.equal(audited.retention_until,"2026-11-05T08:00:00.000Z");
  assert.equal(audited.purpose_code,"secretaria_atendimento");
  assert.equal(audited.sort_code,"PENDING_FIRST");
  assert.doesNotMatch(JSON.stringify(audited),/aluno_nome|bi_numero|valor_pago_total|termo_pesquisa/);
});
