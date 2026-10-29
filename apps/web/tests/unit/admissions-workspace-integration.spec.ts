import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BALCAO_ACTION_REGISTRY, buildBalcaoActionHref } from "../../src/lib/balcao/action-registry";
import { readBalcaoStudentId, setBalcaoLocationContext } from "../../src/lib/balcao/return-context";

const read = (path: string) => readFileSync(`src/${path}`, "utf8");
const panel = read("components/secretaria/command-center/CommandCenterPanel.tsx");
const page = read("app/secretaria/balcao/BalcaoPageClient.tsx");
const retained = read("components/secretaria/command-center/RetainedActionPanels.tsx");
const inbox = read("components/secretaria/AdmissoesInboxClient.tsx");

test("admissões é operação canónica autónoma, dentro do Workspace", () => {
  assert.equal(BALCAO_ACTION_REGISTRY.admissions.requiresStudent, false);
  assert.equal(BALCAO_ACTION_REGISTRY.admissions.panel, "admissions");
  assert.match(panel, /dynamic\(\(\) => import\("@\/components\/secretaria\/AdmissoesInboxClient"\)/);
  assert.match(panel, /onNewAdmission=\{\(\) => onActionChange\("enrollment"\)\}/);
  assert.match(page, /activeAction === "admissions"/);
});

test("a fila carrega apenas quando visível e não mantém pedidos em segundo plano", () => {
  assert.match(retained, /action !== "admissions" \|\| activeAction === "admissions"/);
  assert.match(inbox, /dedupingInterval: 15000/);
  assert.match(inbox, /revalidateOnFocus: false/);
  assert.match(inbox, /if \(!hasSelectedCandidate\) return/);
  assert.match(inbox, /isConversionOpen && <AdmissaoConversionSheet/);
});

test("selecionar candidato não altera o URL do atendimento e cancela leituras obsoletas", () => {
  assert.match(inbox, /if \(!embedded\) \{/);
  assert.match(inbox, /new AbortController\(\)/);
  assert.match(inbox, /return \(\) => controller\.abort\(\)/);
  assert.match(inbox, /toastErrorRef\.current/);
  assert.match(panel, /inModal=\{inModal\}/);
});

test("admissões preserva o aluno anterior, enquanto nova matrícula começa sem aluno", () => {
  const original = new URLSearchParams("alunoId=aluno-123&ano_letivo_id=ano-1");
  const inboxParams = setBalcaoLocationContext(original, "aluno-123", "admissions");
  assert.equal(readBalcaoStudentId(inboxParams, "admissions"), "aluno-123");
  assert.equal(inboxParams.get("action"), "admissions");

  const enrollmentParams = setBalcaoLocationContext(inboxParams, "aluno-123", "enrollment");
  assert.equal(enrollmentParams.has("alunoId"), false);
  assert.equal(enrollmentParams.get("atendimentoAlunoId"), "aluno-123");
  assert.equal(enrollmentParams.get("ano_letivo_id"), "ano-1");

  const href = buildBalcaoActionHref({ escolaParam: "escola-demo", actionId: "admissions" });
  assert.match(href, /action=admissions/);
});

test("a fila inicia em Todas e permite filtrar sem mudar os contratos académicos", () => {
  const radar = read("app/api/secretaria/admissoes/radar/route.ts");
  assert.match(radar, /'all'/);
  assert.match(inbox, /useState<[^\n]+>\('all'\)/);
  assert.match(inbox, /statusFilter === 'all'/);
  assert.match(inbox, /label: 'Todas'/);
  assert.match(inbox, /Partilhar link de inscrição/);
  assert.match(inbox, /Indicadores e oportunidades/);
});

test("o detalhe tem navegação contextual e protege ações de decisão", () => {
  assert.match(inbox, /role="tablist" aria-label="Detalhes da candidatura"/);
  assert.match(inbox, /role="tab"/);
  assert.match(inbox, /detailTab === 'resumo'/);
  assert.match(inbox, /detailTab === 'documentos'/);
  assert.match(inbox, /detailTab === 'historico'/);
  assert.match(inbox, /title: 'Aprovar candidatura'/);
  assert.match(inbox, /if \(!approved\) return/);
  assert.match(inbox, /Mais ações/);
  assert.match(inbox, /onClick=\{handleReject\}/);
  assert.match(inbox, /onClick=\{openPendenciasModal\}/);
});

test("admissões usa as superfícies neutras do Workspace nos dois temas", () => {
  const conversion = read("components/secretaria/AdmissaoConversionSheet.tsx");
  const fixedNeutral = /\b(?:bg|hover:bg|focus:bg)-(?:white|slate|gray|zinc)-(?:50|100|200|300|400|500|600|700|800|900|950)\b|\bbg-white\b|\b(?:text|border|ring|hover:text|hover:border)-(?:slate|gray|zinc)-(?:[1-9]00|950)\b/;
  for (const [label, source] of [["Fila de admissões", inbox], ["Conversão em matrícula", conversion]] as const) {
    assert.doesNotMatch(source, fixedNeutral, label);
    assert.match(source, /bg-card/);
    assert.match(source, /border-border/);
    assert.match(source, /text-foreground/);
    assert.match(source, /text-muted-foreground/);
  }
  assert.match(inbox, /dark:bg-amber-500\/15/);
  assert.match(inbox, /dark:text-rose-300/);
  assert.match(conversion, /dark:bg-blue-500\/10/);
  assert.match(conversion, /bg-amber text-amber-950/);
});

test("modais de Admissões aparecem sobre o Workspace e mantêm o tema global", () => {
  const conversion = read("components/secretaria/AdmissaoConversionSheet.tsx");
  assert.match(inbox, /createPortal\(/);
  assert.match(inbox, /document\.body/);
  assert.match(inbox, /z-\[90\]/);
  assert.match(conversion, /overlayClassName=\{elevated \? "z-\[90\]" : undefined\}/);
  assert.match(conversion, /bg-card text-foreground/);
});

test("nova candidatura herda a paleta do Balcão em todas as três etapas", () => {
  const wizard = read("components/secretaria/AdmissaoWizardClient.tsx");
  const fixedNeutral = /\bbg-white\b|\bbg-slate-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?\b|\b(?:text|border|ring|disabled:bg|disabled:text)-(?:slate|gray|zinc)-(?:[1-9]00|950)\b/;
  assert.doesNotMatch(wizard, fixedNeutral);
  assert.match(wizard, /bg-card/);
  assert.match(wizard, /text-foreground/);
  assert.match(wizard, /border-border/);
  assert.match(wizard, /text-amber-950/);
  assert.match(wizard, /dark:bg-rose-500\/10/);
});

test("confirmação global e exceção de capacidade ultrapassam a janela modal", () => {
  const dialog = read("components/ui/dialog.tsx");
  const feedback = read("components/feedback/FeedbackSystem.tsx");
  const conversion = read("components/secretaria/AdmissaoConversionSheet.tsx");
  assert.match(dialog, /overlayClassName\?: string/);
  assert.match(dialog, /<DialogOverlay className=\{overlayClassName\}/);
  assert.match(feedback, /overlayClassName="z-\[110\]"/);
  assert.match(conversion, /<DialogTitle className="text-base font-bold text-foreground">Turma acima da capacidade/);
  assert.match(conversion, /overlayClassName="z-\[110\]"/);
});

test("avisos operacionais seguem o mesmo tema das candidaturas", () => {
  const feedback = read("components/feedback/FeedbackSystem.tsx");
  const start = feedback.indexOf("const TOAST_CONFIG:");
  const end = feedback.indexOf("function ToastStack()", start);
  assert.ok(start >= 0 && end > start);
  const toasts = feedback.slice(start, end);
  assert.doesNotMatch(toasts, /\bbg-white\b|\bbg-slate-\d+\b|\btext-slate-\d+\b|\bborder-slate-\d+\b/);
  assert.match(toasts, /bg-card\/95/);
  assert.match(toasts, /text-foreground/);
  assert.match(toasts, /text-muted-foreground/);
  assert.match(feedback, /overlayClassName="z-\[110\]"/);
});

test("guardar não conclui matrícula nem fecha o atendimento", () => {
  const conversion = read("components/secretaria/AdmissaoConversionSheet.tsx");
  const saveStart = conversion.indexOf("const handleSaveOnly = async");
  const saveEnd = conversion.indexOf("const handleEfetivar = async", saveStart);
  const saveOnly = conversion.slice(saveStart, saveEnd);
  assert.ok(saveStart > 0 && saveEnd > saveStart);
  assert.match(saveOnly, /await onSaved\?\.\(\)/);
  assert.doesNotMatch(saveOnly, /onSuccess\(|onClose\(/);
  assert.match(inbox, /onSaved=\{handleConversionSaved\}/);
  assert.match(inbox, /const handleCloseConversion = useCallback\(\(\) => \{\s*setIsConversionOpen\(false\)/);
});

test("conclusão e arquivo preservam candidato até ação explícita", () => {
  assert.match(inbox, /setCompletedCandidateId\(selectedId\)/);
  assert.match(inbox, /const handleNextCandidate = useCallback/);
  assert.match(inbox, /case 'next_candidate':\\s*handleNextCandidate\\(\\)/);
  assert.match(inbox, /onClick=\\{handleNextAction\\}/);
  assert.match(inbox, /completedCandidateId === selectedId \\? 'matriculado'/);
  assert.match(inbox, /detailRevision/);
  assert.doesNotMatch(inbox, /setSelectedId\(filteredItems\[currentIndex \+ 1\]\.id\)/);
  const archiveStart = inbox.indexOf("const handleArchive = async");
  const archiveEnd = inbox.indexOf("const openPendenciasModal =", archiveStart);
  const archive = inbox.slice(archiveStart, archiveEnd);
  assert.ok(archiveStart > 0 && archiveEnd > archiveStart);
  assert.doesNotMatch(archive, /setSelectedId\(null\)/);
  assert.match(archive, /setSelectedData/);
});


test("erros de recibo e duplicidade conservam o contexto da matrícula", () => {
  const wizard = read("components/secretaria/AdmissaoWizardClient.tsx");
  assert.match(wizard, /if \(embedded\) setPostActionDocumentError/);
  assert.match(wizard, /postActionDocumentError &&/);
  assert.match(wizard, /if \(embedded\) \{\s*onReset\(\);\s*onActionChange\?\.\("admissions"\);/);
});


test("recibo em preparação ou erro mantém consulta recuperável pelo pagamento", () => {
  const conversion = read("components/secretaria/AdmissaoConversionSheet.tsx");
  const wizard = read("components/secretaria/AdmissaoWizardClient.tsx");
  assert.match(conversion, /pagamentoId: json\.pagamento_id \?\? null/);
  assert.match(conversion, /<AdmissionReceiptRecovery pagamentoId=\{enrollmentResult\.pagamentoId\}/);
  assert.match(wizard, /result\.pagamento_id && !result\.recibo\?\.ok/);
  assert.match(wizard, /<AdmissionReceiptRecovery pagamentoId=\{result\.pagamento_id\}/);
});

test("diálogos de duplicidade e ações pós-matrícula ficam acima do Balcão", () => {
  const wizard = read("components/secretaria/AdmissaoWizardClient.tsx");
  const postAction = read("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(wizard, /elevated=\{embedded\}/);
  assert.match(wizard, /overlayClassName=\{elevated \? "z-\[110\]" : undefined\}/);
  assert.match(postAction, /overlayClassName=\{elevated \? "z-\[110\]" : undefined\}/);
  assert.match(postAction, /bg-card text-foreground/);
  assert.doesNotMatch(postAction, /#(?:1F6B3B|E3B23C)\b/i);
});

test("decreto permanece fonte única de calendário; Balcão não escreve trimestres ou datas", () => {
  const resolver = read("components/secretaria/AdmissionCalendarResolution.tsx");
  const conversion = read("components/secretaria/AdmissaoConversionSheet.tsx");
  const wizard = read("components/secretaria/AdmissaoWizardClient.tsx");
  assert.match(resolver, /calendário é herdado da fonte oficial/);
  assert.match(resolver, /sincronização do decreto/);
  assert.match(resolver, /Rever turma/);
  assert.doesNotMatch(resolver, /aplicar-template|admin\/calendario\/ajustes|upsert_bulk_periodos_letivos/);
  assert.doesNotMatch(resolver, /fetch\(|\.from\(|\.rpc\(/);
  assert.match(conversion, /<AdmissionCalendarResolution/);
  assert.match(wizard, /<AdmissionCalendarResolution/);
  assert.match(wizard, /result\.action\?\.id === "open_academic_calendar" && !embedded/);
  assert.doesNotMatch(wizard, /Atualize a página e retome o rascunho/);
});
