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
      aggregates_financeiro: {
        Row: {
          aluno_id: string | null
          alunos_em_dia: number
          alunos_inadimplentes: number
          created_at: string
          data_referencia: string
          escola_id: string
          sync_status: string
          sync_updated_at: string
          total_inadimplente: number
          total_pago: number
          total_pendente: number
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          alunos_em_dia?: number
          alunos_inadimplentes?: number
          created_at?: string
          data_referencia: string
          escola_id: string
          sync_status?: string
          sync_updated_at?: string
          total_inadimplente?: number
          total_pago?: number
          total_pendente?: number
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          alunos_em_dia?: number
          alunos_inadimplentes?: number
          created_at?: string
          data_referencia?: string
          escola_id?: string
          sync_status?: string
          sync_updated_at?: string
          total_inadimplente?: number
          total_pago?: number
          total_pendente?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregates_financeiro_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aggregates_financeiro_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      aggregates_pedagogico: {
        Row: {
          created_at: string
          disciplina_id: string
          escola_id: string
          maior_nota: number | null
          media_geral: number | null
          menor_nota: number | null
          periodo_letivo_id: string
          sync_status: string
          sync_updated_at: string
          total_lancamentos: number
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disciplina_id: string
          escola_id: string
          maior_nota?: number | null
          media_geral?: number | null
          menor_nota?: number | null
          periodo_letivo_id: string
          sync_status?: string
          sync_updated_at?: string
          total_lancamentos?: number
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disciplina_id?: string
          escola_id?: string
          maior_nota?: number | null
          media_geral?: number | null
          menor_nota?: number | null
          periodo_letivo_id?: string
          sync_status?: string
          sync_updated_at?: string
          total_lancamentos?: number
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregates_pedagogico_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aggregates_pedagogico_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      aggregates_secretaria: {
        Row: {
          alunos_ativos: number
          alunos_inativos: number
          created_at: string
          data_referencia: string
          escola_id: string
          sync_status: string
          sync_updated_at: string
          total_alunos: number
          turma_id: string
          updated_at: string
        }
        Insert: {
          alunos_ativos?: number
          alunos_inativos?: number
          created_at?: string
          data_referencia: string
          escola_id: string
          sync_status?: string
          sync_updated_at?: string
          total_alunos?: number
          turma_id: string
          updated_at?: string
        }
        Update: {
          alunos_ativos?: number
          alunos_inativos?: number
          created_at?: string
          data_referencia?: string
          escola_id?: string
          sync_status?: string
          sync_updated_at?: string
          total_alunos?: number
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregates_secretaria_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aggregates_secretaria_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_processo_counters: {
        Row: {
          escola_id: string
          last_value: number
          updated_at: string
        }
        Insert: {
          escola_id: string
          last_value?: number
          updated_at?: string
        }
        Update: {
          escola_id?: string
          last_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      alunos: {
        Row: {
          acesso_liberado: boolean
          bi_numero: string | null
          codigo_ativacao: string | null
          created_at: string
          data_ativacao: string | null
          data_nascimento: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          email: string | null
          encarregado_email: string | null
          encarregado_nome: string | null
          encarregado_telefone: string | null
          escola_id: string
          id: string
          import_id: string | null
          naturalidade: string | null
          nif: string | null
          nome: string
          nome_busca: string | null
          nome_completo: string | null
          numero_processo: string | null
          numero_processo_legado: string | null
          profile_id: string | null
          responsavel: string | null
          responsavel_contato: string | null
          responsavel_nome: string | null
          search_text: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          telefone_responsavel: string | null
          tsv: unknown
          ultimo_reset_senha: string | null
          updated_at: string | null
          usuario_auth_id: string | null
        }
        Insert: {
          acesso_liberado?: boolean
          bi_numero?: string | null
          codigo_ativacao?: string | null
          created_at?: string
          data_ativacao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_telefone?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome: string
          nome_busca?: string | null
          nome_completo?: string | null
          numero_processo?: string | null
          numero_processo_legado?: string | null
          profile_id?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          search_text?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tsv?: unknown
          ultimo_reset_senha?: string | null
          updated_at?: string | null
          usuario_auth_id?: string | null
        }
        Update: {
          acesso_liberado?: boolean
          bi_numero?: string | null
          codigo_ativacao?: string | null
          created_at?: string
          data_ativacao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_telefone?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome?: string
          nome_busca?: string | null
          nome_completo?: string | null
          numero_processo?: string | null
          numero_processo_legado?: string | null
          profile_id?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          search_text?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tsv?: unknown
          ultimo_reset_senha?: string | null
          updated_at?: string | null
          usuario_auth_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      alunos_excluidos: {
        Row: {
          aluno_created_at: string | null
          aluno_deleted_at: string | null
          aluno_id: string | null
          anonimizacao_data: string | null
          dados_anonimizados: boolean
          escola_id: string
          excluido_por: string | null
          exclusao_motivo: string | null
          id: string
          nome: string | null
          numero_login: string | null
          profile_id: string | null
          snapshot: Json | null
        }
        Insert: {
          aluno_created_at?: string | null
          aluno_deleted_at?: string | null
          aluno_id?: string | null
          anonimizacao_data?: string | null
          dados_anonimizados?: boolean
          escola_id: string
          excluido_por?: string | null
          exclusao_motivo?: string | null
          id?: string
          nome?: string | null
          numero_login?: string | null
          profile_id?: string | null
          snapshot?: Json | null
        }
        Update: {
          aluno_created_at?: string | null
          aluno_deleted_at?: string | null
          aluno_id?: string | null
          anonimizacao_data?: string | null
          dados_anonimizados?: boolean
          escola_id?: string
          excluido_por?: string | null
          exclusao_motivo?: string | null
          id?: string
          nome?: string | null
          numero_login?: string | null
          profile_id?: string | null
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_excluidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_excluidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_excluidos_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      anos_letivos: {
        Row: {
          ano: number
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          ano: number
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          ano?: number
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          escola_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anos_letivos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anos_letivos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_balcao: {
        Row: {
          aluno_id: string | null
          created_at: string
          escola_id: string
          finalizado_em: string | null
          id: string
          iniciado_em: string
          motivo: string
          operador_id: string | null
          resolucao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          escola_id: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          motivo: string
          operador_id?: string | null
          resolucao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          escola_id?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          motivo?: string
          operador_id?: string | null
          resolucao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_balcao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_balcao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_balcao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "atendimentos_balcao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "atendimentos_balcao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_balcao_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_balcao_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
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
          acao: string | null
          action: string | null
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          escola_id: string
          id: number
          ip: string | null
          meta: Json | null
          portal: string | null
          registro_id: string | null
          tabela: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao?: string | null
          action?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          escola_id: string
          id?: number
          ip?: string | null
          meta?: Json | null
          portal?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string | null
          action?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          escola_id?: string
          id?: number
          ip?: string | null
          meta?: Json | null
          portal?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
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
      aulas: {
        Row: {
          conteudo: string | null
          created_at: string
          created_by: string | null
          data: string
          escola_id: string
          id: string
          numero_aula: number | null
          turma_disciplina_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          escola_id: string
          id?: string
          numero_aula?: number | null
          turma_disciplina_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          escola_id?: string
          id?: string
          numero_aula?: number | null
          turma_disciplina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          ano_letivo: number
          created_at: string
          escola_id: string
          id: string
          nome: string
          nota_max: number
          periodo_letivo_id: string
          peso: number
          tipo: string
          trimestre: number
          turma_disciplina_id: string
        }
        Insert: {
          ano_letivo: number
          created_at?: string
          escola_id: string
          id?: string
          nome: string
          nota_max?: number
          periodo_letivo_id: string
          peso?: number
          tipo: string
          trimestre: number
          turma_disciplina_id: string
        }
        Update: {
          ano_letivo?: number
          created_at?: string
          escola_id?: string
          id?: string
          nome?: string
          nota_max?: number
          periodo_letivo_id?: string
          peso?: number
          tipo?: string
          trimestre?: number
          turma_disciplina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_periodo_letivo_id_fkey"
            columns: ["periodo_letivo_id"]
            isOneToOne: false
            referencedRelation: "periodos_letivos"
            referencedColumns: ["id"]
          },
        ]
      }
      candidaturas: {
        Row: {
          aluno_id: string | null
          ano_letivo: number | null
          classe_id: string | null
          created_at: string | null
          curso_id: string | null
          dados_candidato: Json | null
          escola_id: string
          id: string
          matricula_id: string | null
          matriculado_em: string | null
          nome_candidato: string | null
          source: string | null
          status: string | null
          turma_preferencial_id: string | null
          turno: string | null
          updated_at: string | null
        }
        Insert: {
          aluno_id?: string | null
          ano_letivo?: number | null
          classe_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          dados_candidato?: Json | null
          escola_id: string
          id?: string
          matricula_id?: string | null
          matriculado_em?: string | null
          nome_candidato?: string | null
          source?: string | null
          status?: string | null
          turma_preferencial_id?: string | null
          turno?: string | null
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string | null
          ano_letivo?: number | null
          classe_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          dados_candidato?: Json | null
          escola_id?: string
          id?: string
          matricula_id?: string | null
          matriculado_em?: string | null
          nome_candidato?: string | null
          source?: string | null
          status?: string | null
          turma_preferencial_id?: string | null
          turno?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidaturas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "candidaturas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "candidaturas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "vw_search_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_turma_preferencial_id_fkey"
            columns: ["turma_preferencial_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_turma_preferencial_id_fkey"
            columns: ["turma_preferencial_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "candidaturas_turma_preferencial_id_fkey"
            columns: ["turma_preferencial_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      candidaturas_status_log: {
        Row: {
          actor_user_id: string | null
          candidatura_id: string
          created_at: string | null
          escola_id: string
          from_status: string | null
          id: string
          metadata: Json | null
          motivo: string | null
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          candidatura_id: string
          created_at?: string | null
          escola_id: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          motivo?: string | null
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          candidatura_id?: string
          created_at?: string | null
          escola_id?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          motivo?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidaturas_status_log_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "candidaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_status_log_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_status_log_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          ano_letivo_id: string | null
          carga_horaria_semanal: number | null
          created_at: string
          curso_id: string | null
          descricao: string | null
          escola_id: string
          id: string
          min_disciplinas_core: number | null
          nivel: string | null
          nome: string
          numero: number | null
          ordem: number | null
          turno: string | null
        }
        Insert: {
          ano_letivo_id?: string | null
          carga_horaria_semanal?: number | null
          created_at?: string
          curso_id?: string | null
          descricao?: string | null
          escola_id: string
          id?: string
          min_disciplinas_core?: number | null
          nivel?: string | null
          nome: string
          numero?: number | null
          ordem?: number | null
          turno?: string | null
        }
        Update: {
          ano_letivo_id?: string | null
          carga_horaria_semanal?: number | null
          created_at?: string
          curso_id?: string | null
          descricao?: string | null
          escola_id?: string
          id?: string
          min_disciplinas_core?: number | null
          nivel?: string | null
          nome?: string
          numero?: number | null
          ordem?: number | null
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
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
      conciliacao_uploads: {
        Row: {
          banco: string | null
          conta: string | null
          error_details: string | null
          escola_id: string
          file_name: string
          file_path: string
          file_size_kb: number | null
          id: string
          meta: Json
          processed_at: string | null
          range_end: string | null
          range_start: string | null
          status: string
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          banco?: string | null
          conta?: string | null
          error_details?: string | null
          escola_id: string
          file_name: string
          file_path: string
          file_size_kb?: number | null
          id?: string
          meta?: Json
          processed_at?: string | null
          range_end?: string | null
          range_start?: string | null
          status?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          banco?: string | null
          conta?: string | null
          error_details?: string | null
          escola_id?: string
          file_name?: string
          file_path?: string
          file_size_kb?: number | null
          id?: string
          meta?: Json
          processed_at?: string | null
          range_end?: string | null
          range_start?: string | null
          status?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_uploads_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_uploads_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_curriculo: {
        Row: {
          config: Json
          created_at: string | null
          curso_id: string
          escola_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          curso_id: string
          escola_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          curso_id?: string
          escola_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_curriculo_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_curriculo_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_curriculo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_curriculo_escola_id_fkey"
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
          avaliacao_config: Json
          escola_id: string
          estrutura: string
          frequencia_min_percent: number
          frequencia_modelo: string
          modelo_avaliacao: string
          periodo_tipo: string | null
          tipo_presenca: string
          updated_at: string
        }
        Insert: {
          autogerar_periodos?: boolean | null
          avaliacao_config?: Json
          escola_id: string
          estrutura: string
          frequencia_min_percent?: number
          frequencia_modelo?: string
          modelo_avaliacao?: string
          periodo_tipo?: string | null
          tipo_presenca: string
          updated_at?: string
        }
        Update: {
          autogerar_periodos?: boolean | null
          avaliacao_config?: Json
          escola_id?: string
          estrutura?: string
          frequencia_min_percent?: number
          frequencia_modelo?: string
          modelo_avaliacao?: string
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
      curriculum_preset_subjects: {
        Row: {
          component: Database["public"]["Enums"]["discipline_component"]
          grade_level: string
          id: string
          name: string
          preset_id: string | null
          subject_type: string | null
          weekly_hours: number
        }
        Insert: {
          component: Database["public"]["Enums"]["discipline_component"]
          grade_level: string
          id?: string
          name: string
          preset_id?: string | null
          subject_type?: string | null
          weekly_hours?: number
        }
        Update: {
          component?: Database["public"]["Enums"]["discipline_component"]
          grade_level?: string
          id?: string
          name?: string
          preset_id?: string | null
          subject_type?: string | null
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_preset_subjects_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "curriculum_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_presets: {
        Row: {
          category: Database["public"]["Enums"]["course_category"]
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["course_category"]
          created_at?: string | null
          description?: string | null
          id: string
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["course_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      curso_curriculos: {
        Row: {
          ano_letivo_id: string
          classe_id: string | null
          created_at: string
          created_by: string | null
          curso_id: string
          escola_id: string
          id: string
          status: Database["public"]["Enums"]["curriculo_status"]
          version: number
        }
        Insert: {
          ano_letivo_id: string
          classe_id?: string | null
          created_at?: string
          created_by?: string | null
          curso_id: string
          escola_id: string
          id?: string
          status?: Database["public"]["Enums"]["curriculo_status"]
          version: number
        }
        Update: {
          ano_letivo_id?: string
          classe_id?: string | null
          created_at?: string
          created_by?: string | null
          curso_id?: string
          escola_id?: string
          id?: string
          status?: Database["public"]["Enums"]["curriculo_status"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curso_curriculos_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "anos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_curriculos_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "vw_escola_ano_letivo_preferido"
            referencedColumns: ["ano_letivo_id"]
          },
          {
            foreignKeyName: "curso_curriculos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_curriculos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_curriculos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_curriculos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_matriz: {
        Row: {
          ativo: boolean
          avaliacao_disciplina_id: string | null
          avaliacao_mode: string | null
          avaliacao_modelo_id: string | null
          carga_horaria: number | null
          carga_horaria_semanal: number | null
          classe_id: string
          classificacao: string | null
          created_at: string
          curso_curriculo_id: string | null
          curso_id: string
          disciplina_id: string
          entra_no_horario: boolean | null
          escola_id: string
          id: string
          obrigatoria: boolean
          ordem: number | null
          periodos_ativos: number[] | null
          status_avaliacao: string | null
          status_completude: string | null
          status_horario: string | null
        }
        Insert: {
          ativo?: boolean
          avaliacao_disciplina_id?: string | null
          avaliacao_mode?: string | null
          avaliacao_modelo_id?: string | null
          carga_horaria?: number | null
          carga_horaria_semanal?: number | null
          classe_id: string
          classificacao?: string | null
          created_at?: string
          curso_curriculo_id?: string | null
          curso_id: string
          disciplina_id: string
          entra_no_horario?: boolean | null
          escola_id: string
          id?: string
          obrigatoria?: boolean
          ordem?: number | null
          periodos_ativos?: number[] | null
          status_avaliacao?: string | null
          status_completude?: string | null
          status_horario?: string | null
        }
        Update: {
          ativo?: boolean
          avaliacao_disciplina_id?: string | null
          avaliacao_mode?: string | null
          avaliacao_modelo_id?: string | null
          carga_horaria?: number | null
          carga_horaria_semanal?: number | null
          classe_id?: string
          classificacao?: string | null
          created_at?: string
          curso_curriculo_id?: string | null
          curso_id?: string
          disciplina_id?: string
          entra_no_horario?: boolean | null
          escola_id?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number | null
          periodos_ativos?: number[] | null
          status_avaliacao?: string | null
          status_completude?: string | null
          status_horario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curso_matriz_avaliacao_disciplina_fk"
            columns: ["avaliacao_disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_avaliacao_modelo_fk"
            columns: ["avaliacao_modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_avaliacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "vw_search_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_curso_curriculo_id_fkey"
            columns: ["curso_curriculo_id"]
            isOneToOne: false
            referencedRelation: "curso_curriculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_matriz_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          codigo: string
          course_code: string | null
          created_at: string | null
          curriculum_key: string | null
          curso_global_id: string | null
          descricao: string | null
          escola_id: string
          id: string
          import_id: string | null
          is_custom: boolean | null
          nivel: string | null
          nome: string
          semestre_id: string | null
          status_aprovacao: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          codigo: string
          course_code?: string | null
          created_at?: string | null
          curriculum_key?: string | null
          curso_global_id?: string | null
          descricao?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          is_custom?: boolean | null
          nivel?: string | null
          nome: string
          semestre_id?: string | null
          status_aprovacao?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string
          course_code?: string | null
          created_at?: string | null
          curriculum_key?: string | null
          curso_global_id?: string | null
          descricao?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          is_custom?: boolean | null
          nivel?: string | null
          nome?: string
          semestre_id?: string | null
          status_aprovacao?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cursos_curso_global_id_fkey"
            columns: ["curso_global_id"]
            isOneToOne: false
            referencedRelation: "cursos_globais_cache"
            referencedColumns: ["hash"]
          },
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
        ]
      }
      cursos_globais_cache: {
        Row: {
          created_at: string | null
          created_by_escola: string | null
          first_seen_at: string | null
          hash: string
          last_used_at: string | null
          nome: string
          tipo: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by_escola?: string | null
          first_seen_at?: string | null
          hash: string
          last_used_at?: string | null
          nome: string
          tipo: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by_escola?: string | null
          first_seen_at?: string | null
          hash?: string
          last_used_at?: string | null
          nome?: string
          tipo?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cursos_globais_cache_created_by_escola_fkey"
            columns: ["created_by_escola"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_globais_cache_created_by_escola_fkey"
            columns: ["created_by_escola"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas_catalogo: {
        Row: {
          aplica_modelo_avaliacao_id: string | null
          area: string | null
          carga_horaria_semana: number | null
          created_at: string
          escola_id: string
          herda_de_disciplina_id: string | null
          id: string
          is_avaliavel: boolean | null
          is_core: boolean | null
          nome: string
          nome_norm: string | null
          sigla: string | null
        }
        Insert: {
          aplica_modelo_avaliacao_id?: string | null
          area?: string | null
          carga_horaria_semana?: number | null
          created_at?: string
          escola_id: string
          herda_de_disciplina_id?: string | null
          id?: string
          is_avaliavel?: boolean | null
          is_core?: boolean | null
          nome: string
          nome_norm?: string | null
          sigla?: string | null
        }
        Update: {
          aplica_modelo_avaliacao_id?: string | null
          area?: string | null
          carga_horaria_semana?: number | null
          created_at?: string
          escola_id?: string
          herda_de_disciplina_id?: string | null
          id?: string
          is_avaliavel?: boolean | null
          is_core?: boolean | null
          nome?: string
          nome_norm?: string | null
          sigla?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_catalogo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_catalogo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_herda_de_fk"
            columns: ["herda_de_disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_modelo_avaliacao_fk"
            columns: ["aplica_modelo_avaliacao_id"]
            isOneToOne: false
            referencedRelation: "modelos_avaliacao"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_emitidos: {
        Row: {
          aluno_id: string
          created_at: string
          created_by: string | null
          dados_snapshot: Json
          escola_id: string
          hash_validacao: string
          id: string
          mensalidade_id: string | null
          numero_sequencial: number | null
          public_id: string
          revoked_at: string | null
          revoked_by: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Insert: {
          aluno_id: string
          created_at?: string
          created_by?: string | null
          dados_snapshot: Json
          escola_id: string
          hash_validacao: string
          id?: string
          mensalidade_id?: string | null
          numero_sequencial?: number | null
          public_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          aluno_id?: string
          created_at?: string
          created_by?: string | null
          dados_snapshot?: Json
          escola_id?: string
          hash_validacao?: string
          id?: string
          mensalidade_id?: string | null
          numero_sequencial?: number | null
          public_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
        }
        Relationships: [
          {
            foreignKeyName: "documentos_emitidos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "documentos_emitidos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "documentos_emitidos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "vw_search_mensalidades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_sequencia: {
        Row: {
          escola_id: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          escola_id: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          escola_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_sequencia_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_sequencia_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
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
      escola_users: {
        Row: {
          created_at: string | null
          escola_id: string
          id: string
          papel: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          id?: string
          papel?: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          id?: string
          papel?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escola_users_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_users_escola_id_fkey"
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
          plano_atual: Database["public"]["Enums"]["app_plan_tier"]
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
          plano_atual?: Database["public"]["Enums"]["app_plan_tier"]
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
          plano_atual?: Database["public"]["Enums"]["app_plan_tier"]
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
      fecho_caixa: {
        Row: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          data_fecho: string
          day_key: string
          declared_at: string | null
          declared_by: string | null
          declared_cash: number
          declared_mcx: number
          declared_tpa: number
          declared_transfer: number
          diferenca_especie: number | null
          diferenca_tpa: number | null
          diferenca_transferencia: number | null
          escola_id: string
          id: string
          observacao_aprovador: string | null
          operador_id: string
          status: string
          system_calculated_at: string | null
          system_cash: number
          system_mcx: number
          system_tpa: number
          system_transfer: number
          updated_at: string
          valor_declarado_especie: number
          valor_declarado_tpa: number
          valor_declarado_transferencia: number
          valor_sistema_especie: number | null
          valor_sistema_tpa: number | null
          valor_sistema_transferencia: number | null
        }
        Insert: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data_fecho: string
          day_key: string
          declared_at?: string | null
          declared_by?: string | null
          declared_cash?: number
          declared_mcx?: number
          declared_tpa?: number
          declared_transfer?: number
          diferenca_especie?: number | null
          diferenca_tpa?: number | null
          diferenca_transferencia?: number | null
          escola_id: string
          id?: string
          observacao_aprovador?: string | null
          operador_id: string
          status?: string
          system_calculated_at?: string | null
          system_cash?: number
          system_mcx?: number
          system_tpa?: number
          system_transfer?: number
          updated_at?: string
          valor_declarado_especie: number
          valor_declarado_tpa: number
          valor_declarado_transferencia: number
          valor_sistema_especie?: number | null
          valor_sistema_tpa?: number | null
          valor_sistema_transferencia?: number | null
        }
        Update: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data_fecho?: string
          day_key?: string
          declared_at?: string | null
          declared_by?: string | null
          declared_cash?: number
          declared_mcx?: number
          declared_tpa?: number
          declared_transfer?: number
          diferenca_especie?: number | null
          diferenca_tpa?: number | null
          diferenca_transferencia?: number | null
          escola_id?: string
          id?: string
          observacao_aprovador?: string | null
          operador_id?: string
          status?: string
          system_calculated_at?: string | null
          system_cash?: number
          system_mcx?: number
          system_tpa?: number
          system_transfer?: number
          updated_at?: string
          valor_declarado_especie?: number
          valor_declarado_tpa?: number
          valor_declarado_transferencia?: number
          valor_sistema_especie?: number | null
          valor_sistema_tpa?: number | null
          valor_sistema_transferencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fecho_caixa_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fecho_caixa_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payment_intents: {
        Row: {
          aluno_id: string | null
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          dedupe_key: string
          escola_id: string
          external_ref: string | null
          id: string
          mensalidade_id: string | null
          method: string
          proof_url: string | null
          status: string
        }
        Insert: {
          aluno_id?: string | null
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          dedupe_key: string
          escola_id: string
          external_ref?: string | null
          id?: string
          mensalidade_id?: string | null
          method: string
          proof_url?: string | null
          status?: string
        }
        Update: {
          aluno_id?: string | null
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          dedupe_key?: string
          escola_id?: string
          external_ref?: string | null
          id?: string
          mensalidade_id?: string | null
          method?: string
          proof_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payment_intents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "finance_payment_intents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "finance_payment_intents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "vw_search_mensalidades"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_campanhas_cobranca: {
        Row: {
          canal: string
          created_at: string
          criado_por: string | null
          data_agendamento: string
          data_envio: string | null
          destinatarios_stats: Json | null
          escola_id: string
          id: string
          nome: string
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          criado_por?: string | null
          data_agendamento: string
          data_envio?: string | null
          destinatarios_stats?: Json | null
          escola_id: string
          id?: string
          nome: string
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          criado_por?: string | null
          data_agendamento?: string
          data_envio?: string | null
          destinatarios_stats?: Json | null
          escola_id?: string
          id?: string
          nome?: string
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_campanhas_cobranca_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_campanhas_cobranca_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_campanhas_cobranca_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "financeiro_templates_mensagem"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_cobrancas: {
        Row: {
          aluno_id: string
          canal: string
          created_at: string
          created_by: string | null
          enviado_em: string
          escola_id: string
          id: string
          mensagem: string | null
          mensalidade_id: string | null
          resposta: string | null
          status: Database["public"]["Enums"]["cobranca_status"]
          updated_at: string
        }
        Insert: {
          aluno_id: string
          canal: string
          created_at?: string
          created_by?: string | null
          enviado_em?: string
          escola_id: string
          id?: string
          mensagem?: string | null
          mensalidade_id?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          canal?: string
          created_at?: string
          created_by?: string | null
          enviado_em?: string
          escola_id?: string
          id?: string
          mensagem?: string | null
          mensalidade_id?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_cobrancas_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "vw_search_mensalidades"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_contratos: {
        Row: {
          aluno_id: string
          ano_letivo: number
          created_at: string
          desconto_percentual: number | null
          escola_id: string
          id: string
          matricula_id: string
          plano: string | null
          status: string
        }
        Insert: {
          aluno_id: string
          ano_letivo: number
          created_at?: string
          desconto_percentual?: number | null
          escola_id: string
          id?: string
          matricula_id: string
          plano?: string | null
          status?: string
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number
          created_at?: string
          desconto_percentual?: number | null
          escola_id?: string
          id?: string
          matricula_id?: string
          plano?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "financeiro_contratos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "financeiro_contratos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contratos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "financeiro_contratos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_estornos: {
        Row: {
          created_at: string
          created_by: string | null
          escola_id: string
          id: string
          mensalidade_id: string
          motivo: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          escola_id: string
          id?: string
          mensalidade_id: string
          motivo?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          escola_id?: string
          id?: string
          mensalidade_id?: string
          motivo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_estornos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_estornos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_estornos_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_estornos_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "vw_search_mensalidades"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_itens: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["financeiro_categoria_item"]
          controla_estoque: boolean
          created_at: string | null
          escola_id: string
          estoque_atual: number
          id: string
          nome: string
          preco: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["financeiro_categoria_item"]
          controla_estoque?: boolean
          created_at?: string | null
          escola_id: string
          estoque_atual?: number
          id?: string
          nome: string
          preco?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["financeiro_categoria_item"]
          controla_estoque?: boolean
          created_at?: string | null
          escola_id?: string
          estoque_atual?: number
          id?: string
          nome?: string
          preco?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_itens_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_itens_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          aluno_id: string
          ano_referencia: number | null
          categoria: Database["public"]["Enums"]["financeiro_categoria_item"]
          comprovativo_url: string | null
          created_at: string | null
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          escola_id: string
          id: string
          matricula_id: string | null
          mes_referencia: number | null
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento_enum"]
            | null
          origem: Database["public"]["Enums"]["financeiro_origem"]
          status: Database["public"]["Enums"]["financeiro_status"] | null
          tipo: Database["public"]["Enums"]["financeiro_tipo_transacao"]
          updated_at: string | null
          valor_desconto: number | null
          valor_multa: number | null
          valor_original: number
          valor_total: number | null
        }
        Insert: {
          aluno_id: string
          ano_referencia?: number | null
          categoria?: Database["public"]["Enums"]["financeiro_categoria_item"]
          comprovativo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          escola_id: string
          id?: string
          matricula_id?: string | null
          mes_referencia?: number | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento_enum"]
            | null
          origem: Database["public"]["Enums"]["financeiro_origem"]
          status?: Database["public"]["Enums"]["financeiro_status"] | null
          tipo: Database["public"]["Enums"]["financeiro_tipo_transacao"]
          updated_at?: string | null
          valor_desconto?: number | null
          valor_multa?: number | null
          valor_original?: number
          valor_total?: number | null
        }
        Update: {
          aluno_id?: string
          ano_referencia?: number | null
          categoria?: Database["public"]["Enums"]["financeiro_categoria_item"]
          comprovativo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          escola_id?: string
          id?: string
          matricula_id?: string | null
          mes_referencia?: number | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento_enum"]
            | null
          origem?: Database["public"]["Enums"]["financeiro_origem"]
          status?: Database["public"]["Enums"]["financeiro_status"] | null
          tipo?: Database["public"]["Enums"]["financeiro_tipo_transacao"]
          updated_at?: string | null
          valor_desconto?: number | null
          valor_multa?: number | null
          valor_original?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_tabelas: {
        Row: {
          ano_letivo: number
          classe_id: string | null
          created_at: string | null
          curso_id: string | null
          dia_vencimento: number | null
          escola_id: string
          id: string
          multa_atraso_percentual: number | null
          multa_diaria: number | null
          updated_at: string | null
          valor_matricula: number
          valor_mensalidade: number
        }
        Insert: {
          ano_letivo: number
          classe_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          dia_vencimento?: number | null
          escola_id: string
          id?: string
          multa_atraso_percentual?: number | null
          multa_diaria?: number | null
          updated_at?: string | null
          valor_matricula?: number
          valor_mensalidade?: number
        }
        Update: {
          ano_letivo?: number
          classe_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          dia_vencimento?: number | null
          escola_id?: string
          id?: string
          multa_atraso_percentual?: number | null
          multa_diaria?: number | null
          updated_at?: string | null
          valor_matricula?: number
          valor_mensalidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_tabelas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_tabelas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "vw_search_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_tabelas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_tabelas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_tabelas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_tabelas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_templates_cobranca: {
        Row: {
          canal: string
          corpo: string
          created_at: string
          criado_por: string | null
          escola_id: string
          id: string
          nome: string
        }
        Insert: {
          canal: string
          corpo: string
          created_at?: string
          criado_por?: string | null
          escola_id: string
          id?: string
          nome: string
        }
        Update: {
          canal?: string
          corpo?: string
          created_at?: string
          criado_por?: string | null
          escola_id?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      financeiro_templates_mensagem: {
        Row: {
          canal: string
          conteudo: string
          created_at: string
          escola_id: string
          id: string
          nome: string
          updated_at: string
          variaveis: string[] | null
        }
        Insert: {
          canal: string
          conteudo: string
          created_at?: string
          escola_id: string
          id?: string
          nome: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Update: {
          canal?: string
          conteudo?: string
          created_at?: string
          escola_id?: string
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_templates_mensagem_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_templates_mensagem_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_titulos: {
        Row: {
          aluno_id: string
          competencia: string | null
          contrato_id: string | null
          created_at: string
          escola_id: string
          id: string
          pago_em: string | null
          referencia: string | null
          status: string
          tipo: string
          valor_desconto: number | null
          valor_original: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          aluno_id: string
          competencia?: string | null
          contrato_id?: string | null
          created_at?: string
          escola_id: string
          id?: string
          pago_em?: string | null
          referencia?: string | null
          status?: string
          tipo: string
          valor_desconto?: number | null
          valor_original: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          aluno_id?: string
          competencia?: string | null
          contrato_id?: string | null
          created_at?: string
          escola_id?: string
          id?: string
          pago_em?: string | null
          referencia?: string | null
          status?: string
          tipo?: string
          valor_desconto?: number | null
          valor_original?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_titulos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_titulos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_titulos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_titulos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "financeiro_titulos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_titulos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_titulos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_titulos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_transacoes_importadas: {
        Row: {
          aluno_match_details: Json | null
          banco: string
          conta: string | null
          created_at: string
          data: string
          descricao: string | null
          escola_id: string
          id: string
          import_id: string | null
          match_confianca: number | null
          raw_data: Json | null
          referencia: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          aluno_match_details?: Json | null
          banco: string
          conta?: string | null
          created_at?: string
          data: string
          descricao?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          match_confianca?: number | null
          raw_data?: Json | null
          referencia?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          aluno_match_details?: Json | null
          banco?: string
          conta?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          match_confianca?: number | null
          raw_data?: Json | null
          referencia?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_transacoes_importadas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_transacoes_importadas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencia_status_periodo: {
        Row: {
          abaixo_minimo: boolean
          aluno_id: string
          atrasos: number
          aulas_previstas: number
          created_at: string
          escola_id: string
          faltas: number
          frequencia_min_percent: number
          id: string
          matricula_id: string
          percentual_presenca: number
          periodo_letivo_id: string
          presencas: number
          turma_id: string
          updated_at: string
        }
        Insert: {
          abaixo_minimo?: boolean
          aluno_id: string
          atrasos?: number
          aulas_previstas?: number
          created_at?: string
          escola_id: string
          faltas?: number
          frequencia_min_percent?: number
          id?: string
          matricula_id: string
          percentual_presenca?: number
          periodo_letivo_id: string
          presencas?: number
          turma_id: string
          updated_at?: string
        }
        Update: {
          abaixo_minimo?: boolean
          aluno_id?: string
          atrasos?: number
          aulas_previstas?: number
          created_at?: string
          escola_id?: string
          faltas?: number
          frequencia_min_percent?: number
          id?: string
          matricula_id?: string
          percentual_presenca?: number
          periodo_letivo_id?: string
          presencas?: number
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_status_periodo_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_periodo_letivo_id_fkey"
            columns: ["periodo_letivo_id"]
            isOneToOne: false
            referencedRelation: "periodos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "frequencia_status_periodo_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencias: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
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
        ]
      }
      frequencias_2025_09: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_10: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_11: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2025_12: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2026_01: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2026_02: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_2026_03: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: []
      }
      frequencias_default: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
          periodo_letivo_id: string | null
          routine_id: string | null
          status: string
        }
        Insert: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data: string
          escola_id: string
          id?: string
          matricula_id: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status: string
        }
        Update: {
          aula_id?: string | null
          curso_oferta_id?: string | null
          data?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          periodo_letivo_id?: string | null
          routine_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "frequencias_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
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
      historico_anos: {
        Row: {
          aluno_id: string
          ano_letivo: number
          data_fechamento: string
          escola_id: string
          id: string
          media_geral: number | null
          resultado_final: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          ano_letivo: number
          data_fechamento?: string
          escola_id: string
          id?: string
          media_geral?: number | null
          resultado_final: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number
          data_fechamento?: string
          escola_id?: string
          id?: string
          media_geral?: number | null
          resultado_final?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_anos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "historico_anos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "historico_anos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "historico_anos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_disciplinas: {
        Row: {
          disciplina_id: string
          faltas_totais: number | null
          historico_ano_id: string
          id: string
          media_final: number | null
          resultado: string | null
        }
        Insert: {
          disciplina_id: string
          faltas_totais?: number | null
          historico_ano_id: string
          id?: string
          media_final?: number | null
          resultado?: string | null
        }
        Update: {
          disciplina_id?: string
          faltas_totais?: number | null
          historico_ano_id?: string
          id?: string
          media_final?: number | null
          resultado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_disciplinas_historico_ano_id_fkey"
            columns: ["historico_ano_id"]
            isOneToOne: false
            referencedRelation: "historico_anos"
            referencedColumns: ["id"]
          },
        ]
      }
      horario_slots: {
        Row: {
          created_at: string | null
          dia_semana: number
          escola_id: string
          fim: string
          id: string
          inicio: string
          is_intervalo: boolean | null
          ordem: number
          turno_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dia_semana: number
          escola_id: string
          fim: string
          id?: string
          inicio: string
          is_intervalo?: boolean | null
          ordem: number
          turno_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dia_semana?: number
          escola_id?: string
          fim?: string
          id?: string
          inicio?: string
          is_intervalo?: boolean | null
          ordem?: number
          turno_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horario_slots_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_slots_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          column_name: string | null
          created_at: string | null
          id: number
          import_id: string
          message: string
          raw_value: string | null
          row_number: number | null
        }
        Insert: {
          column_name?: string | null
          created_at?: string | null
          id?: number
          import_id: string
          message: string
          raw_value?: string | null
          row_number?: number | null
        }
        Update: {
          column_name?: string | null
          created_at?: string | null
          id?: number
          import_id?: string
          message?: string
          raw_value?: string | null
          row_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_migrations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_migrations: {
        Row: {
          column_map: Json | null
          created_at: string | null
          created_by: string | null
          error_rows: number | null
          escola_id: string
          file_hash: string | null
          file_name: string | null
          id: string
          imported_rows: number | null
          processed_at: string | null
          status: string
          storage_path: string | null
          total_rows: number | null
        }
        Insert: {
          column_map?: Json | null
          created_at?: string | null
          created_by?: string | null
          error_rows?: number | null
          escola_id: string
          file_hash?: string | null
          file_name?: string | null
          id?: string
          imported_rows?: number | null
          processed_at?: string | null
          status?: string
          storage_path?: string | null
          total_rows?: number | null
        }
        Update: {
          column_map?: Json | null
          created_at?: string | null
          created_by?: string | null
          error_rows?: number | null
          escola_id?: string
          file_hash?: string | null
          file_name?: string | null
          id?: string
          imported_rows?: number | null
          processed_at?: string | null
          status?: string
          storage_path?: string | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_migrations_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_migrations_escola_fk"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
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
        Relationships: [
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
      lancamentos_2026_01: {
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
      lancamentos_2026_02: {
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
      lancamentos_2026_03: {
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
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      matricula_counters: {
        Row: {
          escola_id: string
          last_value: number
          updated_at: string
        }
        Insert: {
          escola_id: string
          last_value?: number
          updated_at?: string
        }
        Update: {
          escola_id?: string
          last_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matricula_counters_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matricula_counters_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          ano_letivo: number | null
          ativo: boolean | null
          created_at: string | null
          data_inicio_financeiro: string | null
          data_matricula: string | null
          escola_id: string
          id: string
          import_id: string | null
          numero_chamada: number | null
          numero_matricula: string | null
          secao_id: string | null
          session_id: string | null
          status: string
          turma_id: string | null
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          ano_letivo?: number | null
          ativo?: boolean | null
          created_at?: string | null
          data_inicio_financeiro?: string | null
          data_matricula?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          numero_chamada?: number | null
          numero_matricula?: string | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          turma_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number | null
          ativo?: boolean | null
          created_at?: string | null
          data_inicio_financeiro?: string | null
          data_matricula?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          numero_chamada?: number | null
          numero_matricula?: string | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          turma_id?: string | null
          updated_at?: string | null
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
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
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
            foreignKeyName: "matriculas_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_migrations"
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
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
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
          {
            foreignKeyName: "matriculas_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalidades: {
        Row: {
          aluno_id: string
          ano_letivo: string | null
          ano_referencia: number | null
          created_at: string
          data_pagamento_efetiva: string | null
          data_vencimento: string
          escola_id: string | null
          id: string
          matricula_id: string | null
          mes_referencia: number | null
          metodo_pagamento: string | null
          observacao: string | null
          observacoes: string | null
          status: string | null
          turma_id: string | null
          updated_at: string
          updated_by: string | null
          valor: number
          valor_pago_total: number | null
          valor_previsto: number | null
        }
        Insert: {
          aluno_id: string
          ano_letivo?: string | null
          ano_referencia?: number | null
          created_at?: string
          data_pagamento_efetiva?: string | null
          data_vencimento: string
          escola_id?: string | null
          id?: string
          matricula_id?: string | null
          mes_referencia?: number | null
          metodo_pagamento?: string | null
          observacao?: string | null
          observacoes?: string | null
          status?: string | null
          turma_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: number
          valor_pago_total?: number | null
          valor_previsto?: number | null
        }
        Update: {
          aluno_id?: string
          ano_letivo?: string | null
          ano_referencia?: number | null
          created_at?: string
          data_pagamento_efetiva?: string | null
          data_vencimento?: string
          escola_id?: string | null
          id?: string
          matricula_id?: string | null
          mes_referencia?: number | null
          metodo_pagamento?: string | null
          observacao?: string | null
          observacoes?: string | null
          status?: string | null
          turma_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_pago_total?: number | null
          valor_previsto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_avaliacao: {
        Row: {
          componentes: Json
          created_at: string
          escola_id: string
          formula: Json
          id: string
          is_default: boolean | null
          nome: string
          regras: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          componentes?: Json
          created_at?: string
          escola_id: string
          formula?: Json
          id?: string
          is_default?: boolean | null
          nome: string
          regras?: Json
          tipo?: string
          updated_at?: string
        }
        Update: {
          componentes?: Json
          created_at?: string
          escola_id?: string
          formula?: Json
          id?: string
          is_default?: boolean | null
          nome?: string
          regras?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          avaliacao_id: string
          created_at: string
          escola_id: string
          id: string
          matricula_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          avaliacao_id: string
          created_at?: string
          escola_id: string
          id?: string
          matricula_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          avaliacao_id?: string
          created_at?: string
          escola_id?: string
          id?: string
          matricula_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_escola_id_fkey1"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_escola_id_fkey1"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "notas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_avaliacoes: {
        Row: {
          aluno_id: string
          avaliacao_id: string
          id: string
          matricula_id: string
          observacao: string | null
          observado_em: string
          valor: number
        }
        Insert: {
          aluno_id: string
          avaliacao_id: string
          id?: string
          matricula_id: string
          observacao?: string | null
          observado_em?: string
          valor: number
        }
        Update: {
          aluno_id?: string
          avaliacao_id?: string
          id?: string
          matricula_id?: string
          observacao?: string | null
          observado_em?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
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
      notifications: {
        Row: {
          created_at: string
          escola_id: string
          id: string
          lida: boolean
          link_acao: string | null
          mensagem: string | null
          target_role: Database["public"]["Enums"]["user_role"]
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          escola_id: string
          id?: string
          lida?: boolean
          link_acao?: string | null
          mensagem?: string | null
          target_role?: Database["public"]["Enums"]["user_role"]
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          escola_id?: string
          id?: string
          lida?: boolean
          link_acao?: string | null
          mensagem?: string | null
          target_role?: Database["public"]["Enums"]["user_role"]
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      numero_counters: {
        Row: {
          escola_id: string
          last_value: number
          tipo: string
          updated_at: string
        }
        Insert: {
          escola_id: string
          last_value?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          escola_id?: string
          last_value?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "numero_counters_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "numero_counters_escola_id_fkey"
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
      outbox_events: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          escola_id: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          tenant_scope: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          escola_id: string
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          tenant_scope?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          escola_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          tenant_scope?: string | null
        }
        Relationships: []
      }
      outbox_notificacoes: {
        Row: {
          aluno_id: string
          canal: string
          created_at: string
          destino: string | null
          error_message: string | null
          escola_id: string
          id: string
          mensagem: string | null
          mensagem_id: string | null
          payload: Json | null
          processed_at: string | null
          request_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          aluno_id: string
          canal: string
          created_at?: string
          destino?: string | null
          error_message?: string | null
          escola_id: string
          id?: string
          mensagem?: string | null
          mensagem_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          request_id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          aluno_id?: string
          canal?: string
          created_at?: string
          destino?: string | null
          error_message?: string | null
          escola_id?: string
          id?: string
          mensagem?: string | null
          mensagem_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          request_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_notificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_notificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_notificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "outbox_notificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "outbox_notificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_notificacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_notificacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_intents: {
        Row: {
          aluno_id: string
          amount: number
          created_at: string
          created_by: string
          currency: string
          escola_id: string
          evidence_url: string | null
          id: string
          meta: Json
          method: string
          reference: string | null
          servico_pedido_id: string | null
          settled_at: string | null
          status: string
          terminal_id: string | null
        }
        Insert: {
          aluno_id: string
          amount: number
          created_at?: string
          created_by?: string
          currency?: string
          escola_id: string
          evidence_url?: string | null
          id?: string
          meta?: Json
          method: string
          reference?: string | null
          servico_pedido_id?: string | null
          settled_at?: string | null
          status: string
          terminal_id?: string | null
        }
        Update: {
          aluno_id?: string
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          escola_id?: string
          evidence_url?: string | null
          id?: string
          meta?: Json
          method?: string
          reference?: string | null
          servico_pedido_id?: string | null
          settled_at?: string | null
          status?: string
          terminal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_intents_servico_pedido_id_fkey"
            columns: ["servico_pedido_id"]
            isOneToOne: false
            referencedRelation: "servico_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          aluno_id: string | null
          conciliado: boolean | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          day_key: string
          escola_id: string
          evidence_url: string | null
          gateway_ref: string | null
          id: string
          mensalidade_id: string | null
          meta: Json
          metodo: string
          metodo_pagamento: string | null
          reference: string | null
          referencia: string | null
          settled_at: string | null
          settled_by: string | null
          status: string
          telemovel_origem: string | null
          transacao_id_externo: string | null
          updated_at: string | null
          valor_pago: number
        }
        Insert: {
          aluno_id?: string | null
          conciliado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          day_key?: string
          escola_id: string
          evidence_url?: string | null
          gateway_ref?: string | null
          id?: string
          mensalidade_id?: string | null
          meta?: Json
          metodo?: string
          metodo_pagamento?: string | null
          reference?: string | null
          referencia?: string | null
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          telemovel_origem?: string | null
          transacao_id_externo?: string | null
          updated_at?: string | null
          valor_pago: number
        }
        Update: {
          aluno_id?: string | null
          conciliado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          day_key?: string
          escola_id?: string
          evidence_url?: string | null
          gateway_ref?: string | null
          id?: string
          mensalidade_id?: string | null
          meta?: Json
          metodo?: string
          metodo_pagamento?: string | null
          reference?: string | null
          referencia?: string | null
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          telemovel_origem?: string | null
          transacao_id_externo?: string | null
          updated_at?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "vw_search_mensalidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas_lote_itens: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          pdf_path: string | null
          status: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          pdf_path?: string | null
          status?: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          pdf_path?: string | null
          status?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pautas_lote_itens_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "pautas_lote_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_lote_itens_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_lote_itens_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "pautas_lote_itens_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas_lote_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          escola_id: string
          failed_count: number
          id: string
          periodo_letivo_id: string | null
          processed: number
          status: string
          success_count: number
          tipo: string
          total_turmas: number
          updated_at: string
          zip_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          escola_id: string
          failed_count?: number
          id?: string
          periodo_letivo_id?: string | null
          processed?: number
          status?: string
          success_count?: number
          tipo: string
          total_turmas?: number
          updated_at?: string
          zip_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          escola_id?: string
          failed_count?: number
          id?: string
          periodo_letivo_id?: string | null
          processed?: number
          status?: string
          success_count?: number
          tipo?: string
          total_turmas?: number
          updated_at?: string
          zip_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pautas_lote_jobs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_lote_jobs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_lote_jobs_periodo_letivo_id_fkey"
            columns: ["periodo_letivo_id"]
            isOneToOne: false
            referencedRelation: "periodos_letivos"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas_oficiais: {
        Row: {
          created_at: string
          error_message: string | null
          escola_id: string
          generated_at: string
          hash: string
          id: string
          pdf_path: string
          periodo_letivo_id: string
          status: string
          tipo: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          escola_id: string
          generated_at?: string
          hash: string
          id?: string
          pdf_path: string
          periodo_letivo_id: string
          status?: string
          tipo?: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          escola_id?: string
          generated_at?: string
          hash?: string
          id?: string
          pdf_path?: string
          periodo_letivo_id?: string
          status?: string
          tipo?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pautas_oficiais_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_oficiais_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_oficiais_periodo_letivo_id_fkey"
            columns: ["periodo_letivo_id"]
            isOneToOne: false
            referencedRelation: "periodos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_oficiais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_oficiais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "pautas_oficiais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_letivos: {
        Row: {
          ano_letivo_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id: string
          numero: number
          peso: number | null
          tipo: Database["public"]["Enums"]["periodo_tipo"]
          trava_notas_em: string | null
          updated_at: string | null
        }
        Insert: {
          ano_letivo_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id?: string
          numero: number
          peso?: number | null
          tipo: Database["public"]["Enums"]["periodo_tipo"]
          trava_notas_em?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_letivo_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          escola_id?: string
          id?: string
          numero?: number
          peso?: number | null
          tipo?: Database["public"]["Enums"]["periodo_tipo"]
          trava_notas_em?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "periodos_letivos_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "anos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_letivos_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "vw_escola_ano_letivo_preferido"
            referencedColumns: ["ano_letivo_id"]
          },
          {
            foreignKeyName: "periodos_letivos_escola_id_fkey1"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_letivos_escola_id_fkey1"
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
      presencas_deprecated: {
        Row: {
          aluno_id: string
          created_at: string | null
          data: string
          disciplina_id: string | null
          escola_id: string
          id: string
          status: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          data: string
          disciplina_id?: string | null
          escola_id: string
          id?: string
          status: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          data?: string
          disciplina_id?: string | null
          escola_id?: string
          id?: string
          status?: string
          turma_id?: string
        }
        Relationships: [
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
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_disponibilidade: {
        Row: {
          created_at: string | null
          dia_semana: number
          escola_id: string
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          professor_id: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dia_semana: number
          escola_id: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          professor_id: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dia_semana?: number
          escola_id?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          professor_id?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_disponibilidade_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_disponibilidade_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_disponibilidade_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_disponibilidade_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "vw_search_professores"
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
          bi_numero: string | null
          created_at: string | null
          current_escola_id: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          encarregado_relacao: string | null
          escola_id: string | null
          global_role: string | null
          naturalidade: string | null
          nome: string
          numero_login: string | null
          onboarding_finalizado: boolean | null
          provincia: string | null
          role: Database["public"]["Enums"]["user_role"]
          sexo: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bi_numero?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          encarregado_relacao?: string | null
          escola_id?: string | null
          global_role?: string | null
          naturalidade?: string | null
          nome: string
          numero_login?: string | null
          onboarding_finalizado?: boolean | null
          provincia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sexo?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bi_numero?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          encarregado_relacao?: string | null
          escola_id?: string | null
          global_role?: string | null
          naturalidade?: string | null
          nome?: string
          numero_login?: string | null
          onboarding_finalizado?: boolean | null
          provincia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sexo?: string | null
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
      quadro_horarios: {
        Row: {
          created_at: string | null
          disciplina_id: string
          escola_id: string
          id: string
          professor_id: string | null
          sala_id: string | null
          slot_id: string
          turma_id: string
          versao_id: string
        }
        Insert: {
          created_at?: string | null
          disciplina_id: string
          escola_id: string
          id?: string
          professor_id?: string | null
          sala_id?: string | null
          slot_id: string
          turma_id: string
          versao_id: string
        }
        Update: {
          created_at?: string | null
          disciplina_id?: string
          escola_id?: string
          id?: string
          professor_id?: string | null
          sala_id?: string | null
          slot_id?: string
          turma_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadro_horarios_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "vw_search_professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "horario_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadro_horarios_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "quadro_horarios_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "rotinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "rotinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          capacidade: number | null
          created_at: string | null
          escola_id: string
          id: string
          nome: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          capacidade?: number | null
          created_at?: string | null
          escola_id: string
          id?: string
          nome: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          capacidade?: number | null
          created_at?: string | null
          escola_id?: string
          id?: string
          nome?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subjects: {
        Row: {
          created_at: string | null
          custom_name: string | null
          custom_weekly_hours: number | null
          escola_id: string
          id: string
          is_active: boolean | null
          preset_subject_id: string
        }
        Insert: {
          created_at?: string | null
          custom_name?: string | null
          custom_weekly_hours?: number | null
          escola_id: string
          id?: string
          is_active?: boolean | null
          preset_subject_id: string
        }
        Update: {
          created_at?: string | null
          custom_name?: string | null
          custom_weekly_hours?: number | null
          escola_id?: string
          id?: string
          is_active?: boolean | null
          preset_subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subjects_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subjects_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subjects_preset_subject_id_fkey"
            columns: ["preset_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_preset_subjects"
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
          {
            foreignKeyName: "secoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "secoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      servico_pedidos: {
        Row: {
          aluno_id: string
          contexto: Json
          created_at: string
          created_by: string
          escola_id: string
          id: string
          matricula_id: string | null
          reason_code: string | null
          reason_detail: string | null
          servico_codigo: string
          servico_escola_id: string
          servico_nome: string
          status: string
          valor_cobrado: number
        }
        Insert: {
          aluno_id: string
          contexto?: Json
          created_at?: string
          created_by?: string
          escola_id: string
          id?: string
          matricula_id?: string | null
          reason_code?: string | null
          reason_detail?: string | null
          servico_codigo: string
          servico_escola_id: string
          servico_nome: string
          status: string
          valor_cobrado?: number
        }
        Update: {
          aluno_id?: string
          contexto?: Json
          created_at?: string
          created_by?: string
          escola_id?: string
          id?: string
          matricula_id?: string | null
          reason_code?: string | null
          reason_detail?: string | null
          servico_codigo?: string
          servico_escola_id?: string
          servico_nome?: string
          status?: string
          valor_cobrado?: number
        }
        Relationships: [
          {
            foreignKeyName: "servico_pedidos_servico_escola_id_fkey"
            columns: ["servico_escola_id"]
            isOneToOne: false
            referencedRelation: "servicos_escola"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          escola_id: string
          id: string
          nome: string
          preco: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          escola_id: string
          id?: string
          nome: string
          preco?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          escola_id?: string
          id?: string
          nome?: string
          preco?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_catalogo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_catalogo_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_escola: {
        Row: {
          aceita_pagamento_pendente: boolean
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          documentos_necessarios: Json
          escola_id: string
          exige_aprovacao: boolean
          exige_pagamento_antes_de_liberar: boolean
          id: string
          nome: string
          pode_bloquear_por_debito: boolean
          updated_at: string
          valor_base: number
        }
        Insert: {
          aceita_pagamento_pendente?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          documentos_necessarios?: Json
          escola_id: string
          exige_aprovacao?: boolean
          exige_pagamento_antes_de_liberar?: boolean
          id?: string
          nome: string
          pode_bloquear_por_debito?: boolean
          updated_at?: string
          valor_base?: number
        }
        Update: {
          aceita_pagamento_pendente?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          documentos_necessarios?: Json
          escola_id?: string
          exige_aprovacao?: boolean
          exige_pagamento_antes_de_liberar?: boolean
          id?: string
          nome?: string
          pode_bloquear_por_debito?: boolean
          updated_at?: string
          valor_base?: number
        }
        Relationships: []
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
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_alunos: {
        Row: {
          ano_letivo: number | null
          bi: string | null
          bi_numero: string | null
          classe_numero: number | null
          created_at: string | null
          curso_codigo: string | null
          data_nascimento: string | null
          email: string | null
          encarregado_email: string | null
          encarregado_nome: string | null
          encarregado_telefone: string | null
          escola_id: string
          id: number
          import_id: string
          nif: string | null
          nome: string | null
          numero_matricula: string | null
          numero_processo: string | null
          profile_id: string | null
          raw_data: Json | null
          row_number: number | null
          sexo: string | null
          telefone: string | null
          turma_codigo: string | null
          turma_letra: string | null
          turno_codigo: string | null
        }
        Insert: {
          ano_letivo?: number | null
          bi?: string | null
          bi_numero?: string | null
          classe_numero?: number | null
          created_at?: string | null
          curso_codigo?: string | null
          data_nascimento?: string | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_telefone?: string | null
          escola_id: string
          id?: number
          import_id: string
          nif?: string | null
          nome?: string | null
          numero_matricula?: string | null
          numero_processo?: string | null
          profile_id?: string | null
          raw_data?: Json | null
          row_number?: number | null
          sexo?: string | null
          telefone?: string | null
          turma_codigo?: string | null
          turma_letra?: string | null
          turno_codigo?: string | null
        }
        Update: {
          ano_letivo?: number | null
          bi?: string | null
          bi_numero?: string | null
          classe_numero?: number | null
          created_at?: string | null
          curso_codigo?: string | null
          data_nascimento?: string | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_telefone?: string | null
          escola_id?: string
          id?: number
          import_id?: string
          nif?: string | null
          nome?: string | null
          numero_matricula?: string | null
          numero_processo?: string | null
          profile_id?: string | null
          raw_data?: Json | null
          row_number?: number | null
          sexo?: string | null
          telefone?: string | null
          turma_codigo?: string | null
          turma_letra?: string | null
          turno_codigo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staging_alunos_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_migrations"
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
      tabelas_mensalidade: {
        Row: {
          ativo: boolean
          classe_id: string | null
          created_at: string
          curso_id: string | null
          dia_vencimento: number | null
          escola_id: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          classe_id?: string | null
          created_at?: string
          curso_id?: string | null
          dia_vencimento?: number | null
          escola_id: string
          id?: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          classe_id?: string | null
          created_at?: string
          curso_id?: string | null
          dia_vencimento?: number | null
          escola_id?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_mensalidade_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabelas_mensalidade_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "vw_search_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabelas_mensalidade_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabelas_mensalidade_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabelas_mensalidade_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabelas_mensalidade_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_courses: {
        Row: {
          created_at: string
          curso_id: string
          escola_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          escola_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          escola_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_courses_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_courses_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_courses_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_courses_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_skills: {
        Row: {
          created_at: string
          disciplina_id: string
          escola_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          disciplina_id: string
          escola_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          disciplina_id?: string
          escola_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_skills_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_skills_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_skills_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_skills_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          area_formacao: string | null
          carga_horaria_maxima: number
          created_at: string
          data_nascimento: string | null
          escola_id: string
          genero: string
          habilitacoes: string
          id: string
          is_diretor_turma: boolean
          nome_completo: string
          numero_bi: string | null
          profile_id: string
          telefone_principal: string | null
          turnos_disponiveis: string[]
          updated_at: string
          vinculo_contratual: string
        }
        Insert: {
          area_formacao?: string | null
          carga_horaria_maxima: number
          created_at?: string
          data_nascimento?: string | null
          escola_id: string
          genero: string
          habilitacoes: string
          id?: string
          is_diretor_turma?: boolean
          nome_completo: string
          numero_bi?: string | null
          profile_id: string
          telefone_principal?: string | null
          turnos_disponiveis?: string[]
          updated_at?: string
          vinculo_contratual: string
        }
        Update: {
          area_formacao?: string | null
          carga_horaria_maxima?: number
          created_at?: string
          data_nascimento?: string | null
          escola_id?: string
          genero?: string
          habilitacoes?: string
          id?: string
          is_diretor_turma?: boolean
          nome_completo?: string
          numero_bi?: string | null
          profile_id?: string
          telefone_principal?: string | null
          turnos_disponiveis?: string[]
          updated_at?: string
          vinculo_contratual?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      turma_disciplinas: {
        Row: {
          avaliacao_disciplina_id: string | null
          avaliacao_mode: string | null
          carga_horaria_semanal: number | null
          classificacao: string | null
          created_at: string
          curso_matriz_id: string
          entra_no_horario: boolean | null
          escola_id: string
          id: string
          modelo_avaliacao_id: string | null
          periodos_ativos: number[] | null
          professor_id: string | null
          turma_id: string
        }
        Insert: {
          avaliacao_disciplina_id?: string | null
          avaliacao_mode?: string | null
          carga_horaria_semanal?: number | null
          classificacao?: string | null
          created_at?: string
          curso_matriz_id: string
          entra_no_horario?: boolean | null
          escola_id: string
          id?: string
          modelo_avaliacao_id?: string | null
          periodos_ativos?: number[] | null
          professor_id?: string | null
          turma_id: string
        }
        Update: {
          avaliacao_disciplina_id?: string | null
          avaliacao_mode?: string | null
          carga_horaria_semanal?: number | null
          classificacao?: string | null
          created_at?: string
          curso_matriz_id?: string
          entra_no_horario?: boolean | null
          escola_id?: string
          id?: string
          modelo_avaliacao_id?: string | null
          periodos_ativos?: number[] | null
          professor_id?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_disciplinas_avaliacao_disciplina_fk"
            columns: ["avaliacao_disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_curso_matriz_id_fkey"
            columns: ["curso_matriz_id"]
            isOneToOne: false
            referencedRelation: "curso_matriz"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_escola_id_fkey1"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_escola_id_fkey1"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_modelo_avaliacao_fk"
            columns: ["modelo_avaliacao_id"]
            isOneToOne: false
            referencedRelation: "modelos_avaliacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey1"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey1"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey1"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_disciplinas_professores: {
        Row: {
          created_at: string | null
          disciplina_id: string
          escola_id: string
          horarios: Json | null
          id: string
          planejamento: Json | null
          professor_id: string
          syllabus_id: string | null
          turma_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disciplina_id: string
          escola_id: string
          horarios?: Json | null
          id?: string
          planejamento?: Json | null
          professor_id: string
          syllabus_id?: string | null
          turma_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disciplina_id?: string
          escola_id?: string
          horarios?: Json | null
          id?: string
          planejamento?: Json | null
          professor_id?: string
          syllabus_id?: string | null
          turma_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turma_disciplinas_professores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "vw_search_professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ano_letivo: number | null
          ano_letivo_id: string | null
          capacidade_maxima: number | null
          classe_id: string | null
          classe_num: number | null
          coordenador_pedagogico_id: string | null
          created_at: string | null
          curso_id: string | null
          diretor_turma_id: string | null
          escola_id: string
          id: string
          import_id: string | null
          letra: string | null
          nome: string
          sala: string | null
          session_id: string | null
          status_fecho: string
          status_validacao: string | null
          turma_code: string | null
          turma_codigo: string | null
          turno: string | null
          updated_at: string | null
        }
        Insert: {
          ano_letivo?: number | null
          ano_letivo_id?: string | null
          capacidade_maxima?: number | null
          classe_id?: string | null
          classe_num?: number | null
          coordenador_pedagogico_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          diretor_turma_id?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          letra?: string | null
          nome: string
          sala?: string | null
          session_id?: string | null
          status_fecho?: string
          status_validacao?: string | null
          turma_code?: string | null
          turma_codigo?: string | null
          turno?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_letivo?: number | null
          ano_letivo_id?: string | null
          capacidade_maxima?: number | null
          classe_id?: string | null
          classe_num?: number | null
          coordenador_pedagogico_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          diretor_turma_id?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          letra?: string | null
          nome?: string
          sala?: string | null
          session_id?: string | null
          status_fecho?: string
          status_validacao?: string | null
          turma_code?: string | null
          turma_codigo?: string | null
          turno?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "vw_search_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
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
        ]
      }
    }
    Views: {
      escola_usuarios: {
        Row: {
          created_at: string | null
          escola_id: string | null
          id: string | null
          papel: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          escola_id?: string | null
          id?: string | null
          papel?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          escola_id?: string | null
          id?: string | null
          papel?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escola_users_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_users_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escolas_view: {
        Row: {
          cidade: string | null
          estado: string | null
          id: string | null
          last_access: string | null
          nome: string | null
          plano: string | null
          plano_atual: Database["public"]["Enums"]["app_plan_tier"] | null
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
        Relationships: []
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
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
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
        Relationships: []
      }
      presencas: {
        Row: {
          aluno_id: string | null
          data: string | null
          disciplina_id: string | null
          escola_id: string | null
          id: string | null
          status: string | null
          turma_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curso_matriz_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
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
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
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
        Relationships: []
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
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
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
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_total_em_aberto_por_mes: {
        Row: {
          ano: number | null
          escola_id: string | null
          mes: number | null
          total_aberto: number | null
        }
        Relationships: []
      }
      vw_admin_dashboard_counts: {
        Row: {
          alunos_ativos: number | null
          avaliacoes_total: number | null
          escola_id: string | null
          professores_total: number | null
          turmas_total: number | null
        }
        Relationships: []
      }
      vw_admin_matriculas_por_mes: {
        Row: {
          escola_id: string | null
          mes: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_admin_pending_turmas_count: {
        Row: {
          escola_id: string | null
          pendentes_total: number | null
        }
        Relationships: []
      }
      vw_admissoes_counts_por_status: {
        Row: {
          aprovada_total: number | null
          em_analise_total: number | null
          escola_id: string | null
          matriculado_7d_total: number | null
          submetida_total: number | null
        }
        Relationships: []
      }
      vw_alunos_active: {
        Row: {
          bi_numero: string | null
          created_at: string | null
          data_nascimento: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          email: string | null
          encarregado_email: string | null
          encarregado_nome: string | null
          encarregado_telefone: string | null
          escola_id: string | null
          id: string | null
          import_id: string | null
          naturalidade: string | null
          nif: string | null
          nome: string | null
          nome_completo: string | null
          numero_processo: string | null
          profile_id: string | null
          responsavel: string | null
          responsavel_contato: string | null
          responsavel_nome: string | null
          search_text: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          telefone_responsavel: string | null
          tsv: unknown
          updated_at: string | null
        }
        Insert: {
          bi_numero?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_telefone?: string | null
          escola_id?: string | null
          id?: string | null
          import_id?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome?: string | null
          nome_completo?: string | null
          numero_processo?: string | null
          profile_id?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          search_text?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tsv?: unknown
          updated_at?: string | null
        }
        Update: {
          bi_numero?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_telefone?: string | null
          escola_id?: string | null
          id?: string | null
          import_id?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome?: string | null
          nome_completo?: string | null
          numero_processo?: string | null
          profile_id?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          search_text?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tsv?: unknown
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      vw_balcao_secretaria: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          encarregado_telefone: string | null
          escola_id: string | null
          esta_inadimplente: boolean | null
          sync_status: string | null
          total_pendente: number | null
          turma_id: string | null
          turma_nome: string | null
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
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_boletim_consolidado: {
        Row: {
          aluno_id: string | null
          disciplina: string | null
          faltas_total: number | null
          needs_config: boolean | null
          nota_final: number | null
          status: string | null
          trimestre: number | null
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
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_boletim_por_matricula: {
        Row: {
          aluno_id: string | null
          ano_letivo: number | null
          disciplina_id: string | null
          disciplina_nome: string | null
          disciplina_sigla: string | null
          escola_id: string | null
          has_missing: boolean | null
          matricula_id: string | null
          missing_count: number | null
          needs_config: boolean | null
          nota_final: number | null
          notas_por_tipo: Json | null
          status: string | null
          total_avaliacoes: number | null
          total_notas: number | null
          trimestre: number | null
          turma_id: string | null
        }
        Relationships: []
      }
      vw_boletim_por_matricula_legacy: {
        Row: {
          aluno_id: string | null
          ano_letivo: number | null
          disciplina_id: string | null
          disciplina_nome: string | null
          disciplina_sigla: string | null
          escola_id: string | null
          has_missing: boolean | null
          matricula_id: string | null
          missing_count: number | null
          needs_config: boolean | null
          nota_final: number | null
          notas_por_tipo: Json | null
          status: string | null
          total_avaliacoes: number | null
          total_notas: number | null
          trimestre: number | null
          turma_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curso_matriz_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
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
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_cursos_reais: {
        Row: {
          codigo: string | null
          course_code: string | null
          curriculum_key: string | null
          descricao: string | null
          escola_id: string | null
          id: string | null
          nivel: string | null
          nome: string | null
          semestre_id: string | null
          status_aprovacao: string | null
          tipo: string | null
        }
        Relationships: []
      }
      vw_escola_ano_letivo_preferido: {
        Row: {
          ano_letivo_id: string | null
          escola_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anos_letivos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anos_letivos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_escola_cursos_stats: {
        Row: {
          codigo: string | null
          course_code: string | null
          curriculum_key: string | null
          descricao: string | null
          escola_id: string | null
          id: string | null
          nivel: string | null
          nome: string | null
          tipo: string | null
        }
        Relationships: []
      }
      vw_escola_estrutura_counts: {
        Row: {
          classes_total: number | null
          cursos_total: number | null
          disciplinas_total: number | null
          escola_id: string | null
        }
        Relationships: []
      }
      vw_escola_info: {
        Row: {
          escola_id: string | null
          nome: string | null
          plano_atual: Database["public"]["Enums"]["app_plan_tier"] | null
          status: string | null
        }
        Relationships: []
      }
      vw_escola_setup_status: {
        Row: {
          escola_id: string | null
          has_3_trimestres: boolean | null
          has_ano_letivo_ativo: boolean | null
          has_curriculo_published: boolean | null
          has_turmas_no_ano: boolean | null
          percentage: number | null
        }
        Relationships: []
      }
      vw_financeiro_cobrancas_diario: {
        Row: {
          dia: string | null
          enviadas: number | null
          escola_id: string | null
          pagos: number | null
          respondidas: number | null
          valor_recuperado: number | null
        }
        Relationships: []
      }
      vw_financeiro_dashboard: {
        Row: {
          alunos_em_dia: number | null
          alunos_inadimplentes: number | null
          data_referencia: string | null
          escola_id: string | null
          sync_status: string | null
          sync_updated_at: string | null
          total_inadimplente: number | null
          total_pago: number | null
          total_pendente: number | null
        }
        Relationships: []
      }
      vw_financeiro_escola_dia: {
        Row: {
          dia: string | null
          escola_id: string | null
          qtd_pagos: number | null
          qtd_total: number | null
        }
        Relationships: []
      }
      vw_financeiro_inadimplencia_top: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          dias_em_atraso: number | null
          escola_id: string | null
          valor_em_atraso: number | null
        }
        Relationships: []
      }
      vw_financeiro_kpis_geral: {
        Row: {
          escola_id: string | null
          inadimplentes_total: number | null
          matriculados_total: number | null
          pagos_total: number | null
          pagos_valor: number | null
          pendentes_total: number | null
          pendentes_valor: number | null
          risco_total: number | null
        }
        Relationships: []
      }
      vw_financeiro_kpis_mes: {
        Row: {
          escola_id: string | null
          inadimplencia_total: number | null
          mes_ref: string | null
          previsto_total: number | null
          realizado_total: number | null
        }
        Relationships: []
      }
      vw_financeiro_missing_pricing_count: {
        Row: {
          ano_letivo: number | null
          escola_id: string | null
          missing_count: number | null
        }
        Relationships: []
      }
      vw_financeiro_propinas_mensal_escola: {
        Row: {
          ano: number | null
          ano_letivo: string | null
          competencia_mes: string | null
          escola_id: string | null
          inadimplencia_pct: number | null
          mes: number | null
          qtd_em_atraso: number | null
          qtd_mensalidades: number | null
          total_em_atraso: number | null
          total_pago: number | null
          total_previsto: number | null
        }
        Relationships: []
      }
      vw_financeiro_propinas_por_turma: {
        Row: {
          ano_letivo: number | null
          classe_label: string | null
          escola_id: string | null
          inadimplencia_pct: number | null
          qtd_em_atraso: number | null
          qtd_mensalidades: number | null
          total_em_atraso: number | null
          total_pago: number | null
          total_previsto: number | null
          turma_id: string | null
          turma_nome: string | null
          turno: string | null
        }
        Relationships: []
      }
      vw_financeiro_radar_resumo: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          escola_id: string | null
          meses_atraso: string[] | null
          responsavel_nome: string | null
          telefone_responsavel: string | null
          turma_nome: string | null
          valor_total_atraso: number | null
        }
        Relationships: []
      }
      vw_financeiro_sidebar_badges: {
        Row: {
          candidaturas_pendentes: number | null
          cobrancas_pendentes: number | null
          escola_id: string | null
        }
        Relationships: []
      }
      vw_freq_por_turma_dia: {
        Row: {
          dia: string | null
          escola_id: string | null
          presentes: number | null
          total: number | null
          turma_id: string | null
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
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_frequencia_resumo_aluno: {
        Row: {
          aluno_id: string | null
          atrasos: number | null
          escola_id: string | null
          faltas: number | null
          percentual_presenca: number | null
          presentes: number | null
          total_registros: number | null
          turma_id: string | null
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
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
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
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_matriculas_secretaria: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          aluno_status: string | null
          ano_letivo: number | null
          created_at: string | null
          escola_id: string | null
          matricula_id: string | null
          matricula_status: string | null
          numero_matricula: string | null
          turma_id: string | null
          turma_nome: string | null
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
      vw_matriculas_validas: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          ano_letivo: number | null
          ano_letivo_id: string | null
          bi_numero: string | null
          classe_id: string | null
          classe_nome: string | null
          created_at: string | null
          curso_id: string | null
          curso_nome: string | null
          curso_tipo: string | null
          data_matricula: string | null
          escola_id: string | null
          id: string | null
          nome_completo: string | null
          numero_chamada: number | null
          numero_matricula: string | null
          numero_processo: string | null
          sala: string | null
          session_id: string | null
          status: string | null
          turma_id: string | null
          turma_nome: string | null
          turno: string | null
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
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
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
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_letivos_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "anos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_letivos_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "vw_escola_ano_letivo_preferido"
            referencedColumns: ["ano_letivo_id"]
          },
          {
            foreignKeyName: "turmas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "vw_search_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_migracao_cursos_lookup: {
        Row: {
          codigo: string | null
          course_code: string | null
          escola_id: string | null
          id: string | null
          status_aprovacao: string | null
        }
        Relationships: []
      }
      vw_migracao_turmas_lookup: {
        Row: {
          ano_letivo: number | null
          escola_id: string | null
          id: string | null
          nome: string | null
          turma_code: string | null
        }
        Relationships: []
      }
      vw_ocupacao_turmas: {
        Row: {
          capacidade_maxima: number | null
          classe: string | null
          escola_id: string | null
          id: string | null
          nome: string | null
          ocupacao_percentual: number | null
          sala: string | null
          status_ocupacao: string | null
          total_matriculas_ativas: number | null
          turno: string | null
        }
        Relationships: []
      }
      vw_pagamentos_status: {
        Row: {
          escola_id: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_presencas_por_turma: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          created_at: string | null
          data: string | null
          disciplina_id: string | null
          escola_id: string | null
          matricula_id: string | null
          status: string | null
          turma_id: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_professor_pendencias: {
        Row: {
          avaliacao_id: string | null
          disciplina_id: string | null
          disciplina_nome: string | null
          escola_id: string | null
          notas_lancadas: number | null
          pendentes: number | null
          professor_id: string | null
          profile_id: string | null
          tipo: string | null
          total_alunos: number | null
          trimestre: number | null
          turma_disciplina_id: string | null
          turma_id: string | null
          turma_nome: string | null
        }
        Relationships: []
      }
      vw_radar_inadimplencia: {
        Row: {
          aluno_id: string | null
          data_vencimento: string | null
          dias_em_atraso: number | null
          escola_id: string | null
          mensalidade_id: string | null
          nome_aluno: string | null
          nome_turma: string | null
          responsavel: string | null
          status_mensalidade: string | null
          status_risco: string | null
          telefone: string | null
          valor_em_atraso: number | null
          valor_pago_total: number | null
          valor_previsto: number | null
        }
        Relationships: []
      }
      vw_search_alunos: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: never
          search_text?: never
          type?: never
          updated_at?: never
        }
        Update: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: never
          search_text?: never
          type?: never
          updated_at?: never
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
        ]
      }
      vw_search_classes: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: string | null
          search_text?: never
          type?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: string | null
          search_text?: never
          type?: never
          updated_at?: string | null
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
      vw_search_cursos: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: string | null
          search_text?: never
          type?: never
          updated_at?: never
        }
        Update: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: string | null
          search_text?: never
          type?: never
          updated_at?: never
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
        ]
      }
      vw_search_documentos: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_search_matriculas: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
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
      vw_search_mensalidades: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_search_pagamentos: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_search_professores: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
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
        ]
      }
      vw_search_recibos: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_search_turmas: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: string | null
          search_text?: never
          type?: never
          updated_at?: never
        }
        Update: {
          created_at?: string | null
          escola_id?: string | null
          highlight?: never
          id?: string | null
          label?: string | null
          search_text?: never
          type?: never
          updated_at?: never
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
      vw_search_usuarios: {
        Row: {
          created_at: string | null
          escola_id: string | null
          highlight: string | null
          id: string | null
          label: string | null
          search_text: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escola_users_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_users_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_secretaria_alunos_resumo: {
        Row: {
          aluno_id: string | null
          escola_id: string | null
          total_em_atraso: number | null
          turma_nome: string | null
        }
        Relationships: []
      }
      vw_secretaria_dashboard_counts: {
        Row: {
          alunos_ativos: number | null
          escola_id: string | null
          matriculas_total: number | null
          turmas_total: number | null
        }
        Relationships: []
      }
      vw_secretaria_dashboard_kpis: {
        Row: {
          alunos_sem_turma: number | null
          avisos_recentes: Json | null
          escola_id: string | null
          inadimplentes_total: number | null
          matriculas_ativas: number | null
          novas_matriculas: Json | null
          pendencias_importacao: number | null
          resumo_status: Json | null
          risco_total: number | null
          total_alunos: number | null
          total_turmas: number | null
          turmas_destaque: Json | null
          turmas_sem_professor: number | null
        }
        Relationships: []
      }
      vw_secretaria_matriculas_status: {
        Row: {
          escola_id: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_secretaria_matriculas_turma_status: {
        Row: {
          escola_id: string | null
          status: string | null
          total: number | null
          turma_id: string | null
        }
        Relationships: []
      }
      vw_staging_alunos_summary: {
        Row: {
          ano_letivo: number | null
          escola_id: string | null
          import_id: string | null
          total_alunos: number | null
          turma_codigo: string | null
        }
        Relationships: []
      }
      vw_super_admin_audit_metrics: {
        Row: {
          accessos_24h: number | null
          error_count_24h: number | null
          escola_id: string | null
          last_error: string | null
          ultimo_acesso: string | null
        }
        Relationships: []
      }
      vw_super_admin_escola_metrics: {
        Row: {
          alunos_ativos: number | null
          alunos_inativos: number | null
          escola_id: string | null
          matriculas_ativas: number | null
          professores: number | null
          turmas_ativas: number | null
          turmas_total: number | null
        }
        Relationships: []
      }
      vw_top_cursos_media: {
        Row: {
          curso_id: string | null
          curso_nome: string | null
          escola_id: string | null
          media: number | null
        }
        Relationships: []
      }
      vw_top_turmas_hoje: {
        Row: {
          dia: string | null
          escola_id: string | null
          percent: number | null
          presentes: number | null
          total: number | null
          turma_id: string | null
          turma_nome: string | null
        }
        Relationships: []
      }
      vw_total_em_aberto_por_mes: {
        Row: {
          ano: number | null
          escola_id: string | null
          mes: number | null
          total_aberto: number | null
        }
        Relationships: []
      }
      vw_turmas_para_matricula: {
        Row: {
          ano_letivo: number | null
          capacidade_maxima: number | null
          classe_id: string | null
          classe_nome: string | null
          curso_global_hash: string | null
          curso_id: string | null
          curso_is_custom: boolean | null
          curso_nome: string | null
          curso_tipo: string | null
          escola_id: string | null
          id: string | null
          ocupacao_atual: number | null
          sala: string | null
          session_id: string | null
          status_validacao: string | null
          turma_codigo: string | null
          turma_nome: string | null
          turno: string | null
          ultima_matricula: string | null
        }
        Relationships: []
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
      admin_get_escola_health_metrics: { Args: never; Returns: Json[] }
      admin_get_system_health: { Args: never; Returns: Json }
      admin_list_profiles: {
        Args: { p_limit?: number; p_roles: string[] }
        Returns: {
          current_escola_id: string
          email: string
          escola_id: string
          nome: string
          numero_login: string
          role: string
          telefone: string
          user_id: string
        }[]
      }
      admin_profiles_by_ids: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          nome: string
          user_id: string
        }[]
      }
      admin_recalc_all_aggregates: { Args: never; Returns: Json }
      admissao_approve: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_observacao?: string
        }
        Returns: string
      }
      admissao_archive: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_motivo?: string
        }
        Returns: string
      }
      admissao_convert: {
        Args: {
          p_amount?: number
          p_candidatura_id: string
          p_comprovativo_url?: string
          p_idempotency_key?: string
          p_metodo_pagamento: string
          p_turma_id: string
        }
        Returns: Json
      }
      admissao_convert_to_matricula: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_metadata?: Json
        }
        Returns: string
      }
      admissao_reject: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_metadata?: Json
          p_motivo: string
        }
        Returns: string
      }
      admissao_submit: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_source?: string
        }
        Returns: string
      }
      admissao_unsubmit: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_motivo?: string
        }
        Returns: string
      }
      admissao_upsert_draft: {
        Args: {
          p_candidatura_id?: string
          p_dados_candidato?: Json
          p_escola_id: string
          p_source?: string
        }
        Returns: string
      }
      aprovar_fecho_caixa: { Args: { p_fecho_caixa_id: string }; Returns: Json }
      aprovar_turmas:
        | {
            Args: { p_escola_id: string; p_turma_ids: string[] }
            Returns: undefined
          }
        | {
            Args: { p_escola_id: string; p_turma_ids: string[] }
            Returns: undefined
          }
      assert_course_class_range: {
        Args: { p_class_num: number; p_curriculum_key: string }
        Returns: undefined
      }
      audit_redact_jsonb: {
        Args: { p_entity: string; p_payload: Json }
        Returns: Json
      }
      audit_request_context: { Args: never; Returns: Json }
      balcao_cancelar_pedido: {
        Args: { p_pedido_id: string; p_reason?: string }
        Returns: Json
      }
      balcao_confirmar_pagamento_intent: {
        Args: {
          p_evidence_url?: string
          p_intent_id: string
          p_meta?: Json
          p_method: string
          p_reference?: string
          p_terminal_id?: string
        }
        Returns: Json
      }
      balcao_criar_pedido_e_decidir: {
        Args: {
          p_aluno_id: string
          p_contexto?: Json
          p_servico_codigo: string
        }
        Returns: Json
      }
      can_access: { Args: { eid: string }; Returns: boolean }
      can_manage_school: { Args: { p_escola_id: string }; Returns: boolean }
      can_professor_school: { Args: { p_escola_id: string }; Returns: boolean }
      canonicalize_matricula_status_text: {
        Args: { input: string }
        Returns: string
      }
      check_super_admin_role: { Args: never; Returns: boolean }
      claim_outbox_events: {
        Args: { p_limit?: number; p_topic?: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          escola_id: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          tenant_scope: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "outbox_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_pautas_zip: { Args: never; Returns: undefined }
      conciliar_transacoes_auto_match: {
        Args: { p_escola_id: string; p_import_id?: string }
        Returns: Json
      }
      config_commit:
        | {
            Args: {
              p_ano_letivo: number
              p_changes: Json
              p_escola_id: string
              p_idempotency_key: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_ano_letivo_id: string
              p_changes: Json
              p_escola_id: string
              p_idempotency_key: string
              p_user_id: string
            }
            Returns: Json
          }
      confirmar_conciliacao_transacao: {
        Args: {
          p_aluno_id: string
          p_escola_id: string
          p_mensalidade_id?: string
          p_transacao_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      confirmar_matricula: { Args: { p_matricula_id: string }; Returns: number }
      confirmar_matricula_core:
        | {
            Args: {
              p_aluno_id: string
              p_ano_letivo: number
              p_matricula_id?: string
              p_turma_id?: string
            }
            Returns: number
          }
        | { Args: { p_candidatura_id: string }; Returns: string }
      create_audit_event: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_details?: Json
          p_entity: string
          p_entity_id: string
          p_escola_id: string
          p_portal?: string
        }
        Returns: undefined
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
      create_month_partition: {
        Args: { month_start: string; tbl: string }
        Returns: undefined
      }
      create_month_partition_ts: {
        Args: { month_start: string; tbl: string }
        Returns: undefined
      }
      create_or_confirm_matricula: {
        Args: {
          p_aluno_id: string
          p_ano_letivo: number
          p_matricula_id?: string
          p_turma_id: string
        }
        Returns: number
      }
      create_or_get_turma_by_code: {
        Args: {
          p_ano_letivo: number
          p_escola_id: string
          p_turma_code: string
        }
        Returns: {
          ano_letivo: number | null
          ano_letivo_id: string | null
          capacidade_maxima: number | null
          classe_id: string | null
          classe_num: number | null
          coordenador_pedagogico_id: string | null
          created_at: string | null
          curso_id: string | null
          diretor_turma_id: string | null
          escola_id: string
          id: string
          import_id: string | null
          letra: string | null
          nome: string
          sala: string | null
          session_id: string | null
          status_fecho: string
          status_validacao: string | null
          turma_code: string | null
          turma_codigo: string | null
          turno: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "turmas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_escola_id: { Args: never; Returns: string }
      current_tenant_escola_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      curriculo_create_avaliacoes_for_turmas: {
        Args: {
          p_ano_letivo_id: string
          p_classe_id?: string
          p_curso_id: string
          p_escola_id: string
        }
        Returns: number
      }
      curriculo_publish:
        | {
            Args: {
              p_ano_letivo_id: string
              p_curso_id: string
              p_escola_id: string
              p_rebuild_turmas?: boolean
              p_version: number
            }
            Returns: {
              message: string
              ok: boolean
              pendencias: Json
              pendencias_count: number
              previous_published_curriculo_id: string
              published_curriculo_id: string
            }[]
          }
        | {
            Args: {
              p_ano_letivo_id: string
              p_classe_id?: string
              p_curso_id: string
              p_escola_id: string
              p_rebuild_turmas?: boolean
              p_version: number
            }
            Returns: {
              message: string
              ok: boolean
              pendencias: Json
              pendencias_count: number
              previous_published_curriculo_id: string
              published_curriculo_id: string
            }[]
          }
      curriculo_publish_legacy: {
        Args: {
          p_ano_letivo_id: string
          p_curso_id: string
          p_escola_id: string
          p_rebuild_turmas?: boolean
          p_version: number
        }
        Returns: {
          message: string
          ok: boolean
          pendencias: Json
          pendencias_count: number
          previous_published_curriculo_id: string
          published_curriculo_id: string
        }[]
      }
      curriculo_publish_single: {
        Args: {
          p_ano_letivo_id: string
          p_classe_id: string
          p_curso_id: string
          p_escola_id: string
          p_rebuild_turmas: boolean
          p_version: number
        }
        Returns: {
          message: string
          ok: boolean
          pendencias: Json
          pendencias_count: number
          previous_published_curriculo_id: string
          published_curriculo_id: string
        }[]
      }
      curriculo_rebuild_turma_disciplinas:
        | {
            Args: {
              p_ano_letivo_id: string
              p_curso_id: string
              p_escola_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_ano_letivo_id: string
              p_classe_id?: string
              p_curso_id: string
              p_escola_id: string
            }
            Returns: undefined
          }
      curriculum_recalc_status: {
        Args: { p_curso_matriz_id?: string; p_escola_id: string }
        Returns: undefined
      }
      dashboard: { Args: never; Returns: Json }
      declarar_fecho_caixa: {
        Args: {
          p_escola_id: string
          p_valor_declarado_especie: number
          p_valor_declarado_tpa: number
          p_valor_declarado_transferencia: number
        }
        Returns: Json
      }
      emitir_documento_final: {
        Args: {
          p_aluno_id: string
          p_ano_letivo: number
          p_escola_id: string
          p_tipo_documento: string
        }
        Returns: Json
      }
      emitir_recibo: { Args: { p_mensalidade_id: string }; Returns: Json }
      enqueue_outbox_event: {
        Args: {
          p_escola_id: string
          p_idempotency_key?: string
          p_payload: Json
          p_request_id?: string
          p_topic: string
        }
        Returns: string
      }
      enqueue_outbox_event_professor: {
        Args: {
          p_escola_id: string
          p_event_type: string
          p_idempotency_key: string
          p_payload: Json
        }
        Returns: string
      }
      escola_has_feature: {
        Args: { p_escola_id: string; p_feature: string }
        Returns: boolean
      }
      estornar_mensalidade: {
        Args: { p_mensalidade_id: string; p_motivo?: string }
        Returns: Json
      }
      fechar_periodo_academico: {
        Args: {
          p_escola_id: string
          p_periodo_letivo_id: string
          p_turma_id: string
        }
        Returns: undefined
      }
      fill_frequencias_periodo_letivo: { Args: never; Returns: undefined }
      finalizar_matricula_anual: {
        Args: {
          p_escola_id: string
          p_matricula_id: string
          p_motivo?: string
          p_novo_status: string
        }
        Returns: undefined
      }
      finance_confirm_payment: {
        Args: { p_dedupe_key_override?: string; p_intent_id: string }
        Returns: {
          aluno_id: string | null
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          dedupe_key: string
          escola_id: string
          external_ref: string | null
          id: string
          mensalidade_id: string | null
          method: string
          proof_url: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "finance_payment_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      financeiro_fecho_aprovar: {
        Args: {
          p_aprovacao: string
          p_aprovacao_meta?: Json
          p_escola_id: string
          p_fecho_id: string
          p_justificativa?: string
        }
        Returns: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          data_fecho: string
          day_key: string
          declared_at: string | null
          declared_by: string | null
          declared_cash: number
          declared_mcx: number
          declared_tpa: number
          declared_transfer: number
          diferenca_especie: number | null
          diferenca_tpa: number | null
          diferenca_transferencia: number | null
          escola_id: string
          id: string
          observacao_aprovador: string | null
          operador_id: string
          status: string
          system_calculated_at: string | null
          system_cash: number
          system_mcx: number
          system_tpa: number
          system_transfer: number
          updated_at: string
          valor_declarado_especie: number
          valor_declarado_tpa: number
          valor_declarado_transferencia: number
          valor_sistema_especie: number | null
          valor_sistema_tpa: number | null
          valor_sistema_transferencia: number | null
        }
        SetofOptions: {
          from: "*"
          to: "fecho_caixa"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      financeiro_fecho_declarar_e_snapshot: {
        Args: {
          p_cash: number
          p_day_key: string
          p_escola_id: string
          p_mcx: number
          p_tpa: number
          p_transfer: number
        }
        Returns: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          data_fecho: string
          day_key: string
          declared_at: string | null
          declared_by: string | null
          declared_cash: number
          declared_mcx: number
          declared_tpa: number
          declared_transfer: number
          diferenca_especie: number | null
          diferenca_tpa: number | null
          diferenca_transferencia: number | null
          escola_id: string
          id: string
          observacao_aprovador: string | null
          operador_id: string
          status: string
          system_calculated_at: string | null
          system_cash: number
          system_mcx: number
          system_tpa: number
          system_transfer: number
          updated_at: string
          valor_declarado_especie: number
          valor_declarado_tpa: number
          valor_declarado_transferencia: number
          valor_sistema_especie: number | null
          valor_sistema_tpa: number | null
          valor_sistema_transferencia: number | null
        }
        SetofOptions: {
          from: "*"
          to: "fecho_caixa"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      financeiro_registrar_pagamento_secretaria: {
        Args: {
          p_aluno_id: string
          p_escola_id: string
          p_evidence_url?: string
          p_gateway_ref?: string
          p_mensalidade_id: string
          p_meta?: Json
          p_metodo: Database["public"]["Enums"]["pagamento_metodo"]
          p_reference?: string
          p_valor: number
        }
        Returns: {
          aluno_id: string | null
          conciliado: boolean | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          day_key: string
          escola_id: string
          evidence_url: string | null
          gateway_ref: string | null
          id: string
          mensalidade_id: string | null
          meta: Json
          metodo: string
          metodo_pagamento: string | null
          reference: string | null
          referencia: string | null
          settled_at: string | null
          settled_by: string | null
          status: string
          telemovel_origem: string | null
          transacao_id_externo: string | null
          updated_at: string | null
          valor_pago: number
        }
        SetofOptions: {
          from: "*"
          to: "pagamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      financeiro_settle_pagamento: {
        Args: {
          p_escola_id: string
          p_pagamento_id: string
          p_settle_meta?: Json
        }
        Returns: {
          aluno_id: string | null
          conciliado: boolean | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          day_key: string
          escola_id: string
          evidence_url: string | null
          gateway_ref: string | null
          id: string
          mensalidade_id: string | null
          meta: Json
          metodo: string
          metodo_pagamento: string | null
          reference: string | null
          referencia: string | null
          settled_at: string | null
          settled_by: string | null
          status: string
          telemovel_origem: string | null
          transacao_id_externo: string | null
          updated_at: string | null
          valor_pago: number
        }
        SetofOptions: {
          from: "*"
          to: "pagamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      frequencia_resumo_periodo: {
        Args: { p_periodo_letivo_id: string; p_turma_id: string }
        Returns: {
          abaixo_minimo: boolean
          aluno_id: string
          atrasos: number
          aulas_previstas: number
          escola_id: string
          faltas: number
          frequencia_min_percent: number
          matricula_id: string
          percentual_presenca: number
          periodo_letivo_id: string
          presencas: number
          turma_id: string
        }[]
      }
      generate_activation_code: { Args: never; Returns: string }
      generate_unique_numero_login: {
        Args: {
          p_escola_id: string
          p_prefix: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_start: number
        }
        Returns: string
      }
      gerar_historico_anual: {
        Args: { p_matricula_id: string }
        Returns: string
      }
      gerar_mensalidades_lote:
        | {
            Args: {
              p_ano_letivo: number
              p_dia_vencimento_default?: number
              p_escola_id: string
              p_mes_referencia: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_ano_letivo: number
              p_dia_vencimento_default?: number
              p_escola_id: string
              p_mes_referencia: number
              p_turma_id?: string
            }
            Returns: Json
          }
      gerar_turmas_from_curriculo:
        | {
            Args: {
              p_ano_letivo: number
              p_curso_id: string
              p_escola_id: string
              p_generation_params: Json
            }
            Returns: {
              disciplinas_criadas: number
              turma_id: string
              turma_nome: string
            }[]
          }
        | {
            Args: {
              p_ano_letivo: number
              p_curso_id: string
              p_escola_id: string
              p_generation_params: Json
              p_idempotency_key: string
            }
            Returns: Json
          }
      get_aluno_dossier: {
        Args: { p_aluno_id: string; p_escola_id: string }
        Returns: Json
      }
      get_classes_sem_preco: {
        Args: { p_ano_letivo: number; p_escola_id: string }
        Returns: {
          classe_nome: string
          curso_nome: string
          missing_type: string
        }[]
      }
      get_config_impact: {
        Args: { p_ano_letivo: number; p_changes?: Json; p_escola_id: string }
        Returns: Json
      }
      get_import_summary: { Args: { p_import_id: string }; Returns: Json }
      get_metricas_acesso_alunos: {
        Args: { p_escola_id: string }
        Returns: {
          acesso_liberado: number
          enviados_whatsapp: number
          sem_acesso: number
          total_alunos: number
        }[]
      }
      get_my_escola_id: { Args: never; Returns: string }
      get_my_escola_ids: { Args: never; Returns: string[] }
      get_outbox_status_summary: {
        Args: never
        Returns: {
          newest: string
          oldest: string
          status: string
          total: number
        }[]
      }
      get_pending_turmas_count: {
        Args: { p_escola_id: string }
        Returns: number
      }
      get_profile_dependencies: {
        Args: { p_user_id: string }
        Returns: {
          cnt: number
          table_name: string
        }[]
      }
      get_propinas_por_turma: {
        Args: { p_ano_letivo: number }
        Returns: {
          ano_letivo: number
          classe_label: string
          escola_id: string
          inadimplencia_pct: number
          qtd_em_atraso: number
          qtd_mensalidades: number
          total_em_atraso: number
          total_pago: number
          total_previsto: number
          turma_id: string
          turma_nome: string
          turno: string
        }[]
      }
      get_recent_cron_runs: {
        Args: { p_limit?: number }
        Returns: {
          end_time: string
          jobid: number
          return_message: string
          start_time: string
          status: string
        }[]
      }
      get_setup_state: {
        Args: { p_ano_letivo: number; p_escola_id: string }
        Returns: Json
      }
      get_staging_alunos_summary: {
        Args: { p_escola_id: string; p_import_id: string }
        Returns: {
          ano_letivo: number
          total_alunos: number
          turma_codigo: string
        }[]
      }
      get_teacher_assignments_by_profiles: {
        Args: { p_escola_id: string; p_profile_ids: string[] }
        Returns: {
          carga_horaria_semanal: number
          disciplina_nome: string
          profile_id: string
          turma_id: string
          turma_nome: string
        }[]
      }
      get_teacher_compliance_status: {
        Args: { p_teacher_ids: string[]; p_trimestre_id: string }
        Returns: {
          status: string
          teacher_id: string
        }[]
      }
      get_turma_disciplinas_pedagogico: {
        Args: { p_escola_id: string; p_turma_id: string }
        Returns: {
          carga_horaria_semanal: number
          disciplina_id: string
          disciplina_nome: string
          id: string
          periodos_ativos: number[]
          professor_email: string
          professor_nome: string
          turma_id: string
        }[]
      }
      get_user_escola_id:
        | { Args: never; Returns: string }
        | { Args: { p_user_id: string }; Returns: string }
      get_user_export_json: { Args: { p_user_id: string }; Returns: Json }
      get_user_tenant: { Args: never; Returns: string }
      hard_delete_aluno: {
        Args: { p_aluno_id: string; p_reason?: string }
        Returns: undefined
      }
      hard_delete_curso: {
        Args: { p_curso_id: string; p_escola_id: string }
        Returns: undefined
      }
      has_access_to_escola: { Args: { _escola_id: string }; Returns: boolean }
      has_access_to_escola_fast: {
        Args: { p_escola_id: string }
        Returns: boolean
      }
      horario_auto_configurar_cargas: {
        Args: {
          p_escola_id: string
          p_overwrite?: boolean
          p_strategy?: string
          p_turma_id: string
        }
        Returns: {
          disciplina_id: string
          disciplina_nome: string
          new_carga: number
          old_carga: number
          source: string
          turma_disciplina_id: string
        }[]
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      importar_alunos: {
        Args: { p_ano_letivo: number; p_escola_id: string; p_import_id: string }
        Returns: Json
      }
      importar_alunos_v2: {
        Args: {
          p_alunos: Json
          p_ano_letivo: number
          p_escola_id: string
          p_import_id: string
        }
        Returns: Json
      }
      importar_alunos_v4: {
        Args: {
          p_data_inicio_financeiro?: string
          p_escola_id: string
          p_import_id: string
          p_modo?: string
        }
        Returns: {
          errors: number
          imported: number
          matriculas_pendentes: number
          ok: boolean
          turmas_created: number
        }[]
      }
      increment_pautas_lote_job: {
        Args: { p_failed: boolean; p_job_id: string; p_success: boolean }
        Returns: undefined
      }
      initcap_angola: { Args: { "": string }; Returns: string }
      is_admin_escola: { Args: never; Returns: boolean }
      is_escola_admin: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_diretor: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_member: { Args: { p_escola_id: string }; Returns: boolean }
      is_global_admin: { Args: never; Returns: boolean }
      is_membro_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_staff_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_super_or_global_admin: { Args: never; Returns: boolean }
      lancar_notas_batch: {
        Args: {
          p_disciplina_id: string
          p_escola_id: string
          p_notas: Json
          p_tipo_avaliacao: string
          p_trimestre: number
          p_turma_disciplina_id: string
          p_turma_id: string
        }
        Returns: Json
      }
      liberar_acesso_alunos_v2: {
        Args: { p_aluno_ids: string[]; p_canal?: string; p_escola_id: string }
        Returns: {
          aluno_id: string
          codigo_ativacao: string
          enfileirado: boolean
          request_id: string
        }[]
      }
      lock_curriculo_install: {
        Args: {
          p_ano_letivo_id: string
          p_escola_id: string
          p_preset_key: string
        }
        Returns: undefined
      }
      mark_outbox_event_failed: {
        Args: { p_error: string; p_event_id: string }
        Returns: undefined
      }
      mark_outbox_event_processed: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      matricula_counter_floor: {
        Args: { p_escola_id: string }
        Returns: number
      }
      matricular_em_massa: {
        Args: {
          p_ano_letivo: number
          p_classe_numero: number
          p_curso_codigo: string
          p_escola_id: string
          p_import_id: string
          p_turma_id: string
          p_turma_letra: string
          p_turno_codigo: string
        }
        Returns: {
          error_count: number
          errors: Json
          success_count: number
        }[]
      }
      matricular_em_massa_por_turma: {
        Args: { p_escola_id: string; p_import_id: string; p_turma_id: string }
        Returns: {
          error_count: number
          errors: Json
          success_count: number
        }[]
      }
      matricular_lista_alunos: {
        Args: {
          p_aluno_ids: string[]
          p_ano_letivo: number
          p_escola_id: string
          p_turma_id: string
        }
        Returns: Json
      }
      move_profile_to_archive: {
        Args: { p_performed_by: string; p_user_id: string }
        Returns: undefined
      }
      next_documento_numero: { Args: { p_escola_id: string }; Returns: number }
      next_matricula_number: { Args: { p_escola_id: string }; Returns: number }
      next_numero_counter: {
        Args: { p_escola_id: string; p_start?: number; p_tipo: string }
        Returns: number
      }
      next_numero_processo: {
        Args: { p_escola_id: string; p_year: number }
        Returns: string
      }
      normalize_date: { Args: { input_text: string }; Returns: string }
      normalize_text: { Args: { input_text: string }; Returns: string }
      normalize_turma_code: { Args: { p_code: string }; Returns: string }
      onboard_academic_structure_from_matrix: {
        Args: { p_escola_id: string; p_matrix: Json; p_session_id: string }
        Returns: Json
      }
      outbox_claim: {
        Args: { batch_size?: number; worker_id?: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          escola_id: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          tenant_scope: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "outbox_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      outbox_report_result: {
        Args: { p_error?: string; p_id: string; p_ok: boolean }
        Returns: undefined
      }
      outbox_requeue_stuck: { Args: never; Returns: undefined }
      partitions_info: { Args: never; Returns: Json }
      preview_apply_changes:
        | {
            Args: { p_ano_letivo: number; p_changes: Json; p_escola_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_ano_letivo_id: string
              p_changes: Json
              p_escola_id: string
            }
            Returns: Json
          }
      preview_matricula_number: {
        Args: { p_escola_id: string }
        Returns: number
      }
      process_outbox_batch: { Args: { p_limit?: number }; Returns: number }
      process_outbox_batch_p0_v2: {
        Args: { p_batch_size?: number; p_max_retries?: number }
        Returns: {
          failed_count: number
          processed_count: number
        }[]
      }
      professor_list_presencas_turma: {
        Args: { p_data_fim: string; p_data_inicio: string; p_turma_id: string }
        Returns: {
          aluno_id: string
          aluno_nome: string
          data: string
          disciplina_id: string
          escola_id: string
          matricula_id: string
          status: string
          turma_id: string
        }[]
      }
      public_get_documento_by_token: {
        Args: { p_hash: string; p_public_id: string }
        Returns: {
          emitted_at: string
          escola_id: string
          id: string
          payload: Json
          tipo: string
        }[]
      }
      realizar_pagamento_balcao: {
        Args: {
          p_aluno_id: string
          p_carrinho_itens: Json
          p_escola_id: string
          p_metodo_pagamento: string
          p_valor_recebido: number
        }
        Returns: Json
      }
      recalc_escola_financeiro_totals: {
        Args: { p_data_referencia: string; p_escola_id: string }
        Returns: undefined
      }
      recalc_secretaria_turma_counts: {
        Args: {
          p_data_referencia: string
          p_escola_id: string
          p_turma_id: string
        }
        Returns: undefined
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_frequencia_status_periodo_deprecated: {
        Args: { p_periodo_letivo_id: string; p_turma_id: string }
        Returns: undefined
      }
      refresh_mv_admin_dashboard_counts: { Args: never; Returns: undefined }
      refresh_mv_admin_matriculas_por_mes: { Args: never; Returns: undefined }
      refresh_mv_admin_pending_turmas_count: { Args: never; Returns: undefined }
      refresh_mv_admissoes_counts_por_status: {
        Args: never
        Returns: undefined
      }
      refresh_mv_boletim_por_matricula: { Args: never; Returns: undefined }
      refresh_mv_cursos_reais: { Args: never; Returns: undefined }
      refresh_mv_escola_cursos_stats: { Args: never; Returns: undefined }
      refresh_mv_escola_estrutura_counts: { Args: never; Returns: undefined }
      refresh_mv_escola_info: { Args: never; Returns: undefined }
      refresh_mv_escola_setup_status: { Args: never; Returns: undefined }
      refresh_mv_financeiro_cobrancas_diario: {
        Args: never
        Returns: undefined
      }
      refresh_mv_financeiro_dashboard: { Args: never; Returns: undefined }
      refresh_mv_financeiro_escola_dia: { Args: never; Returns: undefined }
      refresh_mv_financeiro_inadimplencia_top: {
        Args: never
        Returns: undefined
      }
      refresh_mv_financeiro_kpis_geral: { Args: never; Returns: undefined }
      refresh_mv_financeiro_kpis_mes: { Args: never; Returns: undefined }
      refresh_mv_financeiro_missing_pricing_count: {
        Args: never
        Returns: undefined
      }
      refresh_mv_financeiro_propinas_mensal_escola: {
        Args: never
        Returns: undefined
      }
      refresh_mv_financeiro_propinas_por_turma: {
        Args: never
        Returns: undefined
      }
      refresh_mv_financeiro_radar_resumo: { Args: never; Returns: undefined }
      refresh_mv_financeiro_sidebar_badges: { Args: never; Returns: undefined }
      refresh_mv_freq_por_turma_dia: { Args: never; Returns: undefined }
      refresh_mv_migracao_cursos_lookup: { Args: never; Returns: undefined }
      refresh_mv_migracao_turmas_lookup: { Args: never; Returns: undefined }
      refresh_mv_ocupacao_turmas: { Args: never; Returns: undefined }
      refresh_mv_pagamentos_status: { Args: never; Returns: undefined }
      refresh_mv_professor_pendencias: { Args: never; Returns: undefined }
      refresh_mv_radar_inadimplencia: { Args: never; Returns: undefined }
      refresh_mv_secretaria_alunos_resumo: { Args: never; Returns: undefined }
      refresh_mv_secretaria_dashboard_counts: {
        Args: never
        Returns: undefined
      }
      refresh_mv_secretaria_dashboard_kpis: { Args: never; Returns: undefined }
      refresh_mv_secretaria_matriculas_status: {
        Args: never
        Returns: undefined
      }
      refresh_mv_secretaria_matriculas_turma_status: {
        Args: never
        Returns: undefined
      }
      refresh_mv_staging_alunos_summary: { Args: never; Returns: undefined }
      refresh_mv_super_admin_audit_metrics: { Args: never; Returns: undefined }
      refresh_mv_super_admin_escola_metrics: { Args: never; Returns: undefined }
      refresh_mv_top_cursos_media: { Args: never; Returns: undefined }
      refresh_mv_top_turmas_hoje: { Args: never; Returns: undefined }
      refresh_mv_total_em_aberto_por_mes: { Args: never; Returns: undefined }
      refresh_mv_turmas_para_matricula: { Args: never; Returns: undefined }
      registrar_pagamento: {
        Args: {
          p_mensalidade_id: string
          p_metodo_pagamento: string
          p_observacao?: string
        }
        Returns: Json
      }
      registrar_venda_avulsa: {
        Args: {
          p_aluno_id: string
          p_created_by?: string
          p_desconto?: number
          p_descricao?: string
          p_escola_id: string
          p_item_id: string
          p_metodo_pagamento?: Database["public"]["Enums"]["metodo_pagamento_enum"]
          p_quantidade: number
          p_status?: Database["public"]["Enums"]["financeiro_status"]
          p_valor_unit: number
        }
        Returns: {
          estoque_atual: number
          lancamento_id: string
        }[]
      }
      rematricula_em_massa: {
        Args: {
          p_destino_turma_id: string
          p_escola_id: string
          p_origem_turma_id: string
        }
        Returns: {
          errors: Json
          inserted: number
          skipped: number
        }[]
      }
      request_liberar_acesso: {
        Args: { p_aluno_ids: string[]; p_canal?: string; p_escola_id: string }
        Returns: {
          aluno_id: string
          codigo_ativacao: string
          enfileirado: boolean
          request_id: string
        }[]
      }
      resync_matricula_counter: {
        Args: { p_escola_id: string }
        Returns: number
      }
      retry_outbox_event: { Args: { p_event_id: string }; Returns: undefined }
      search_alunos_global: {
        Args: { p_escola_id: string; p_limit?: number; p_query: string }
        Returns: {
          aluno_bi: string
          aluno_status: string
          id: string
          nome: string
          processo: string
          status: string
          turma: string
          turma_id: string
        }[]
      }
      search_alunos_global_min:
        | {
            Args: { p_escola_id: string; p_limit?: number; p_query: string }
            Returns: {
              highlight: string
              id: string
              label: string
              type: string
            }[]
          }
        | {
            Args: {
              p_cursor_created_at?: string
              p_cursor_id?: string
              p_cursor_score?: number
              p_cursor_updated_at?: string
              p_escola_id: string
              p_limit?: number
              p_query: string
            }
            Returns: {
              created_at: string
              highlight: string
              id: string
              label: string
              score: number
              type: string
              updated_at: string
            }[]
          }
      search_global_entities: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_cursor_score?: number
          p_cursor_updated_at?: string
          p_escola_id: string
          p_limit?: number
          p_query: string
          p_types?: string[]
        }
        Returns: {
          created_at: string
          highlight: string
          id: string
          label: string
          score: number
          type: string
          updated_at: string
        }[]
      }
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
      secretaria_list_alunos_kf2: {
        Args: {
          p_ano_letivo?: number
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_escola_id: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_status?: string
        }
        Returns: {
          aluno_id: string
          bi_numero: string
          created_at: string
          email: string
          id: string
          nome: string
          numero_login: string
          numero_processo: string
          origem: string
          responsavel: string
          status: string
          telefone_responsavel: string
        }[]
      }
      setup_active_ano_letivo: {
        Args: { p_ano_data: Json; p_escola_id: string }
        Returns: Json
      }
      soft_delete_aluno: {
        Args: { p_deleted_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      sum_component_pesos: { Args: { p_componentes: Json }; Returns: number }
      tenant_profiles_by_ids: {
        Args: { p_user_ids: string[] }
        Returns: {
          created_at: string
          current_escola_id: string
          email: string
          escola_id: string
          last_login: string
          nome: string
          numero_login: string
          role: string
          telefone: string
          user_id: string
        }[]
      }
      transferir_matricula: {
        Args: {
          p_escola_id: string
          p_matricula_id: string
          p_target_turma_id: string
        }
        Returns: Json
      }
      try_start_pautas_lote_job: {
        Args: { p_escola_id: string; p_job_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_financeiro_from_pagamento: {
        Args: { p_event: Json }
        Returns: undefined
      }
      update_import_configuration: {
        Args: { p_cursos_data: Json; p_import_id: string; p_turmas_data: Json }
        Returns: Json
      }
      update_pedagogico_from_nota: {
        Args: { p_event: Json }
        Returns: undefined
      }
      update_secretaria_from_matricula: {
        Args: { p_event: Json }
        Returns: undefined
      }
      update_secretaria_from_presenca: {
        Args: { p_event: Json }
        Returns: undefined
      }
      upsert_bulk_periodos_letivos: {
        Args: { p_escola_id: string; p_periodos_data: Json }
        Returns: Json
      }
      upsert_frequencias_batch: {
        Args: {
          p_data: string
          p_disciplina_id: string
          p_escola_id: string
          p_presencas: Json
          p_turma_id: string
        }
        Returns: Json
      }
      user_has_role_in_school: {
        Args: { p_escola_id: string; p_roles: string[] }
        Returns: boolean
      }
      verificar_documento_publico: {
        Args: { p_public_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_plan_tier: "essencial" | "profissional" | "premium"
      cobranca_status: "enviada" | "entregue" | "respondida" | "paga" | "falha"
      course_category:
        | "PRIMARIO"
        | "ESG_CICLO1"
        | "ESG_PUNIV"
        | "TECNICO"
        | "TECNICO_SAUDE"
      curriculo_status: "draft" | "published" | "archived"
      discipline_component:
        | "GERAL"
        | "SOCIO_CULTURAL"
        | "CIENTIFICA"
        | "TECNICA"
        | "ESPECIFICA"
      fecho_status: "draft" | "declared" | "approved" | "rejected"
      financeiro_categoria_item:
        | "uniforme"
        | "documento"
        | "material"
        | "transporte"
        | "outros"
        | "servico"
      financeiro_origem:
        | "mensalidade"
        | "matricula"
        | "venda_avulsa"
        | "multa"
        | "taxa_extra"
      financeiro_status:
        | "pendente"
        | "pago"
        | "parcial"
        | "vencido"
        | "cancelado"
      financeiro_tipo_transacao: "debito" | "credito"
      mensalidade_status:
        | "pendente"
        | "pago_parcial"
        | "pago"
        | "isento"
        | "cancelado"
      metodo_pagamento_enum:
        | "numerario"
        | "multicaixa"
        | "transferencia"
        | "deposito"
      outbox_status: "pending" | "processing" | "sent" | "failed" | "dead"
      pagamento_metodo: "cash" | "tpa" | "transfer" | "mcx" | "kwik"
      pagamento_status: "pending" | "settled" | "rejected" | "voided"
      periodo_tipo: "SEMESTRE" | "TRIMESTRE" | "BIMESTRE"
      tipo_documento:
        | "recibo"
        | "declaracao"
        | "certificado"
        | "historico"
        | "declaracao_frequencia"
        | "declaracao_notas"
      user_role:
        | "super_admin"
        | "global_admin"
        | "admin"
        | "professor"
        | "aluno"
        | "secretaria"
        | "financeiro"
        | "encarregado"
    }
    CompositeTypes: {
      curso_update: {
        id: string | null
        nome: string | null
        status_aprovacao: string | null
      }
      sandbox_diff_entry: {
        entidade: string | null
        campo: string | null
        antes: string | null
        depois: string | null
      }
      sandbox_impact: {
        alunos_impactados: number | null
        turmas_afetadas: number | null
        professores_envolvidos: number | null
        disciplinas_afetadas: number | null
      }
      sandbox_validation: {
        regra: string | null
        severidade: string | null
        entidade: string | null
        mensagem: string | null
        bloqueante: boolean | null
      }
      turma_update: {
        id: string | null
        nome: string | null
        curso_id: string | null
        classe_id: string | null
        turno: string | null
        status_validacao: string | null
      }
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
      app_plan_tier: ["essencial", "profissional", "premium"],
      cobranca_status: ["enviada", "entregue", "respondida", "paga", "falha"],
      course_category: [
        "PRIMARIO",
        "ESG_CICLO1",
        "ESG_PUNIV",
        "TECNICO",
        "TECNICO_SAUDE",
      ],
      curriculo_status: ["draft", "published", "archived"],
      discipline_component: [
        "GERAL",
        "SOCIO_CULTURAL",
        "CIENTIFICA",
        "TECNICA",
        "ESPECIFICA",
      ],
      fecho_status: ["draft", "declared", "approved", "rejected"],
      financeiro_categoria_item: [
        "uniforme",
        "documento",
        "material",
        "transporte",
        "outros",
        "servico",
      ],
      financeiro_origem: [
        "mensalidade",
        "matricula",
        "venda_avulsa",
        "multa",
        "taxa_extra",
      ],
      financeiro_status: [
        "pendente",
        "pago",
        "parcial",
        "vencido",
        "cancelado",
      ],
      financeiro_tipo_transacao: ["debito", "credito"],
      mensalidade_status: [
        "pendente",
        "pago_parcial",
        "pago",
        "isento",
        "cancelado",
      ],
      metodo_pagamento_enum: [
        "numerario",
        "multicaixa",
        "transferencia",
        "deposito",
      ],
      outbox_status: ["pending", "processing", "sent", "failed", "dead"],
      pagamento_metodo: ["cash", "tpa", "transfer", "mcx", "kwik"],
      pagamento_status: ["pending", "settled", "rejected", "voided"],
      periodo_tipo: ["SEMESTRE", "TRIMESTRE", "BIMESTRE"],
      tipo_documento: [
        "recibo",
        "declaracao",
        "certificado",
        "historico",
        "declaracao_frequencia",
        "declaracao_notas",
      ],
      user_role: [
        "super_admin",
        "global_admin",
        "admin",
        "professor",
        "aluno",
        "secretaria",
        "financeiro",
        "encarregado",
      ],
    },
  },
} as const
