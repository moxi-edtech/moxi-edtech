// apps/web/src/types/supabase-augment.ts
import type { Database, Json } from "~types/supabase"

export type DBWithRPC = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions" | "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      ai_actions: {
        Row: {
          id: string;
          school_id: string;
          created_by: string;
          approved_by: string | null;
          rejected_by: string | null;
          action_type:
            | "finance_message"
            | "communication_draft"
            | "school_summary"
            | "student_summary"
            | "help_navigation"
            | "operational_recommendation";
          source_module:
            | "dashboard"
            | "financeiro"
            | "secretaria"
            | "academico"
            | "comunicacao"
            | "classe_ai";
          source_entity_type: string | null;
          source_entity_id: string | null;
          title: string;
          summary: string | null;
          content: string;
          metadata: Json;
          status:
            | "draft"
            | "review_required"
            | "approved"
            | "rejected"
            | "queued"
            | "sending"
            | "sent"
            | "failed"
            | "cancelled";
          risk_level: "low" | "medium" | "high";
          requires_approval: boolean;
          approved_at: string | null;
          rejected_at: string | null;
          queued_at: string | null;
          sent_at: string | null;
          failed_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          created_by: string;
          approved_by?: string | null;
          rejected_by?: string | null;
          action_type:
            | "finance_message"
            | "communication_draft"
            | "school_summary"
            | "student_summary"
            | "help_navigation"
            | "operational_recommendation";
          source_module:
            | "dashboard"
            | "financeiro"
            | "secretaria"
            | "academico"
            | "comunicacao"
            | "classe_ai";
          source_entity_type?: string | null;
          source_entity_id?: string | null;
          title: string;
          summary?: string | null;
          content: string;
          metadata?: Json;
          status?:
            | "draft"
            | "review_required"
            | "approved"
            | "rejected"
            | "queued"
            | "sending"
            | "sent"
            | "failed"
            | "cancelled";
          risk_level?: "low" | "medium" | "high";
          requires_approval?: boolean;
          approved_at?: string | null;
          rejected_at?: string | null;
          queued_at?: string | null;
          sent_at?: string | null;
          failed_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          created_by?: string;
          approved_by?: string | null;
          rejected_by?: string | null;
          action_type?:
            | "finance_message"
            | "communication_draft"
            | "school_summary"
            | "student_summary"
            | "help_navigation"
            | "operational_recommendation";
          source_module?:
            | "dashboard"
            | "financeiro"
            | "secretaria"
            | "academico"
            | "comunicacao"
            | "classe_ai";
          source_entity_type?: string | null;
          source_entity_id?: string | null;
          title?: string;
          summary?: string | null;
          content?: string;
          metadata?: Json;
          status?:
            | "draft"
            | "review_required"
            | "approved"
            | "rejected"
            | "queued"
            | "sending"
            | "sent"
            | "failed"
            | "cancelled";
          risk_level?: "low" | "medium" | "high";
          requires_approval?: boolean;
          approved_at?: string | null;
          rejected_at?: string | null;
          queued_at?: string | null;
          sent_at?: string | null;
          failed_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_actions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "escolas";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_school_settings: {
        Row: {
          id: string;
          school_id: string;
          enabled: boolean;
          monthly_limit: number;
          daily_limit: number;
          allowed_features: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          enabled?: boolean;
          monthly_limit?: number;
          daily_limit?: number;
          allowed_features?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          enabled?: boolean;
          monthly_limit?: number;
          daily_limit?: number;
          allowed_features?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_school_settings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: true;
            referencedRelation: "escolas";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_logs: {
        Row: {
          id: string;
          school_id: string;
          user_id: string | null;
          feature: string;
          prompt_template_id: string | null;
          input_hash: string | null;
          input_preview: string | null;
          output_preview: string | null;
          status: string;
          error_message: string | null;
          tokens_input: number | null;
          tokens_output: number | null;
          provider: string | null;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id?: string | null;
          feature: string;
          prompt_template_id?: string | null;
          input_hash?: string | null;
          input_preview?: string | null;
          output_preview?: string | null;
          status: string;
          error_message?: string | null;
          tokens_input?: number | null;
          tokens_output?: number | null;
          provider?: string | null;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string | null;
          feature?: string;
          prompt_template_id?: string | null;
          input_hash?: string | null;
          input_preview?: string | null;
          output_preview?: string | null;
          status?: string;
          error_message?: string | null;
          tokens_input?: number | null;
          tokens_output?: number | null;
          provider?: string | null;
          model?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "escolas";
            referencedColumns: ["id"];
          },
        ];
      };
      escola_notas_internas: {
        Row: {
          escola_id: string;
          nota: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          escola_id: string;
          nota: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          escola_id?: string;
          nota?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "escola_notas_internas_escola_id_fkey";
            columns: ["escola_id"];
            isOneToOne: true;
            referencedRelation: "escolas";
            referencedColumns: ["id"];
          },
        ];
      };
      school_notification_providers: {
        Row: {
          id: string;
          school_id: string;
          provider_type: "whatsapp_manual" | "whatsapp_waha";
          display_name: string;
          status: "disabled" | "pending_qr" | "connected" | "disconnected" | "error";
          daily_limit: number;
          monthly_limit: number;
          session_name: string | null;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          provider_type: "whatsapp_manual" | "whatsapp_waha";
          display_name: string;
          status?: "disabled" | "pending_qr" | "connected" | "disconnected" | "error";
          daily_limit?: number;
          monthly_limit?: number;
          session_name?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          provider_type?: "whatsapp_manual" | "whatsapp_waha";
          display_name?: string;
          status?: "disabled" | "pending_qr" | "connected" | "disconnected" | "error";
          daily_limit?: number;
          monthly_limit?: number;
          session_name?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_notification_providers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "escolas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: Database["public"]["Functions"] & {
      claim_ai_usage_slot: {
        Args: {
          p_school_id: string;
          p_user_id: string;
          p_feature: string;
          p_prompt_template_key?: string | null;
        };
        Returns: string;
      };
      admissao_public_lookup_by_protocolo: {
        Args: {
          p_escola_id: string;
          p_protocolo: string;
        };
        Returns: Array<{
          id: string;
          protocolo_publico: string;
          status: string | null;
          aluno_id: string | null;
          nome_candidato: string | null;
          responsavel_contato_normalizado: string | null;
          dados_candidato: Json | null;
          curso_nome: string | null;
        }>;
      };
      check_public_rate_limit: {
        Args: {
          p_scope: string;
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
          p_block_seconds: number;
        };
        Returns: Json;
      };
      admissao_reupload_documento_pendente: {
        Args: {
          p_escola_id: string;
          p_candidatura_id: string;
          p_document_id: string;
          p_document_path: string;
        };
        Returns: Json;
      };
      aluno_atualizar_contatos_proprios: {
        Args: {
          p_escola_id: string;
          p_aluno_id: string;
          p_email: string | null;
          p_telefone: string | null;
          p_endereco: string | null;
        };
        Returns: Array<{
          email: string | null;
          telefone: string | null;
          endereco: string | null;
        }>;
      };
      aluno_confirmar_rematricula: {
        Args: {
          p_matricula_id: string;
        };
        Returns: Array<{
          candidatura_id: string;
          next_ano: number;
          reused: boolean;
        }>;
      };
      create_escola_with_admin: {
        Args: {
          p_nome: string
          p_nif: string | null
          p_endereco: string | null
          p_admin_email: string | null
          p_admin_telefone: string | null
          p_admin_nome: string | null
        }
        Returns: {
          ok: boolean
          escolaId: string
          escolaNome: string
          mensagemAdmin: string
        }
      }
      create_and_provision_escola_from_onboarding: {
        Args: {
          p_request_id: string
          p_nome: string
          p_nif: string | null
          p_endereco: string | null
          p_plano: string | null
          p_admin_email: string | null
          p_admin_telefone: string | null
          p_admin_nome: string | null
          p_actor_id: string | null
        }
        Returns: Json
      }
      get_pedagogico_prontidao_lancamentos: {
        Args: {
          p_escola_id: string
          p_turma_id: string
          p_trimestre: number
        }
        Returns: Array<{
          turma_disciplina_id: string
          disciplina_nome: string
          professor_nome: string
          tipo: string
          total_alunos: number
          notas_lancadas: number
          pendentes: number
          percentual_lancado: number
        }>
      }
      get_turma_notas_pendentes_detalhe: {
        Args: {
          p_escola_id: string
          p_turma_id: string
          p_trimestre: number
        }
        Returns: Array<{
          aluno_id: string
          aluno_nome: string
          numero_processo: string
          disciplina_nome: string
          tipo_avaliacao: string
          professor_nome: string
          professor_telefone: string
        }>
      }
      get_conselho_turma_risco: {
        Args: {
          p_escola_id: string
          p_turma_id: string
          p_trimestre: number
        }
        Returns: Array<{
          aluno_id: string
          aluno_nome: string
          numero_processo: string
          disciplina_nome: string
          nota_final: number
        }>
      }
    }
  }
}
