// apps/web/src/types/supabase-augment.ts
import type { Database, Json } from "~types/supabase"

export type DBWithRPC = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions" | "Tables"> & {
    Tables: Database["public"]["Tables"] & {
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
