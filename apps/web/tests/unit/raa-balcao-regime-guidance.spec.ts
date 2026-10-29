import test from "node:test";
import assert from "node:assert/strict";
import { resolveRaaDecretoEligibility, type RaaDecretoDisciplina, type RaaDecretoRegime } from "../../src/lib/academico/raa-decreto-eligibility";
import { buildRaaBalcaoRegimeGuidance, type RaaBalcaoRegime } from "../../src/lib/rematricula/raa-balcao-regime-guidance";

const d=(id:string,n:number,extra:Partial<RaaDecretoDisciplina>={}):RaaDecretoDisciplina=>({id,nome:id,notaFinal:n,...extra});
const make=(regime:RaaDecretoRegime,disciplinas:RaaDecretoDisciplina[],extras:Record<string,unknown>={})=>
  resolveRaaDecretoEligibility({regime,disciplinas,...extras});
const stage=(key:RaaDecretoRegime):RaaBalcaoRegime=>
  key.startsWith("classe_") ? {nivel_ensino:"secundario",classe_num:Number(key.split("_")[1])}
    : key.startsWith("eja_modulo_") ? {nivel_ensino:"eja",modulo_numero:Number(key.split("_")[2])}
      : {nivel_ensino:"eja",ano_numero:Number(key.split("_")[2])};
const guidance=(r:RaaDecretoRegime,ds:RaaDecretoDisciplina[],extras:Record<string,unknown>={})=>{
  const decreto=make(r,ds,extras);
  return {decreto, ui:buildRaaBalcaoRegimeGuidance({regime:stage(r),decreto,eligible:!decreto.efetivacaoMatriculaBloqueada})!};
};

test("12 regimes: a orientação identifica cada origem e não inventa a conclusão",()=>{
  const regimes:RaaDecretoRegime[]=["classe_6","classe_7","classe_8","classe_9","classe_10","classe_11","classe_12","eja_modulo_1","eja_modulo_2","eja_modulo_3","eja_ano_1","eja_ano_2"];
  for (const regime of regimes) {
    const isModule=regime.startsWith("eja_modulo_");
    const {ui,decreto}=guidance(regime,isModule?[{id:"area",nome:"Area",suficiente:true}]:[d("hist",15)],
      isModule?{frequenciaAnual:{aulasFrequentadas:80,aulasPrevistas:100}}:{});
    assert.equal(ui.origem,"decreto",regime);
    assert.ok(ui.regime.includes(regime.startsWith("eja")?"EJA":regime.split("_")[1]+".ª"),regime);
    assert.ok(ui.baseLegal,regime);
    assert.equal(ui.decision,decreto.decision,regime);
    if (decreto.decision==="concluiu") {
      assert.equal(ui.estado,"concluido",regime);
      assert.equal(ui.podeEfetivar,false,regime);
    }
  }
});

test("condicional: 7.ª/10.ª autorizadas; 8.ª/11.ª e EJA 1.º ano bloqueados",()=>{
  const cases:[RaaDecretoRegime,boolean][]=[
    ["classe_7",true],["classe_8",false],["classe_10",true],["classe_11",false],["eja_ano_1",false],
  ];
  for (const [regime,expected] of cases) {
    const {ui,decreto}=guidance(regime,[d("hist",8)]);
    assert.equal(decreto.decision,"inscricao_condicional",regime);
    assert.equal(ui.podeEfetivar,expected,regime);
    assert.equal(ui.estado,expected?"condicional_autorizada":"bloqueado",regime);
    assert.match(ui.descricao,/condicional/i,regime);
  }
});

test("6.ª/9.ª/12.ª recurso não efetiva matrícula",()=>{
  for (const regime of ["classe_6","classe_9","classe_12"] as const) {
    const {decreto,ui}=guidance(regime,regime==="classe_6"?[d("hist",3),d("geo",4)]:[d("hist",7)]);
    assert.equal(decreto.decision,"recurso");
    assert.equal(ui.estado,"bloqueado");
    assert.equal(ui.podeEfetivar,false);
  }
});

test("EJA: dois terços de frequência e módulo 3 qualitativo vs. numérico",()=>{
  const freq=guidance("eja_modulo_1",[{id:"area",nome:"Area",suficiente:true}],
    {frequenciaAnual:{aulasFrequentadas:60,aulasPrevistas:100}});
  assert.equal(freq.decreto.motivo,"frequencia_eja");
  assert.match(freq.ui.descricao,/dois terços/i);
  assert.equal(freq.ui.podeEfetivar,false);
  const mod3=guidance("eja_modulo_3",[{id:"area",nome:"Area",suficiente:true}],
    {frequenciaAnual:{aulasFrequentadas:80,aulasPrevistas:100}});
  assert.equal(mod3.ui.estado,"concluido");
  const mod3Numerico=guidance("eja_modulo_3",[d("hist",4),d("port",12)]);
  assert.equal(mod3Numerico.decreto.decision,"recurso");
  assert.equal(mod3Numerico.ui.estado,"bloqueado");
});

test("faltas trimestrais e indisciplina nunca libertam a matrícula",()=>{
  const faltas=guidance("classe_8",[d("hist",14,{temposSemanais:1,faltasInjustificadasPorTrimestre:[3]})]);
  assert.equal(faltas.ui.estado,"bloqueado");
  assert.match(faltas.ui.descricao,/trimestre/i);
  const indisciplina=guidance("classe_10",[d("hist",14)],{indisciplinaGrave:true});
  assert.equal(indisciplina.ui.estado,"bloqueado");
  assert.match(indisciplina.ui.instrucao,/direção/i);
});

test("sem decreto, a UI não presume autorização para EJA ou classes não mapeadas",()=>{
  const cases=[
    {regime:{nivel_ensino:"eja",modulo_numero:2},decision:"transitou",eligible:true},
    {regime:{nivel_ensino:"primario",classe_num:5},decision:"inscricao_condicional",eligible:true},
    {regime:{nivel_ensino:"secundario",classe_num:7},decision:"inscricao_condicional",eligible:true},
  ];
  for (const academic of cases) {
    const ui=buildRaaBalcaoRegimeGuidance(academic)!;
    assert.equal(ui.origem,"sem_apuramento");
    assert.equal(ui.podeEfetivar,false);
    assert.equal(ui.baseLegal,null);
  }
});

test("incompleto e combinação proibida não são aprovação manual",()=>{
  const pendente=guidance("classe_12",[{id:"lp",nome:"LP",notaFinal:null}]);
  assert.equal(pendente.ui.estado,"pendente");
  assert.equal(pendente.ui.podeEfetivar,false);
  const proibido=guidance("classe_7",[
    d("lp",8,{linguaPortuguesa:true}),d("mat",8,{matematica:true}),
  ]);
  assert.equal(proibido.decreto.decision,"reprovado");
  assert.equal(proibido.ui.estado,"informativo");
  assert.equal(proibido.ui.podeEfetivar,false);
});
