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
          bi_numero: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          email: string | null
          escola_id: string | null
          id: string
          import_id: string | null
          naturalidade: string | null
          nome: string
          profile_id: string | null
          responsavel: string | null
          responsavel_contato: string | null
          responsavel_nome: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          telefone_responsavel: string | null
          tsv: unknown
          updated_at: string | null
        }
        Insert: {
          bi_numero?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          escola_id?: string | null
          id?: string
          import_id?: string | null
          naturalidade?: string | null
          nome: string
          profile_id?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tsv?: unknown
          updated_at?: string | null
        }
        Update: {
          bi_numero?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          escola_id?: string | null
          id?: string
          import_id?: string | null
          naturalidade?: string | null
          nome?: string
          profile_id?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_nome?: string | null
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
          acao: string | null
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
          tabela: string | null
          user_id: string | null
        }
        Insert: {
          acao?: string | null
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
          tabela?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string | null
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
          tabela?: string | null
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
          {
            foreignKeyName: "aulas_turma_disciplina_id_fkey"
            columns: ["turma_disciplina_id"]
            isOneToOne: false
            referencedRelation: "turma_disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          bimestre: number | null
          created_at: string
          created_by: string | null
          curso_oferta_id: string
          data_prevista: string | null
          escola_id: string
          id: string
          max_valor: number
          nome: string
          peso: number
          sistema_notas_id: string | null
          tipo: string | null
          turma_disciplina_id: string | null
        }
        Insert: {
          bimestre?: number | null
          created_at?: string
          created_by?: string | null
          curso_oferta_id: string
          data_prevista?: string | null
          escola_id: string
          id?: string
          max_valor?: number
          nome: string
          peso: number
          sistema_notas_id?: string | null
          tipo?: string | null
          turma_disciplina_id?: string | null
        }
        Update: {
          bimestre?: number | null
          created_at?: string
          created_by?: string | null
          curso_oferta_id?: string
          data_prevista?: string | null
          escola_id?: string
          id?: string
          max_valor?: number
          nome?: string
          peso?: number
          sistema_notas_id?: string | null
          tipo?: string | null
          turma_disciplina_id?: string | null
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
          {
            foreignKeyName: "avaliacoes_turma_disciplina_id_fkey"
            columns: ["turma_disciplina_id"]
            isOneToOne: false
            referencedRelation: "turma_disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          curso_id: string | null
          descricao: string | null
          escola_id: string
          id: string
          nivel: string | null
          nome: string
          numero: number | null
          ordem: number | null
        }
        Insert: {
          created_at?: string
          curso_id?: string | null
          descricao?: string | null
          escola_id: string
          id?: string
          nivel?: string | null
          nome: string
          numero?: number | null
          ordem?: number | null
        }
        Update: {
          created_at?: string
          curso_id?: string | null
          descricao?: string | null
          escola_id?: string
          id?: string
          nivel?: string | null
          nome?: string
          numero?: number | null
          ordem?: number | null
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
            referencedRelation: "vw_cursos_reais"
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
            referencedRelation: "vw_cursos_reais"
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
          created_at: string | null
          curso_global_id: string | null
          descricao: string | null
          escola_id: string
          id: string
          is_custom: boolean | null
          nivel: string | null
          nome: string
          semestre_id: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          curso_global_id?: string | null
          descricao?: string | null
          escola_id: string
          id?: string
          is_custom?: boolean | null
          nivel?: string | null
          nome: string
          semestre_id?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          curso_global_id?: string | null
          descricao?: string | null
          escola_id?: string
          id?: string
          is_custom?: boolean | null
          nivel?: string | null
          nome?: string
          semestre_id?: string | null
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
            foreignKeyName: "cursos_curso_global_id_fkey"
            columns: ["curso_global_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
            referencedColumns: ["curso_global_hash"]
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
            foreignKeyName: "cursos_oferta_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_cursos_reais"
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
          {
            foreignKeyName: "cursos_oferta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "cursos_oferta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_oferta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          carga_horaria: number | null
          classe_id: string | null
          classe_nome: string
          created_at: string | null
          curso_escola_id: string
          curso_id: string | null
          escola_id: string
          id: string
          nivel_ensino: string | null
          nome: string
          sigla: string | null
          tipo: string | null
        }
        Insert: {
          carga_horaria?: number | null
          classe_id?: string | null
          classe_nome: string
          created_at?: string | null
          curso_escola_id: string
          curso_id?: string | null
          escola_id: string
          id?: string
          nivel_ensino?: string | null
          nome: string
          sigla?: string | null
          tipo?: string | null
        }
        Update: {
          carga_horaria?: number | null
          classe_id?: string | null
          classe_nome?: string
          created_at?: string | null
          curso_escola_id?: string
          curso_id?: string | null
          escola_id?: string
          id?: string
          nivel_ensino?: string | null
          nome?: string
          sigla?: string | null
          tipo?: string | null
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
            foreignKeyName: "disciplinas_curso_escola_id_fkey"
            columns: ["curso_escola_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_curso_escola_id_fkey"
            columns: ["curso_escola_id"]
            isOneToOne: false
            referencedRelation: "vw_cursos_reais"
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
            foreignKeyName: "disciplinas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_cursos_reais"
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
      escola_users: {
        Row: {
          created_at: string | null
          escola_id: string
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          id?: string
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
            referencedRelation: "vw_cursos_reais"
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
      frequencias: {
        Row: {
          aula_id: string | null
          curso_oferta_id: string | null
          data: string
          escola_id: string
          id: string
          matricula_id: string
          observacao: string | null
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
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "historico_anos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_anos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
            foreignKeyName: "historico_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_disciplinas_historico_ano_id_fkey"
            columns: ["historico_ano_id"]
            isOneToOne: false
            referencedRelation: "historico_anos"
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
            foreignKeyName: "lancamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
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
          data_matricula: string | null
          escola_id: string
          id: string
          numero_chamada: number | null
          numero_matricula: string | null
          secao_id: string | null
          session_id: string | null
          status: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          ano_letivo?: number | null
          ativo?: boolean | null
          created_at?: string | null
          data_matricula?: string | null
          escola_id: string
          id?: string
          numero_chamada?: number | null
          numero_matricula?: string | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number | null
          ativo?: boolean | null
          created_at?: string | null
          data_matricula?: string | null
          escola_id?: string
          id?: string
          numero_chamada?: number | null
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
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
          observacoes: string | null
          status: string | null
          turma_id: string | null
          updated_at: string
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
          observacoes?: string | null
          status?: string | null
          turma_id?: string | null
          updated_at?: string
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
          observacoes?: string | null
          status?: string | null
          turma_id?: string | null
          updated_at?: string
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
            foreignKeyName: "mensalidades_matricula_id_fkey"
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
          disciplina_id: string | null
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
          disciplina_id?: string | null
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
          disciplina_id?: string | null
          escola_id?: string
          id?: string
          nota?: number
          periodo_id?: string
          turma_id?: string
        }
        Relationships: [
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
          {
            foreignKeyName: "notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
            foreignKeyName: "notas_avaliacoes_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_avaliacoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
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
          conciliado: boolean | null
          created_at: string
          data_pagamento: string | null
          escola_id: string | null
          id: string
          mensalidade_id: string | null
          metodo: string | null
          metodo_pagamento: string | null
          referencia: string | null
          status: string | null
          telemovel_origem: string | null
          transacao_id_externo: string | null
          valor_pago: number
        }
        Insert: {
          conciliado?: boolean | null
          created_at?: string
          data_pagamento?: string | null
          escola_id?: string | null
          id?: string
          mensalidade_id?: string | null
          metodo?: string | null
          metodo_pagamento?: string | null
          referencia?: string | null
          status?: string | null
          telemovel_origem?: string | null
          transacao_id_externo?: string | null
          valor_pago: number
        }
        Update: {
          conciliado?: boolean | null
          created_at?: string
          data_pagamento?: string | null
          escola_id?: string | null
          id?: string
          mensalidade_id?: string | null
          metodo?: string | null
          metodo_pagamento?: string | null
          referencia?: string | null
          status?: string | null
          telemovel_origem?: string | null
          transacao_id_externo?: string | null
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
            referencedRelation: "vw_radar_inadimplencia"
            referencedColumns: ["mensalidade_id"]
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
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
          {
            foreignKeyName: "rotinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "rotinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
          {
            foreignKeyName: "secoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "secoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
          {
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_notas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_alunos: {
        Row: {
          ano_letivo: number | null
          bi: string | null
          classe_numero: number | null
          created_at: string | null
          curso_codigo: string | null
          data_nascimento: string | null
          email: string | null
          escola_id: string
          id: number
          import_id: string
          nome: string | null
          numero_matricula: string | null
          profile_id: string | null
          raw_data: Json | null
          telefone: string | null
          turma_letra: string | null
          turno_codigo: string | null
        }
        Insert: {
          ano_letivo?: number | null
          bi?: string | null
          classe_numero?: number | null
          created_at?: string | null
          curso_codigo?: string | null
          data_nascimento?: string | null
          email?: string | null
          escola_id: string
          id?: number
          import_id: string
          nome?: string | null
          numero_matricula?: string | null
          profile_id?: string | null
          raw_data?: Json | null
          telefone?: string | null
          turma_letra?: string | null
          turno_codigo?: string | null
        }
        Update: {
          ano_letivo?: number | null
          bi?: string | null
          classe_numero?: number | null
          created_at?: string | null
          curso_codigo?: string | null
          data_nascimento?: string | null
          email?: string | null
          escola_id?: string
          id?: number
          import_id?: string
          nome?: string | null
          numero_matricula?: string | null
          profile_id?: string | null
          raw_data?: Json | null
          telefone?: string | null
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
            referencedRelation: "vw_cursos_reais"
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
      turma_disciplinas: {
        Row: {
          carga_horaria: number | null
          created_at: string
          disciplina_id: string
          escola_id: string
          id: string
          ordem: number | null
          professor_id: string | null
          turma_id: string
        }
        Insert: {
          carga_horaria?: number | null
          created_at?: string
          disciplina_id: string
          escola_id: string
          id?: string
          ordem?: number | null
          professor_id?: string | null
          turma_id: string
        }
        Update: {
          carga_horaria?: number | null
          created_at?: string
          disciplina_id?: string
          escola_id?: string
          id?: string
          ordem?: number | null
          professor_id?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_disciplinas_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ano_letivo: string | null
          capacidade: number | null
          capacidade_maxima: number | null
          classe: string | null
          classe_id: string | null
          coordenador_pedagogico_id: string | null
          created_at: string | null
          curso_id: string | null
          diretor_turma_id: string | null
          escola_id: string
          id: string
          nome: string
          sala: string | null
          session_id: string | null
          turno: string | null
        }
        Insert: {
          ano_letivo?: string | null
          capacidade?: number | null
          capacidade_maxima?: number | null
          classe?: string | null
          classe_id?: string | null
          coordenador_pedagogico_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          diretor_turma_id?: string | null
          escola_id: string
          id?: string
          nome: string
          sala?: string | null
          session_id?: string | null
          turno?: string | null
        }
        Update: {
          ano_letivo?: string | null
          capacidade?: number | null
          capacidade_maxima?: number | null
          classe?: string | null
          classe_id?: string | null
          coordenador_pedagogico_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          diretor_turma_id?: string | null
          escola_id?: string
          id?: string
          nome?: string
          sala?: string | null
          session_id?: string | null
          turno?: string | null
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
            foreignKeyName: "turmas_coordenador_pedagogico_id_fkey"
            columns: ["coordenador_pedagogico_id"]
            isOneToOne: false
            referencedRelation: "escola_usuarios"
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
            referencedRelation: "vw_cursos_reais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_diretor_turma_id_fkey"
            columns: ["diretor_turma_id"]
            isOneToOne: false
            referencedRelation: "escola_usuarios"
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
          {
            foreignKeyName: "turmas_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "school_sessions"
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
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
      pagamentos_status: {
        Row: {
          escola_id: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
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
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_propinas_por_turma"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_ocupacao_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_turmas_para_matricula"
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
      vw_cursos_reais: {
        Row: {
          codigo: string | null
          descricao: string | null
          escola_id: string | null
          id: string | null
          nivel: string | null
          nome: string | null
          semestre_id: string | null
          tipo: string | null
        }
        Insert: {
          codigo?: string | null
          descricao?: string | null
          escola_id?: string | null
          id?: string | null
          nivel?: string | null
          nome?: string | null
          semestre_id?: string | null
          tipo?: string | null
        }
        Update: {
          codigo?: string | null
          descricao?: string | null
          escola_id?: string | null
          id?: string | null
          nivel?: string | null
          nome?: string | null
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
      vw_financeiro_propinas_por_turma: {
        Row: {
          ano_letivo: string | null
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
      vw_medias_por_disciplina: {
        Row: {
          aluno_id: string | null
          bimestre: number | null
          disciplina_id: string | null
          escola_id: string | null
          media_ponderada: number | null
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
            foreignKeyName: "turma_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
        ]
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
      vw_radar_inadimplencia: {
        Row: {
          aluno_id: string | null
          data_vencimento: string | null
          dias_em_atraso: number | null
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
        Relationships: [
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_turmas_para_matricula: {
        Row: {
          ano_letivo: string | null
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
          turma_nome: string | null
          turno: string | null
          ultima_matricula: string | null
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
            foreignKeyName: "turmas_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "school_sessions"
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
      canonicalize_matricula_status_text: {
        Args: { input: string }
        Returns: string
      }
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
      create_or_confirm_matricula: {
        Args: {
          p_aluno_id: string
          p_ano_letivo: number
          p_matricula_id?: string
          p_turma_id: string
        }
        Returns: number
      }
      current_tenant_escola_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
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
        | { Args: never; Returns: string }
        | { Args: { p_user_id: string }; Returns: string }
      get_user_export_json: { Args: { p_user_id: string }; Returns: Json }
      get_user_tenant: { Args: never; Returns: string }
      importar_alunos: {
        Args: { p_escola_id: string; p_import_id: string }
        Returns: {
          errors: number
          imported: number
          skipped: number
        }[]
      }
      is_escola_admin: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_diretor: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_member: { Args: { p_escola_id: string }; Returns: boolean }
      is_membro_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_staff_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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
      move_profile_to_archive: {
        Args: { p_performed_by: string; p_user_id: string }
        Returns: undefined
      }
      next_matricula_number: { Args: { p_escola_id: string }; Returns: number }
      normalize_date: { Args: { input_text: string }; Returns: string }
      normalize_text: { Args: { input_text: string }; Returns: string }
      partitions_info: { Args: never; Returns: Json }
      preview_matricula_number: {
        Args: { p_escola_id: string }
        Returns: string
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
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
      resync_matricula_counter: {
        Args: { p_escola_id: string }
        Returns: number
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
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
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
