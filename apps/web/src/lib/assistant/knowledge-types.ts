export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceType: "doc" | "registry" | "topic";
  sourcePath: string;
  module: "dashboard" | "secretaria" | "financeiro" | "academico" | "comunicacao" | "whatsapp" | "classe_ai" | "operacoes" | "any" | "configuracao";
  content: string;
  status: "active" | "draft";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  schoolId?: string | null;
  module: KnowledgeDocument["module"];
  chunkIndex: number;
  content: string;
  metadata: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}
