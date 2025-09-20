export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          created_at: string | null
          data_nascimento: string | null
          escola_id: string
          id: string
          nome_responsavel: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          data_nascimento?: string | null
          escola_id: string
          id?: string
          nome_responsavel?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          data_nascimento?: string | null
          escola_id?: string
          id?: string
          nome_responsavel?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
      audit_logs: {
        Row: {
          acao: string
          created_at: string | null
          id: number
          meta: Json | null
          registro_id: string | null
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          id?: number
          meta?: Json | null
          registro_id?: string | null
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          id?: number
          meta?: Json | null
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          created_at: string | null
          escola_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
      disciplinas_auditoria: {
        Row: {
          acao: string
          criado_em: string | null
          dados: Json | null
          disciplina_id: string
          escola_id: string
          id: string
        }
        Insert: {
          acao: string
          criado_em?: string | null
          dados?: Json | null
          disciplina_id: string
          escola_id: string
          id?: string
        }
        Update: {
          acao?: string
          criado_em?: string | null
          dados?: Json | null
          disciplina_id?: string
          escola_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_auditoria_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_auditoria_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
          {
            foreignKeyName: "disciplinas_auditoria_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_auditoria_escola_id_fkey"
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
          cor_primaria: string | null
          created_at: string | null
          endereco: string | null
          id: string
          nif: string | null
          nome: string
          onboarding_finalizado: boolean | null
          plano: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cor_primaria?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nif?: string | null
          nome: string
          onboarding_finalizado?: boolean | null
          plano?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cor_primaria?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nif?: string | null
          nome?: string
          onboarding_finalizado?: boolean | null
          plano?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      matriculas: {
        Row: {
          aluno_id: string
          ativo: boolean | null
          created_at: string | null
          escola_id: string
          id: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean | null
          created_at?: string | null
          escola_id: string
          id?: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean | null
          created_at?: string | null
          escola_id?: string
          id?: string
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
      pagamentos: {
        Row: {
          aluno_id: string
          comprovante_url: string | null
          created_at: string | null
          descricao: string | null
          escola_id: string
          forma_pagamento: string | null
          id: string
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
      periodos: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
          created_at: string | null
          escola_id: string
          formacao: string | null
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          formacao?: string | null
          id?: string
          profile_id: string
        }
        Update: {
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
          email: string | null
          escola_id: string | null
          nome: string
          onboarding_finalizado: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          escola_id?: string | null
          nome: string
          onboarding_finalizado?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          escola_id?: string | null
          nome?: string
          onboarding_finalizado?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
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
      turmas: {
        Row: {
          ano_letivo: string | null
          created_at: string | null
          escola_id: string
          id: string
          nome: string
          professor_id: string | null
        }
        Insert: {
          ano_letivo?: string | null
          created_at?: string | null
          escola_id: string
          id?: string
          nome: string
          professor_id?: string | null
        }
        Update: {
          ano_letivo?: string | null
          created_at?: string | null
          escola_id?: string
          id?: string
          nome?: string
          professor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
          {
            foreignKeyName: "turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
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
            referencedRelation: "auditoria_resumo_escolas"
            referencedColumns: ["escola_id"]
          },
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
      auditoria_resumo_escolas: {
        Row: {
          escola_id: string | null
          escola_nome: string | null
          nif: string | null
          primeira_acao: string | null
          ultima_acao: string | null
          ultimas_disciplinas: Json | null
          ultimas_turmas: Json | null
          vezes_criada: number | null
          vezes_reutilizada: number | null
        }
        Relationships: []
      }
      auditoria_unificada: {
        Row: {
          acao: string | null
          criado_em: string | null
          dados: Json | null
          entidade_nome: string | null
          escola_id: string | null
          log_id: string | null
          tipo: string | null
        }
        Relationships: []
      }
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
    }
    Functions: {
      can_access: {
        Args: { eid: string }
        Returns: boolean
      }
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
      dashboard: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
