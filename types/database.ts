export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          bi_numero: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          encarregado_relacao: string | null
          escola_id: string
          id: string
          naturalidade: string | null
          nome: string | null
          nome_responsavel: string | null
          profile_id: string
          provincia: string | null
          responsavel_contato: string | null
          responsavel_nome: string | null
          sexo: string | null
          tsv: unknown
        }
        Insert: {
          bi_numero?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          encarregado_relacao?: string | null
          escola_id: string
          id?: string
          naturalidade?: string | null
          nome?: string | null
          nome_responsavel?: string | null
          profile_id: string
          provincia?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          sexo?: string | null
          tsv?: unknown
        }
        Update: {
          bi_numero?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          encarregado_relacao?: string | null
          escola_id?: string
          id?: string
          naturalidade?: string | null
          nome?: string | null
          nome_responsavel?: string | null
          profile_id?: string
          provincia?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          sexo?: string | null
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "alunos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      atribuicoes_prof: {
        Row: {
          curso_oferta_id: string
          escola_id: string
          id: string
          professor_user_id: string
          secao_id: string
        }
        Insert: {
          curso_oferta_id: string
          escola_id: string
          id?: string
          professor_user_id: string
          secao_id: string
        }
        Update: {
          curso_oferta_id?: string
          escola_id?: string
          id?: string
          professor_user_id?: string
          secao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_prof_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_prof_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_prof_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_prof_professor_user_id_fkey"
            columns: ["professor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "atribuicoes_prof_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          action: string | null
          created_at: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          escola_id: string | null
          id: number
          meta: Json | null
          portal: string | null
          registro_id: string | null
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          action?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          escola_id?: string | null
          id?: number
          meta?: Json | null
          portal?: string | null
          registro_id?: string | null
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          action?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          escola_id?: string | null
          id?: number
          meta?: Json | null
          portal?: string | null
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          curso_oferta_id: string
          data_prevista: string | null
          escola_id: string
          id: string
          nome: string
          peso: number
          sistema_notas_id: string | null
        }
        Insert: {
          curso_oferta_id: string
          data_prevista?: string | null
          escola_id: string
          id?: string
          nome: string
          peso: number
          sistema_notas_id?: string | null
        }
        Update: {
          curso_oferta_id?: string
          data_prevista?: string | null
          escola_id?: string
          id?: string
          nome?: string
          peso?: number
          sistema_notas_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_sistema_notas_id_fkey"
            columns: ["sistema_notas_id"]
            isOneToOne: false
            referencedRelation: "sistemas_notas"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          descricao: string | null
          escola_id: string
          id: string
          nivel: string | null
          nome: string
          ordem: number | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          escola_id: string
          id?: string
          nivel?: string | null
          nome: string
          ordem?: number | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          escola_id?: string
          id?: string
          nivel?: string | null
          nome?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_escola: {
        Row: {
          autogerar_periodos: boolean | null
          escola_id: string
          estrutura: string
          periodo_tipo: string | null
          tipo_presenca: string
          updated_at: string
        }
        Insert: {
          autogerar_periodos?: boolean | null
          escola_id: string
          estrutura: string
          periodo_tipo?: string | null
          tipo_presenca: string
          updated_at?: string
        }
        Update: {
          autogerar_periodos?: boolean | null
          escola_id?: string
          estrutura?: string
          periodo_tipo?: string | null
          tipo_presenca?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_escola_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_escola_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          codigo: string
          descricao: string | null
          escola_id: string
          id: string
          nivel: string | null
          nome: string
          semestre_id: string | null
          tipo: string | null
        }
        Insert: {
          codigo: string
          descricao?: string | null
          escola_id: string
          id?: string
          nivel?: string | null
          nome: string
          semestre_id?: string | null
          tipo?: string | null
        }
        Update: {
          codigo?: string
          descricao?: string | null
          escola_id?: string
          id?: string
          nivel?: string | null
          nome?: string
          semestre_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cursos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "semestres"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos_oferta: {
        Row: {
          curso_id: string
          escola_id: string
          id: string
          semestre_id: string
          turma_id: string
        }
        Insert: {
          curso_id: string
          escola_id: string
          id?: string
          semestre_id: string
          turma_id: string
        }
        Update: {
          curso_id?: string
          escola_id?: string
          id?: string
          semestre_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_oferta_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_oferta_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_oferta_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_oferta_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_oferta_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "semestres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_oferta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          classe_id: string | null
          created_at: string
          curso_id: string | null
          descricao: string | null
          escola_id: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          classe_id?: string | null
          created_at?: string
          curso_id?: string | null
          descricao?: string | null
          escola_id: string
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          classe_id?: string | null
          created_at?: string
          curso_id?: string | null
          descricao?: string | null
          escola_id?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escola_administradores: {
        Row: {
          cargo: string | null
          created_at: string | null
          escola_id: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string | null
          escola_id?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string | null
          escola_id?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escola_administradores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_administradores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escola_admin_escola"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escola_admin_escola"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escola_admin_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      escola_auditoria: {
        Row: {
          acao: string
          criado_em: string | null
          dados: Json | null
          escola_id: string
          id: string
          mensagem: string | null
        }
        Insert: {
          acao: string
          criado_em?: string | null
          dados?: Json | null
          escola_id: string
          id?: string
          mensagem?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string | null
          dados?: Json | null
          escola_id?: string
          id?: string
          mensagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escola_auditoria_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_auditoria_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escola_configuracoes: {
        Row: {
          created_at: string | null
          escola_id: string
          tema_interface: Json | null
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          tema_interface?: Json | null
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          tema_interface?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "escola_configuracoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_configuracoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escola_members: {
        Row: {
          created_at: string | null
          escola_id: string
          role_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          role_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escola_members_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_members_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      escola_usuarios: {
        Row: {
          created_at: string | null
          escola_id: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escola_usuarios_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_usuarios_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escolas: {
        Row: {
          aluno_portal_enabled: boolean
          cor_primaria: string | null
          created_at: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nif: string | null
          nome: string
          onboarding_finalizado: boolean
          plano: string
          status: string | null
          updated_at: string | null
          use_mv_dashboards: boolean
        }
        Insert: {
          aluno_portal_enabled?: boolean
          cor_primaria?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nif?: string | null
          nome: string
          onboarding_finalizado?: boolean
          plano?: string
          status?: string | null
          updated_at?: string | null
          use_mv_dashboards?: boolean
        }
        Update: {
          aluno_portal_enabled?: boolean
          cor_primaria?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nif?: string | null
          nome?: string
          onboarding_finalizado?: boolean
          plano?: string
          status?: string | null
          updated_at?: string | null
          use_mv_dashboards?: boolean
        }
        Relationships: []
      }
      events: {
        Row: {
          descricao: string | null
          escola_id: string
          fim_at: string | null
          id: string
          inicio_at: string
          publico_alvo: string
          titulo: string
        }
        Insert: {
          descricao?: string | null
          escola_id: string
          fim_at?: string | null
          id?: string
          inicio_at: string
          publico_alvo: string
          titulo: string
        }
        Update: {
          descricao?: string | null
          escola_id?: string
          fim_at?: string | null
          id?: string
          inicio_at?: string
          publico_alvo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencias: {
        Row: {
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id: string | null
          status: string
        }
        Insert: {
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id?: string | null
          status: string
        }
        Update: {
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_09: {
        Row: {
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id: string | null
          status: string
        }
        Insert: {
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id?: string | null
          status: string
        }
        Update: {
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_10: {
        Row: {
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id: string | null
          status: string
        }
        Insert: {
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id?: string | null
          status: string
        }
        Update: {
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_11: {
        Row: {
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id: string | null
          status: string
        }
        Insert: {
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id?: string | null
          status: string
        }
        Update: {
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_12: {
        Row: {
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id: string | null
          status: string
        }
        Insert: {
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id?: string | null
          status: string
        }
        Update: {
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_default: {
        Row: {
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          routine_id: string | null
          status: string
        }
        Insert: {
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id?: string
          matricula_id: string
          routine_id?: string | null
          status: string
        }
        Update: {
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          routine_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id: string | null
          valor: number
        }
        Insert: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id?: string | null
          valor: number
        }
        Update: {
          avaliacao_id?: string
          criado_em?: string
          escola_id?: string
          final?: boolean
          id?: string
          matricula_id?: string
          tenant_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      lancamentos_2025_09: {
        Row: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id: string | null
          valor: number
        }
        Insert: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id?: string | null
          valor: number
        }
        Update: {
          avaliacao_id?: string
          criado_em?: string
          escola_id?: string
          final?: boolean
          id?: string
          matricula_id?: string
          tenant_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      lancamentos_2025_10: {
        Row: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id: string | null
          valor: number
        }
        Insert: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id?: string | null
          valor: number
        }
        Update: {
          avaliacao_id?: string
          criado_em?: string
          escola_id?: string
          final?: boolean
          id?: string
          matricula_id?: string
          tenant_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      lancamentos_2025_11: {
        Row: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id: string | null
          valor: number
        }
        Insert: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id?: string | null
          valor: number
        }
        Update: {
          avaliacao_id?: string
          criado_em?: string
          escola_id?: string
          final?: boolean
          id?: string
          matricula_id?: string
          tenant_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      lancamentos_2025_12: {
        Row: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id: string | null
          valor: number
        }
        Insert: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id?: string | null
          valor: number
        }
        Update: {
          avaliacao_id?: string
          criado_em?: string
          escola_id?: string
          final?: boolean
          id?: string
          matricula_id?: string
          tenant_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      lancamentos_default: {
        Row: {
          avaliacao_id: string
          criado_em: string
          escola_id: string
          final: boolean
          id: string
          matricula_id: string
          tenant_id: string | null
          valor: number
        }
        Insert: {
          avaliacao_id: string
          criado_em?: string
          escola_id: string
          final?: boolean
          id?: string
          matricula_id: string
          tenant_id?: string | null
          valor: number
        }
        Update: {
          avaliacao_id?: string
          criado_em?: string
          escola_id?: string
          final?: boolean
          id?: string
          matricula_id?: string
          tenant_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          ativo: boolean | null
          created_at: string | null
          data_matricula: string | null
          escola_id: string
          id: string
          numero_matricula: string | null
          secao_id: string | null
          session_id: string | null
          status: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean | null
          created_at?: string | null
          data_matricula?: string | null
          escola_id: string
          id?: string
          numero_matricula?: string | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean | null
          created_at?: string | null
          data_matricula?: string | null
          escola_id?: string
          id?: string
          numero_matricula?: string | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "secoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "school_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas_cursos: {
        Row: {
          curso_oferta_id: string
          escola_id: string
          id: string
          matricula_id: string
        }
        Insert: {
          curso_oferta_id: string
          escola_id: string
          id?: string
          matricula_id: string
        }
        Update: {
          curso_oferta_id?: string
          escola_id?: string
          id?: string
          matricula_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_cursos_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_cursos_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_cursos_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          aluno_id: string
          created_at: string | null
          disciplina: string
          escola_id: string
          id: string
          nota: number
          periodo_id: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          disciplina: string
          escola_id: string
          id?: string
          nota: number
          periodo_id: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          disciplina?: string
          escola_id?: string
          id?: string
          nota?: number
          periodo_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          conteudo: string
          criado_em: string
          escola_id: string
          id: string
          publico_alvo: string
          titulo: string
        }
        Insert: {
          conteudo: string
          criado_em?: string
          escola_id: string
          id?: string
          publico_alvo: string
          titulo: string
        }
        Update: {
          conteudo?: string
          criado_em?: string
          escola_id?: string
          id?: string
          publico_alvo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_drafts: {
        Row: {
          data: Json
          escola_id: string
          id: string
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          escola_id: string
          id?: string
          step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          escola_id?: string
          id?: string
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_drafts_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_drafts_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          aluno_id: string
          comprovante_url: string | null
          created_at: string | null
          descricao: string | null
          escola_id: string
          forma_pagamento: string | null
          id: string
          metodo: string | null
          referencia: string | null
          referencia_transacao: string | null
          status: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          aluno_id: string
          comprovante_url?: string | null
          created_at?: string | null
          descricao?: string | null
          escola_id: string
          forma_pagamento?: string | null
          id?: string
          metodo?: string | null
          referencia?: string | null
          referencia_transacao?: string | null
          status?: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          aluno_id?: string
          comprovante_url?: string | null
          created_at?: string | null
          descricao?: string | null
          escola_id?: string
          forma_pagamento?: string | null
          id?: string
          metodo?: string | null
          referencia?: string | null
          referencia_transacao?: string | null
          status?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_letivos: {
        Row: {
          ano: number
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          escola_id: string
          id: string
          nome: string
        }
        Insert: {
          ano: number
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          escola_id: string
          id?: string
          nome: string
        }
        Update: {
          ano?: number
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          escola_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodos_letivos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_letivos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          acao: string
          id: number
          recurso: string
          role_id: number
        }
        Insert: {
          acao: string
          id?: number
          recurso: string
          role_id: number
        }
        Update: {
          acao?: string
          id?: number
          recurso?: string
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aluno_id: string
          created_at: string | null
          data: string
          escola_id: string
          id: string
          status: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          data: string
          escola_id: string
          id?: string
          status: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          data?: string
          escola_id?: string
          id?: string
          status?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      professores: {
        Row: {
          apelido: string | null
          created_at: string | null
          escola_id: string
          formacao: string | null
          id: string
          profile_id: string
        }
        Insert: {
          apelido?: string | null
          created_at?: string | null
          escola_id: string
          formacao?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          apelido?: string | null
          created_at?: string | null
          escola_id?: string
          formacao?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_escola_id: string | null
          deleted_at: string | null
          email: string | null
          escola_id: string | null
          global_role: string | null
          nome: string
          numero_login: string | null
          onboarding_finalizado: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          deleted_at?: string | null
          email?: string | null
          escola_id?: string | null
          global_role?: string | null
          nome: string
          numero_login?: string | null
          onboarding_finalizado?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          deleted_at?: string | null
          email?: string | null
          escola_id?: string | null
          global_role?: string | null
          nome?: string
          numero_login?: string | null
          onboarding_finalizado?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_escola_id_fkey"
            columns: ["current_escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_current_escola_id_fkey"
            columns: ["current_escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_archive: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          avatar_url: string | null
          created_at: string | null
          current_escola_id: string | null
          deleted_at: string | null
          email: string | null
          escola_id: string | null
          global_role: string | null
          nome: string | null
          numero_login: string | null
          onboarding_finalizado: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          deleted_at?: string | null
          email?: string | null
          escola_id?: string | null
          global_role?: string | null
          nome?: string | null
          numero_login?: string | null
          onboarding_finalizado?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          deleted_at?: string | null
          email?: string | null
          escola_id?: string | null
          global_role?: string | null
          nome?: string | null
          numero_login?: string | null
          onboarding_finalizado?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      regras_escala: {
        Row: {
          end: number
          escola_id: string
          grade: string
          id: string
          point: number
          sistema_notas_id: string
          start: number
        }
        Insert: {
          end: number
          escola_id: string
          grade: string
          id?: string
          point: number
          sistema_notas_id: string
          start: number
        }
        Update: {
          end?: number
          escola_id?: string
          grade?: string
          id?: string
          point?: number
          sistema_notas_id?: string
          start?: number
        }
        Relationships: [
          {
            foreignKeyName: "regras_escala_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_escala_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_escala_sistema_notas_id_fkey"
            columns: ["sistema_notas_id"]
            isOneToOne: false
            referencedRelation: "sistemas_notas"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      rotinas: {
        Row: {
          curso_oferta_id: string
          escola_id: string
          fim: string
          id: string
          inicio: string
          professor_user_id: string
          sala: string | null
          secao_id: string | null
          turma_id: string
          weekday: number
        }
        Insert: {
          curso_oferta_id: string
          escola_id: string
          fim: string
          id?: string
          inicio: string
          professor_user_id: string
          sala?: string | null
          secao_id?: string | null
          turma_id: string
          weekday: number
        }
        Update: {
          curso_oferta_id?: string
          escola_id?: string
          fim?: string
          id?: string
          inicio?: string
          professor_user_id?: string
          sala?: string | null
          secao_id?: string | null
          turma_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "rotinas_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotinas_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotinas_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotinas_professor_user_id_fkey"
            columns: ["professor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rotinas_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "secoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      school_sessions: {
        Row: {
          data_fim: string
          data_inicio: string
          escola_id: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          data_fim: string
          data_inicio: string
          escola_id: string
          id?: string
          nome: string
          status: string
        }
        Update: {
          data_fim?: string
          data_inicio?: string
          escola_id?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_sessions_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_sessions_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      secoes: {
        Row: {
          escola_id: string
          id: string
          nome: string
          sala: string | null
          turma_id: string
        }
        Insert: {
          escola_id: string
          id?: string
          nome: string
          sala?: string | null
          turma_id: string
        }
        Update: {
          escola_id?: string
          id?: string
          nome?: string
          sala?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secoes_escola_fk_linter_fix"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secoes_escola_fk_linter_fix"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      semestres: {
        Row: {
          attendance_type: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id: string
          nome: string
          permitir_submissao_final: boolean
          session_id: string
        }
        Insert: {
          attendance_type: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id?: string
          nome: string
          permitir_submissao_final?: boolean
          session_id: string
        }
        Update: {
          attendance_type?: string
          data_fim?: string
          data_inicio?: string
          escola_id?: string
          id?: string
          nome?: string
          permitir_submissao_final?: boolean
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "semestres_escola_fk_linter_fix"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semestres_escola_fk_linter_fix"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semestres_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "school_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sistemas_notas: {
        Row: {
          escola_id: string
          id: string
          nome: string
          semestre_id: string | null
          tipo: string
          turma_id: string | null
        }
        Insert: {
          escola_id: string
          id?: string
          nome: string
          semestre_id?: string | null
          tipo: string
          turma_id?: string | null
        }
        Update: {
          escola_id?: string
          id?: string
          nome?: string
          semestre_id?: string | null
          tipo?: string
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sistemas_notas_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_notas_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_notas_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_notas_semestre_id_fkey"
            columns: ["semestre_id"]
            isOneToOne: false
            referencedRelation: "semestres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabi: {
        Row: {
          arquivo_url: string
          criado_em: string
          curso_oferta_id: string
          escola_id: string
          id: string
          nome: string
        }
        Insert: {
          arquivo_url: string
          criado_em?: string
          curso_oferta_id: string
          escola_id: string
          id?: string
          nome: string
        }
        Update: {
          arquivo_url?: string
          criado_em?: string
          curso_oferta_id?: string
          escola_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabi_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabi_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabi_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ano_letivo: string | null
          escola_id: string
          id: string
          nome: string
          sala: string | null
          turno: string | null
        }
        Insert: {
          ano_letivo?: string | null
          escola_id: string
          id?: string
          nome: string
          sala?: string | null
          turno?: string | null
        }
        Update: {
          ano_letivo?: string | null
          escola_id?: string
          id?: string
          nome?: string
          sala?: string | null
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas_auditoria: {
        Row: {
          acao: string
          criado_em: string | null
          dados: Json | null
          escola_id: string
          id: string
          turma_id: string
        }
        Insert: {
          acao: string
          criado_em?: string | null
          dados?: Json | null
          escola_id: string
          id?: string
          turma_id: string
        }
        Update: {
          acao?: string
          criado_em?: string | null
          dados?: Json | null
          escola_id?: string
          id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_auditoria_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_auditoria_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_auditoria_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      escolas_view: {
        Row: {
          cidade: string | null
          estado: string | null
          id: string | null
          last_access: string | null
          nome: string | null
          plano: string | null
          status: string | null
          total_alunos: number | null
          total_professores: number | null
        }
        Relationships: []
      }
      matriculas_por_ano: {
        Row: {
          ano: string | null
          escola_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_financeiro_escola_dia: {
        Row: {
          dia: string | null
          escola_id: string | null
          qtd_pagos: number | null
          qtd_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_freq_por_turma_dia: {
        Row: {
          dia: string | null
          escola_id: string | null
          presentes: number | null
          total: number | null
          turma_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_media_por_curso: {
        Row: {
          curso_oferta_id: string | null
          escola_id: string | null
          media: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_status: {
        Row: {
          escola_id: string | null
          status: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          id: string | null
          nome: string | null
          session_id: string | null
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          id?: string | null
          nome?: string | null
          session_id?: string | null
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          id?: string | null
          nome?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "semestres_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "school_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_audit_feed: {
        Row: {
          acao: string | null
          aluno_id: string | null
          aluno_nome: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          escola_id: string | null
          matricula_id: string | null
          portal: string | null
          tabela: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_financeiro_escola_dia: {
        Row: {
          dia: string | null
          escola_id: string | null
          qtd_pagos: number | null
          qtd_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      v_freq_por_turma_dia: {
        Row: {
          dia: string | null
          escola_id: string | null
          presentes: number | null
          total: number | null
          turma_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_media_por_curso: {
        Row: {
          curso_oferta_id: string | null
          escola_id: string | null
          media: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_cursos_media: {
        Row: {
          curso_nome: string | null
          curso_oferta_id: string | null
          escola_id: string | null
          media: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_curso_oferta_id_fkey"
            columns: ["curso_oferta_id"]
            isOneToOne: false
            referencedRelation: "cursos_oferta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_turmas_hoje: {
        Row: {
          escola_id: string | null
          percent: number | null
          presentes: number | null
          total: number | null
          turma_id: string | null
          turma_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _each_month: {
        Args: { end_date: string; start_date: string }
        Returns: {
          month_end: string
          month_start: string
        }[]
      }
      can_access: { Args: { eid: string }; Returns: boolean }
      check_super_admin_role: { Args: never; Returns: boolean }
      create_escola_with_admin: {
        Args: {
          p_admin_email?: string
          p_admin_nome?: string
          p_admin_telefone?: string
          p_endereco?: string
          p_nif?: string
          p_nome: string
        }
        Returns: Json
      }
      create_month_partition: {
        Args: { month_start: string; tbl: string }
        Returns: undefined
      }
      create_month_partition_ts: {
        Args: { month_start: string; tbl: string }
        Returns: undefined
      }
      current_tenant_escola_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      dashboard: { Args: never; Returns: Json }
      generate_unique_numero_login: {
        Args: {
          p_escola_id: string
          p_prefix: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_start: number
        }
        Returns: string
      }
      get_profile_dependencies: {
        Args: { p_user_id: string }
        Returns: {
          cnt: number
          table_name: string
        }[]
      }
      get_user_escola_id:
        | { Args: { p_user_id: string }; Returns: string }
        | { Args: never; Returns: string }
      get_user_export_json: { Args: { p_user_id: string }; Returns: Json }
      get_user_tenant: { Args: never; Returns: string }
      is_escola_admin: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_diretor: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_member: { Args: { p_escola_id: string }; Returns: boolean }
      is_membro_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_staff_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      move_profile_to_archive: {
        Args: { p_performed_by: string; p_user_id: string }
        Returns: undefined
      }
      partitions_info: { Args: never; Returns: Json }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      secretaria_audit_by_aluno_matricula: {
        Args: {
          p_aluno_id?: string
          p_limit?: number
          p_matricula_id?: string
          p_offset?: number
        }
        Returns: {
          acao: string
          aluno_id: string
          aluno_nome: string
          created_at: string
          details: Json
          entity_id: string
          matricula_id: string
          portal: string
          tabela: string
          user_email: string
          user_id: string
        }[]
      }
    }
    Enums: {
      user_role:
        | "super_admin"
        | "global_admin"
        | "admin"
        | "professor"
        | "aluno"
        | "secretaria"
        | "financeiro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: [
        "super_admin",
        "global_admin",
        "admin",
        "professor",
        "aluno",
        "secretaria",
        "financeiro",
      ],
    },
  },
} as const

