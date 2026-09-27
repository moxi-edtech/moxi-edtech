import * as fs from "fs";
import * as path from "path";
import { KLASSE_ROUTES } from "./route-registry";
import { ASSISTANT_ACTIONS } from "./action-registry";
import { KLASSE_HELP_TOPICS } from "../klasse-help/help-topics";
import { KnowledgeDocument, KnowledgeChunk } from "./knowledge-types";

// Path definitions relative to workspace root or current directory
const DOCS_DIR = path.join(__dirname, "docs");
const OUTPUT_FILE = path.join(__dirname, "knowledge-base-data.json");

/**
 * Módulo de cada documento em docs/, declarado à mão.
 *
 * Antes isto era inferido por substring do nome do ficheiro, com
 * `file.includes("ai")` sem fronteira de palavra e ANTES do ramo
 * `comunicados|documentos`. O resultado era silencioso e errado:
 * `tutoriais-alunos-turmas.md` casava em "tu-to-ri-ai-s" e ia para
 * `classe_ai` (o que fez dele o maior grupo do artefacto), e
 * `tutoriais-comunicados-documentos.md` nunca chegava ao ramo
 * `comunicacao` — motivo pelo qual não existia um único chunk
 * `comunicacao` na base. Como o boost de módulo em knowledge-search.ts
 * soma +5 no módulo certo e +1 em `any`, um documento mal classificado
 * não dá erro: perde o bónus e é ultrapassado pelos `any`.
 *
 * As outras três fontes (route-registry, action-registry, help-topics)
 * já declaram `module: "any"` de forma explícita. Isto alinha os docs.
 *
 * Um ficheiro sem entrada cai em `any` e emite aviso, tal como já
 * acontece com rotas sem descrição e tópicos sem roles.
 */
export const MODULE_BY_DOC_FILE: Record<string, KnowledgeDocument["module"]> = {
  "manual-geral-klasse.md": "any",
  "manual-secretaria.md": "secretaria",
  "regras-negocio-secretaria.md": "secretaria",
  "manual-financeiro.md": "financeiro",
  "regras-negocio-financeiro.md": "financeiro",
  "regras-negocio-academico.md": "academico",
  "regras-negocio-estrutura.md": "academico",
  // O documento intitula-se "gestão académica dos estudantes" e as suas
  // secções próprias (validação de lançamento em períodos encerrados,
  // impacto das faltas na aprovação) são regras académicas. Cadastro e
  // enturmação já estão cobertos por manual/regras de secretaria.
  "tutoriais-alunos-turmas.md": "academico",
  "tutoriais-comunicados-documentos.md": "comunicacao",
  "manual-whatsapp-utility.md": "whatsapp",
  "regras-negocio-ia-whatsapp.md": "whatsapp",
  "manual-central-acoes-ai.md": "classe_ai",
  "readme-klasse-ai.md": "classe_ai",
  "plano-actions-v2.md": "any",
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function chunkContent(docId: string, module: any, text: string, documentTitle: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const lines = text.split("\n");
  let currentChunkText = "";
  let chunkIndex = 0;
  let currentHeader = "";

  for (const line of lines) {
    if (line.startsWith("#")) {
      // If we have existing content, push it as a chunk first
      if (currentChunkText.trim()) {
        chunks.push({
          id: `${docId}-chunk-${chunkIndex}`,
          documentId: docId,
          schoolId: null,
          module,
          chunkIndex,
          content: currentChunkText.trim(),
          metadata: {
            title: documentTitle,
            section: currentHeader || "Intro",
          },
        });
        chunkIndex++;
        currentChunkText = "";
      }
      currentHeader = line.replace(/#/g, "").trim();
    }

    currentChunkText += line + "\n";

    // Limit chunk size to ~1000 characters
    if (currentChunkText.length > 1000) {
      chunks.push({
        id: `${docId}-chunk-${chunkIndex}`,
        documentId: docId,
        schoolId: null,
        module,
        chunkIndex,
        content: currentChunkText.trim(),
        metadata: {
          title: documentTitle,
          section: currentHeader || "General",
        },
      });
      chunkIndex++;
      currentChunkText = "";
    }
  }

  // Push remaining content
  if (currentChunkText.trim()) {
    chunks.push({
      id: `${docId}-chunk-${chunkIndex}`,
      documentId: docId,
      schoolId: null,
      module,
      chunkIndex,
      content: currentChunkText.trim(),
      metadata: {
        title: documentTitle,
        section: currentHeader || "General",
      },
    });
  }

  return chunks;
}

export function buildKnowledgeBase() {
  console.log("=== INICIANDO CONSTRUÇÃO DO KLASSE BRAIN ===");

  const documents: KnowledgeDocument[] = [];
  const chunks: KnowledgeChunk[] = [];

  // 1. Process Route Registry
  console.log("Processando Route Registry...");
  const routeDocId = "doc-routes-registry";
  let routeContent = "# Rotas do Sistema KLASSE\n\nEste é o registro oficial de rotas do sistema KLASSE:\n\n";

  for (const route of KLASSE_ROUTES) {
    // Validation: report routes without description
    if (!route.description) {
      console.warn(`[AVISO] Rota sem descrição: ${route.key}`);
    }

    const hrefExample = route.href("ID_DA_ESCOLA", { alunoId: "ID_DO_ALUNO" });
    const routeText = `- **${route.title}** (Chave: \`${route.key}\`, Módulo: \`${route.module}\`):
  Descrição: ${route.description}
  Nomes/Aliases: ${route.aliases.join(", ")}
  Função URL: \`${hrefExample}\`
  Perfis com acesso: ${route.roles.join(", ")}`;

    routeContent += routeText + "\n\n";
  }

  documents.push({
    id: routeDocId,
    title: "Route Registry Oficial",
    sourceType: "registry",
    sourcePath: "lib/assistant/route-registry.ts",
    module: "any",
    content: routeContent,
    status: "active",
  });

  chunks.push(...chunkContent(routeDocId, "any", routeContent, "Route Registry"));

  // 2. Process Action Registry
  console.log("Processando Action Registry...");
  const actionDocId = "doc-actions-registry";
  let actionContent = "# Ações Disponíveis do Assistente KLASSE\n\nEste é o catálogo de ações oficiais que a IA pode sugerir:\n\n";

  for (const action of ASSISTANT_ACTIONS) {
    const actionText = `- **${action.title}** (Chave: \`${action.key}\`, Módulo: \`${action.module}\`):
  Descrição: ${action.description}
  Tipo de ação: ${action.actionType}
  Nível de Risco: ${action.riskLevel}
  Exige Confirmação: ${action.requiresApproval ? "Sim" : "Não"}
  Perfis autorizados: ${action.roles.join(", ")}`;
    actionContent += actionText + "\n\n";
  }

  documents.push({
    id: actionDocId,
    title: "Action Registry Oficial",
    sourceType: "registry",
    sourcePath: "lib/assistant/action-registry.ts",
    module: "any",
    content: actionContent,
    status: "active",
  });

  chunks.push(...chunkContent(actionDocId, "any", actionContent, "Action Registry"));

  // 3. Process Help Topics
  console.log("Processando Help Topics...");
  const helpDocId = "doc-help-topics";
  let helpContent = "# Tópicos de Ajuda do KLASSE\n\n";

  for (const topic of KLASSE_HELP_TOPICS) {
    // Validation: report topics without role
    if (!topic.roles || topic.roles.length === 0) {
      console.warn(`[AVISO] Tópico de ajuda sem papéis (roles) associados: ${topic.key}`);
    }

    const topicText = `## ${topic.title} (Categoria: ${topic.category})
Chave: ${topic.key}
Aliases: ${topic.aliases.join(", ")}
Papéis com acesso: ${(topic.roles ?? []).join(", ")}
Resposta: ${topic.answer}
Passo a passo:
${topic.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}
`;
    helpContent += topicText + "\n\n";

    // Chunk individual topics to make search precise
    const singleTopicDocId = `topic-${topic.key}`;
    documents.push({
      id: singleTopicDocId,
      title: `Ajuda: ${topic.title}`,
      sourceType: "topic",
      sourcePath: "lib/klasse-help/help-topics.ts",
      module: "any",
      content: topicText,
      status: "active",
    });

    chunks.push({
      id: `${singleTopicDocId}-chunk-0`,
      documentId: singleTopicDocId,
      schoolId: null,
      module: "any",
      chunkIndex: 0,
      content: topicText,
      metadata: {
        title: topic.title,
        key: topic.key,
        category: topic.category,
      },
    });
  }

  // 4. Process Markdown Documents inside docs folder
  console.log("Processando documentos de documentação em docs/...");
  if (fs.existsSync(DOCS_DIR)) {
    const files = fs.readdirSync(DOCS_DIR);
    for (const file of files) {
      if (file.endsWith(".md")) {
        const filePath = path.join(DOCS_DIR, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const docId = `doc-file-${file.replace(".md", "")}`;

        // Módulo declarado à mão em MODULE_BY_DOC_FILE (ver nota no topo).
        const moduleName: KnowledgeDocument["module"] = MODULE_BY_DOC_FILE[file] ?? "any";
        if (!(file in MODULE_BY_DOC_FILE)) {
          console.warn(`[AVISO] Documento sem módulo declarado (assumido "any"): docs/${file}`);
        }

        documents.push({
          id: docId,
          title: `Manual: ${file.replace(/-/g, " ").replace(".md", "")}`,
          sourceType: "doc",
          sourcePath: path.relative(process.cwd(), filePath),
          module: moduleName,
          content,
          status: "active",
        });

        chunks.push(...chunkContent(docId, moduleName, content, file));
      }
    }
  } else {
    console.warn(`[AVISO] Diretório de documentação não encontrado: ${DOCS_DIR}`);
  }

  // 5. Duplicate Validation
  const seenIds = new Set<string>();
  const duplicates = chunks.filter((c) => {
    if (seenIds.has(c.id)) return true;
    seenIds.add(c.id);
    return false;
  });

  if (duplicates.length > 0) {
    console.error(`[ERRO] Chunks duplicados encontrados: ${duplicates.map((d) => d.id).join(", ")}`);
  }

  // 6. Write final knowledge base file
  const result = {
    buildTimestamp: new Date().toISOString(),
    documentCount: documents.length,
    chunkCount: chunks.length,
    documents,
    chunks,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf-8");
  console.log(`=== SUCESSO: KLASSE Brain compilado em: ${OUTPUT_FILE} ===`);
  console.log(`Documentos: ${documents.length}, Chunks: ${chunks.length}`);
}

// Support running directly via npx tsx
if (require.main === module) {
  buildKnowledgeBase();
}
