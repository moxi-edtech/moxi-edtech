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
      admin_activity_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          escola_id: string
          event_family: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          source_audit_log_id: number | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          escola_id: string
          event_family: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          source_audit_log_id?: number | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          escola_id?: string
          event_family?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          source_audit_log_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_events_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_events_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_events_source_audit_log_id_fkey"
            columns: ["source_audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      aluno_encarregados: {
        Row: {
          aluno_id: string
          created_at: string | null
          encarregado_id: string
          escola_id: string
          id: string
          principal: boolean | null
          relacao: string | null
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          encarregado_id: string
          escola_id: string
          id?: string
          principal?: boolean | null
          relacao?: string | null
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          encarregado_id?: string
          escola_id?: string
          id?: string
          principal?: boolean | null
          relacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_alunos_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_balcao_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "aluno_encarregados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "vw_search_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_encarregados_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "encarregados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_encarregados_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_encarregados_escola_id_fkey"
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
          acesso_bloqueado: boolean
          acesso_liberado: boolean
          bi_numero: string | null
          bloqueado_em: string | null
          bloqueado_por: string | null
          campos_extras: Json | null
          codigo_ativacao: string | null
          created_at: string
          data_ativacao: string | null
          data_nascimento: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          documentos: Json | null
          email: string | null
          encarregado_email: string | null
          encarregado_nome: string | null
          encarregado_relacao: string | null
          encarregado_telefone: string | null
          endereco: string | null
          escola_id: string
          id: string
          import_id: string | null
          mae_nome: string | null
          mesmo_que_encarregado: boolean | null
          motivo_bloqueio: string | null
          naturalidade: string | null
          nif: string | null
          nome: string
          nome_busca: string | null
          nome_completo: string | null
          numero_documento: string | null
          numero_processo: string | null
          numero_processo_legado: string | null
          pai_nome: string | null
          profile_id: string | null
          provincia: string | null
          responsavel: string | null
          responsavel_contato: string | null
          responsavel_financeiro_nif: string | null
          responsavel_financeiro_nome: string | null
          responsavel_nome: string | null
          search_text: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          telefone_responsavel: string | null
          tipo_documento: string | null
          tsv: unknown
          ultimo_reset_senha: string | null
          updated_at: string | null
          usuario_auth_id: string | null
        }
        Insert: {
          acesso_bloqueado?: boolean
          acesso_liberado?: boolean
          bi_numero?: string | null
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          campos_extras?: Json | null
          codigo_ativacao?: string | null
          created_at?: string
          data_ativacao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          documentos?: Json | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_relacao?: string | null
          encarregado_telefone?: string | null
          endereco?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          mae_nome?: string | null
          mesmo_que_encarregado?: boolean | null
          motivo_bloqueio?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome: string
          nome_busca?: string | null
          nome_completo?: string | null
          numero_documento?: string | null
          numero_processo?: string | null
          numero_processo_legado?: string | null
          pai_nome?: string | null
          profile_id?: string | null
          provincia?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_financeiro_nif?: string | null
          responsavel_financeiro_nome?: string | null
          responsavel_nome?: string | null
          search_text?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tipo_documento?: string | null
          tsv?: unknown
          ultimo_reset_senha?: string | null
          updated_at?: string | null
          usuario_auth_id?: string | null
        }
        Update: {
          acesso_bloqueado?: boolean
          acesso_liberado?: boolean
          bi_numero?: string | null
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          campos_extras?: Json | null
          codigo_ativacao?: string | null
          created_at?: string
          data_ativacao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          documentos?: Json | null
          email?: string | null
          encarregado_email?: string | null
          encarregado_nome?: string | null
          encarregado_relacao?: string | null
          encarregado_telefone?: string | null
          endereco?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          mae_nome?: string | null
          mesmo_que_encarregado?: boolean | null
          motivo_bloqueio?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome?: string
          nome_busca?: string | null
          nome_completo?: string | null
          numero_documento?: string | null
          numero_processo?: string | null
          numero_processo_legado?: string | null
          pai_nome?: string | null
          profile_id?: string | null
          provincia?: string | null
          responsavel?: string | null
          responsavel_contato?: string | null
          responsavel_financeiro_nif?: string | null
          responsavel_financeiro_nome?: string | null
          responsavel_nome?: string | null
          search_text?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          telefone_responsavel?: string | null
          tipo_documento?: string | null
          tsv?: unknown
          ultimo_reset_senha?: string | null
          updated_at?: string | null
          usuario_auth_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_bloqueado_por_fkey"
            columns: ["bloqueado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
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
      app_plan_limits: {
        Row: {
          api_enabled: boolean
          app_whatsapp_auto: boolean
          discount_percent: number
          doc_qr_code: boolean
          fin_recibo_pdf: boolean
          max_admin_users: number | null
          max_alunos: number | null
          max_storage_gb: number | null
          multi_campus: boolean
          plan: Database["public"]["Enums"]["app_plan_tier"]
          price_anual_kz: number
          price_mensal_kz: number
          professores_ilimitados: boolean
          promo_ends_at: string | null
          promo_label: string | null
          sec_matricula_online: boolean
          sec_upload_docs: boolean
          suporte_prioritario: boolean
          trial_days: number
          updated_at: string
        }
        Insert: {
          api_enabled?: boolean
          app_whatsapp_auto?: boolean
          discount_percent?: number
          doc_qr_code?: boolean
          fin_recibo_pdf?: boolean
          max_admin_users?: number | null
          max_alunos?: number | null
          max_storage_gb?: number | null
          multi_campus?: boolean
          plan: Database["public"]["Enums"]["app_plan_tier"]
          price_anual_kz?: number
          price_mensal_kz: number
          professores_ilimitados?: boolean
          promo_ends_at?: string | null
          promo_label?: string | null
          sec_matricula_online?: boolean
          sec_upload_docs?: boolean
          suporte_prioritario?: boolean
          trial_days?: number
          updated_at?: string
        }
        Update: {
          api_enabled?: boolean
          app_whatsapp_auto?: boolean
          discount_percent?: number
          doc_qr_code?: boolean
          fin_recibo_pdf?: boolean
          max_admin_users?: number | null
          max_alunos?: number | null
          max_storage_gb?: number | null
          multi_campus?: boolean
          plan?: Database["public"]["Enums"]["app_plan_tier"]
          price_anual_kz?: number
          price_mensal_kz?: number
          professores_ilimitados?: boolean
          promo_ends_at?: string | null
          promo_label?: string | null
          sec_matricula_online?: boolean
          sec_upload_docs?: boolean
          suporte_prioritario?: boolean
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          ciclo: string
          created_at: string | null
          data_inicio: string
          data_renovacao: string
          escola_id: string
          id: string
          metodo_pagamento: string
          motivo_origem: string | null
          multicaixa_referencia: string | null
          notas_internas: string | null
          origem_registo: string | null
          plano: Database["public"]["Enums"]["app_plan_tier"]
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          valor_kz: number
        }
        Insert: {
          ciclo: string
          created_at?: string | null
          data_inicio?: string
          data_renovacao: string
          escola_id: string
          id?: string
          metodo_pagamento: string
          motivo_origem?: string | null
          multicaixa_referencia?: string | null
          notas_internas?: string | null
          origem_registo?: string | null
          plano?: Database["public"]["Enums"]["app_plan_tier"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          valor_kz: number
        }
        Update: {
          ciclo?: string
          created_at?: string | null
          data_inicio?: string
          data_renovacao?: string
          escola_id?: string
          id?: string
          metodo_pagamento?: string
          motivo_origem?: string | null
          multicaixa_referencia?: string | null
          notas_internas?: string | null
          origem_registo?: string | null
          plano?: Database["public"]["Enums"]["app_plan_tier"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          valor_kz?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_escola_id_fkey"
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
          escola_id: string | null
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
          escola_id?: string | null
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
          escola_id?: string | null
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
          {
            foreignKeyName: "avaliacoes_turma_disciplina_id_fkey"
            columns: ["turma_disciplina_id"]
            isOneToOne: false
            referencedRelation: "turma_disciplinas"
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
          expires_at: string | null
          id: string
          matricula_id: string | null
          matriculado_em: string | null
          motivo_desconto: string | null
          nome_candidato: string | null
          percentagem_desconto: number | null
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
          expires_at?: string | null
          id?: string
          matricula_id?: string | null
          matriculado_em?: string | null
          motivo_desconto?: string | null
          nome_candidato?: string | null
          percentagem_desconto?: number | null
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
          expires_at?: string | null
          id?: string
          matricula_id?: string | null
          matriculado_em?: string | null
          motivo_desconto?: string | null
          nome_candidato?: string | null
          percentagem_desconto?: number | null
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
            foreignKeyName: "candidaturas_status_log_candidatura_id_fkey"
            columns: ["candidatura_id"]
            isOneToOne: false
            referencedRelation: "vw_search_candidaturas"
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
      centros_formacao: {
        Row: {
          abrev: string | null
          areas_formacao: Json
          capacidade_max: number | null
          commercial_notes: string | null
          created_at: string
          dados_pagamento: Json
          email: string | null
          escola_id: string
          id: string
          landing_config: Json
          last_automated_reminder_at: string | null
          last_commercial_contact_at: string | null
          last_manual_reminder_at: string | null
          logo_url: string | null
          modalidades: Json
          moeda: string
          morada: string | null
          municipio: string | null
          nif: string | null
          nipc: string | null
          nome: string
          notas_admin: string | null
          plano: string
          provincia: string
          provisionado_por: string | null
          regime_iva: string
          registo_maptess: string | null
          seo_config: Json
          status: string
          subscription_status: string
          subscription_updated_at: string | null
          telefone: string | null
          tracking_config: Json
          trial_ends_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          abrev?: string | null
          areas_formacao?: Json
          capacidade_max?: number | null
          commercial_notes?: string | null
          created_at?: string
          dados_pagamento?: Json
          email?: string | null
          escola_id: string
          id?: string
          landing_config?: Json
          last_automated_reminder_at?: string | null
          last_commercial_contact_at?: string | null
          last_manual_reminder_at?: string | null
          logo_url?: string | null
          modalidades?: Json
          moeda?: string
          morada?: string | null
          municipio?: string | null
          nif?: string | null
          nipc?: string | null
          nome: string
          notas_admin?: string | null
          plano?: string
          provincia?: string
          provisionado_por?: string | null
          regime_iva?: string
          registo_maptess?: string | null
          seo_config?: Json
          status?: string
          subscription_status?: string
          subscription_updated_at?: string | null
          telefone?: string | null
          tracking_config?: Json
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          abrev?: string | null
          areas_formacao?: Json
          capacidade_max?: number | null
          commercial_notes?: string | null
          created_at?: string
          dados_pagamento?: Json
          email?: string | null
          escola_id?: string
          id?: string
          landing_config?: Json
          last_automated_reminder_at?: string | null
          last_commercial_contact_at?: string | null
          last_manual_reminder_at?: string | null
          logo_url?: string | null
          modalidades?: Json
          moeda?: string
          morada?: string | null
          municipio?: string | null
          nif?: string | null
          nipc?: string | null
          nome?: string
          notas_admin?: string | null
          plano?: string
          provincia?: string
          provisionado_por?: string | null
          regime_iva?: string
          registo_maptess?: string | null
          seo_config?: Json
          status?: string
          subscription_status?: string
          subscription_updated_at?: string | null
          telefone?: string | null
          tracking_config?: Json
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centros_formacao_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centros_formacao_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
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
      configuracoes_financeiro: {
        Row: {
          bloquear_inadimplentes: boolean
          created_at: string
          dia_vencimento_padrao: number
          escola_id: string
          juros_diarios_percent: number
          moeda: string
          multa_atraso_percent: number
          updated_at: string
        }
        Insert: {
          bloquear_inadimplentes?: boolean
          created_at?: string
          dia_vencimento_padrao?: number
          escola_id: string
          juros_diarios_percent?: number
          moeda?: string
          multa_atraso_percent?: number
          updated_at?: string
        }
        Update: {
          bloquear_inadimplentes?: boolean
          created_at?: string
          dia_vencimento_padrao?: number
          escola_id?: string
          juros_diarios_percent?: number
          moeda?: string
          multa_atraso_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_financeiro_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_financeiro_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_preset_subjects: {
        Row: {
          avaliacao_mode: string | null
          component: Database["public"]["Enums"]["discipline_component"]
          conta_para_media_med: boolean | null
          grade_level: string
          id: string
          is_active: boolean
          is_avaliavel: boolean | null
          name: string
          preset_id: string | null
          subject_type: string | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
          weekly_hours: number
        }
        Insert: {
          avaliacao_mode?: string | null
          component: Database["public"]["Enums"]["discipline_component"]
          conta_para_media_med?: boolean | null
          grade_level: string
          id?: string
          is_active?: boolean
          is_avaliavel?: boolean | null
          name: string
          preset_id?: string | null
          subject_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
          weekly_hours?: number
        }
        Update: {
          avaliacao_mode?: string | null
          component?: Database["public"]["Enums"]["discipline_component"]
          conta_para_media_med?: boolean | null
          grade_level?: string
          id?: string
          is_active?: boolean
          is_avaliavel?: boolean | null
          name?: string
          preset_id?: string | null
          subject_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
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
      curriculum_preset_subjects_expected: {
        Row: {
          component: Database["public"]["Enums"]["discipline_component"]
          grade_level: string
          id: string
          name: string
          preset_id: string
          subject_type: string | null
          weekly_hours: number
        }
        Insert: {
          component: Database["public"]["Enums"]["discipline_component"]
          grade_level: string
          id?: string
          name: string
          preset_id: string
          subject_type?: string | null
          weekly_hours: number
        }
        Update: {
          component?: Database["public"]["Enums"]["discipline_component"]
          grade_level?: string
          id?: string
          name?: string
          preset_id?: string
          subject_type?: string | null
          weekly_hours?: number
        }
        Relationships: []
      }
      curriculum_presets: {
        Row: {
          badge: string | null
          category: Database["public"]["Enums"]["course_category"]
          class_max: number | null
          class_min: number | null
          course_code: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          recommended: boolean | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          badge?: string | null
          category: Database["public"]["Enums"]["course_category"]
          class_max?: number | null
          class_min?: number | null
          course_code?: string | null
          created_at?: string | null
          description?: string | null
          id: string
          name: string
          recommended?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          badge?: string | null
          category?: Database["public"]["Enums"]["course_category"]
          class_max?: number | null
          class_min?: number | null
          course_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          recommended?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: []
      }
      curriculum_presets_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          id: number
          preset_id: string | null
          subject_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: number
          preset_id?: string | null
          subject_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: number
          preset_id?: string | null
          subject_id?: string | null
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
          conta_para_media_med: boolean
          created_at: string
          curso_curriculo_id: string | null
          curso_id: string
          disciplina_id: string
          entra_no_horario: boolean | null
          escola_id: string
          id: string
          modelo_excecao_id: string | null
          obrigatoria: boolean
          ordem: number | null
          periodos_ativos: number[] | null
          preset_subject_id: string | null
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
          conta_para_media_med?: boolean
          created_at?: string
          curso_curriculo_id?: string | null
          curso_id: string
          disciplina_id: string
          entra_no_horario?: boolean | null
          escola_id: string
          id?: string
          modelo_excecao_id?: string | null
          obrigatoria?: boolean
          ordem?: number | null
          periodos_ativos?: number[] | null
          preset_subject_id?: string | null
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
          conta_para_media_med?: boolean
          created_at?: string
          curso_curriculo_id?: string | null
          curso_id?: string
          disciplina_id?: string
          entra_no_horario?: boolean | null
          escola_id?: string
          id?: string
          modelo_excecao_id?: string | null
          obrigatoria?: boolean
          ordem?: number | null
          periodos_ativos?: number[] | null
          preset_subject_id?: string | null
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
          {
            foreignKeyName: "curso_matriz_modelo_excecao_fk"
            columns: ["modelo_excecao_id"]
            isOneToOne: false
            referencedRelation: "modelos_avaliacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_curso_matriz_preset_subject"
            columns: ["preset_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_preset_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_professor_responsavel: {
        Row: {
          created_at: string
          created_by: string | null
          curso_id: string
          escola_id: string
          professor_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curso_id: string
          escola_id: string
          professor_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curso_id?: string
          escola_id?: string
          professor_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curso_professor_responsavel_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_professor_responsavel_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_professor_responsavel_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_professor_responsavel_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_professor_responsavel_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_professor_responsavel_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "vw_search_professores"
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
            referencedRelation: "vw_pagamentos_pendentes"
            referencedColumns: ["mensalidade_id"]
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
      encarregados: {
        Row: {
          bi_numero: string | null
          created_at: string | null
          email: string | null
          escola_id: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          bi_numero?: string | null
          created_at?: string | null
          email?: string | null
          escola_id: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          bi_numero?: string | null
          created_at?: string | null
          email?: string | null
          escola_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encarregados_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encarregados_escola_id_fkey"
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
      escola_notas_internas: {
        Row: {
          created_at: string
          created_by: string | null
          escola_id: string
          nota: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          escola_id: string
          nota?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          escola_id?: string
          nota?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escola_notas_internas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escola_notas_internas_escola_id_fkey"
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
          tenant_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          escola_id: string
          id?: string
          papel?: string
          role?: string | null
          tenant_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          escola_id?: string
          id?: string
          papel?: string
          role?: string | null
          tenant_type?: string
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
          config_portal_admissao: Json | null
          cor_primaria: string | null
          created_at: string | null
          dados_pagamento: Json | null
          endereco: string | null
          id: string
          logo_url: string | null
          needs_academic_setup: boolean | null
          nif: string | null
          nome: string
          onboarding_completed_at: string | null
          onboarding_completed_by: string | null
          onboarding_finalizado: boolean
          plano_atual: Database["public"]["Enums"]["app_plan_tier"]
          slug: string
          status: string | null
          tenant_type: string
          updated_at: string | null
          use_mv_dashboards: boolean
        }
        Insert: {
          aluno_portal_enabled?: boolean
          config_portal_admissao?: Json | null
          cor_primaria?: string | null
          created_at?: string | null
          dados_pagamento?: Json | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          needs_academic_setup?: boolean | null
          nif?: string | null
          nome: string
          onboarding_completed_at?: string | null
          onboarding_completed_by?: string | null
          onboarding_finalizado?: boolean
          plano_atual?: Database["public"]["Enums"]["app_plan_tier"]
          slug: string
          status?: string | null
          tenant_type?: string
          updated_at?: string | null
          use_mv_dashboards?: boolean
        }
        Update: {
          aluno_portal_enabled?: boolean
          config_portal_admissao?: Json | null
          cor_primaria?: string | null
          created_at?: string | null
          dados_pagamento?: Json | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          needs_academic_setup?: boolean | null
          nif?: string | null
          nome?: string
          onboarding_completed_at?: string | null
          onboarding_completed_by?: string | null
          onboarding_finalizado?: boolean
          plano_atual?: Database["public"]["Enums"]["app_plan_tier"]
          slug?: string
          status?: string | null
          tenant_type?: string
          updated_at?: string | null
          use_mv_dashboards?: boolean
        }
        Relationships: []
      }
      eventos: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entidade_id: string | null
          entidade_tipo: string | null
          escola_id: string
          id: string
          payload: Json
          tipo: Database["public"]["Enums"]["evento_tipo"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          escola_id: string
          id?: string
          payload?: Json
          tipo: Database["public"]["Enums"]["evento_tipo"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          escola_id?: string
          id?: string
          payload?: Json
          tipo?: Database["public"]["Enums"]["evento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "eventos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
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
      excecoes_pauta: {
        Row: {
          created_at: string | null
          criado_por: string
          disciplina_id: string | null
          escola_id: string
          expira_em: string
          id: string
          motivo: string
          trimestre: number | null
          turma_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          criado_por: string
          disciplina_id?: string | null
          escola_id: string
          expira_em: string
          id?: string
          motivo: string
          trimestre?: number | null
          turma_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string
          disciplina_id?: string | null
          escola_id?: string
          expira_em?: string
          id?: string
          motivo?: string
          trimestre?: number | null
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "excecoes_pauta_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excecoes_pauta_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excecoes_pauta_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excecoes_pauta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excecoes_pauta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "excecoes_pauta_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_academico_job_steps: {
        Row: {
          contexto: Json
          created_at: string
          error_message: string | null
          escola_id: string
          etapa: string
          executor_user_id: string | null
          id: number
          run_id: string
          status: string
        }
        Insert: {
          contexto?: Json
          created_at?: string
          error_message?: string | null
          escola_id: string
          etapa: string
          executor_user_id?: string | null
          id?: number
          run_id: string
          status: string
        }
        Update: {
          contexto?: Json
          created_at?: string
          error_message?: string | null
          escola_id?: string
          etapa?: string
          executor_user_id?: string | null
          id?: number
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_academico_job_steps_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_academico_job_steps_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_academico_job_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "fechamento_academico_jobs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      fechamento_academico_jobs: {
        Row: {
          ano_letivo_id: string
          counters: Json
          created_at: string
          errors: Json
          escola_id: string
          estado: string
          execution_mode: string
          executor_user_id: string | null
          fechamento_tipo: string
          finished_at: string | null
          id: string
          idempotency_key: string
          matricula_ids: string[]
          parametros: Json
          periodo_letivo_id: string | null
          run_id: string
          started_at: string | null
          turma_ids: string[]
          updated_at: string
        }
        Insert: {
          ano_letivo_id: string
          counters?: Json
          created_at?: string
          errors?: Json
          escola_id: string
          estado?: string
          execution_mode?: string
          executor_user_id?: string | null
          fechamento_tipo: string
          finished_at?: string | null
          id?: string
          idempotency_key: string
          matricula_ids?: string[]
          parametros?: Json
          periodo_letivo_id?: string | null
          run_id?: string
          started_at?: string | null
          turma_ids?: string[]
          updated_at?: string
        }
        Update: {
          ano_letivo_id?: string
          counters?: Json
          created_at?: string
          errors?: Json
          escola_id?: string
          estado?: string
          execution_mode?: string
          executor_user_id?: string | null
          fechamento_tipo?: string
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          matricula_ids?: string[]
          parametros?: Json
          periodo_letivo_id?: string | null
          run_id?: string
          started_at?: string | null
          turma_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_academico_jobs_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "anos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_academico_jobs_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "vw_escola_ano_letivo_preferido"
            referencedColumns: ["ano_letivo_id"]
          },
          {
            foreignKeyName: "fechamento_academico_jobs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_academico_jobs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_academico_jobs_periodo_letivo_id_fkey"
            columns: ["periodo_letivo_id"]
            isOneToOne: false
            referencedRelation: "periodos_letivos"
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
            referencedRelation: "vw_pagamentos_pendentes"
            referencedColumns: ["mensalidade_id"]
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
            referencedRelation: "vw_pagamentos_pendentes"
            referencedColumns: ["mensalidade_id"]
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
            referencedRelation: "vw_pagamentos_pendentes"
            referencedColumns: ["mensalidade_id"]
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
      financeiro_fiscal_links: {
        Row: {
          created_at: string
          empresa_id: string
          escola_id: string
          fiscal_documento_id: string | null
          fiscal_error: string | null
          id: string
          idempotency_key: string
          origem_id: string
          origem_tipo: string
          payload_snapshot: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          escola_id: string
          fiscal_documento_id?: string | null
          fiscal_error?: string | null
          id?: string
          idempotency_key: string
          origem_id: string
          origem_tipo: string
          payload_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          escola_id?: string
          fiscal_documento_id?: string | null
          fiscal_error?: string | null
          id?: string
          idempotency_key?: string
          origem_id?: string
          origem_tipo?: string
          payload_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_fiscal_links_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_fiscal_links_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_fiscal_links_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_fiscal_links_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
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
      fiscal_chaves: {
        Row: {
          activated_at: string | null
          algorithm: string
          created_at: string
          empresa_id: string
          id: string
          key_fingerprint: string
          key_version: number
          metadata: Json
          private_key_ref: string | null
          public_key_pem: string
          retired_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          algorithm?: string
          created_at?: string
          empresa_id: string
          id?: string
          key_fingerprint: string
          key_version: number
          metadata?: Json
          private_key_ref?: string | null
          public_key_pem: string
          retired_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          algorithm?: string
          created_at?: string
          empresa_id?: string
          id?: string
          key_fingerprint?: string
          key_version?: number
          metadata?: Json
          private_key_ref?: string | null
          public_key_pem?: string
          retired_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_chaves_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documento_itens: {
        Row: {
          created_at: string
          descricao: string
          documento_id: string
          empresa_id: string
          id: string
          linha_no: number
          preco_unit: number
          product_code: string | null
          product_number_code: string | null
          quantidade: number
          tax_exemption_code: string | null
          tax_exemption_reason: string | null
          taxa_iva: number
          total_bruto_aoa: number
          total_impostos_aoa: number
          total_liquido_aoa: number
        }
        Insert: {
          created_at?: string
          descricao: string
          documento_id: string
          empresa_id: string
          id?: string
          linha_no: number
          preco_unit: number
          product_code?: string | null
          product_number_code?: string | null
          quantidade: number
          tax_exemption_code?: string | null
          tax_exemption_reason?: string | null
          taxa_iva: number
          total_bruto_aoa: number
          total_impostos_aoa: number
          total_liquido_aoa: number
        }
        Update: {
          created_at?: string
          descricao?: string
          documento_id?: string
          empresa_id?: string
          id?: string
          linha_no?: number
          preco_unit?: number
          product_code?: string | null
          product_number_code?: string | null
          quantidade?: number
          tax_exemption_code?: string | null
          tax_exemption_reason?: string | null
          taxa_iva?: number
          total_bruto_aoa?: number
          total_impostos_aoa?: number
          total_liquido_aoa?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documento_itens_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documento_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documentos: {
        Row: {
          assinatura_base64: string | null
          canonical_string: string | null
          cliente_id: string | null
          cliente_nif: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          documento_origem_id: string | null
          empresa_id: string
          hash_anterior: string | null
          hash_control: string
          id: string
          invoice_date: string
          key_version: number
          moeda: string
          numero: number
          numero_formatado: string
          payload: Json
          payment_mechanism: string | null
          pdf_storage_path: string | null
          rectifica_documento_id: string | null
          serie_id: string
          status: string
          system_entry: string
          taxa_cambio_aoa: number | null
          tipo_documento: string
          total_bruto_aoa: number
          total_impostos_aoa: number
          total_liquido_aoa: number
          xml_storage_path: string | null
        }
        Insert: {
          assinatura_base64?: string | null
          canonical_string?: string | null
          cliente_id?: string | null
          cliente_nif?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          documento_origem_id?: string | null
          empresa_id: string
          hash_anterior?: string | null
          hash_control: string
          id?: string
          invoice_date: string
          key_version: number
          moeda?: string
          numero: number
          numero_formatado: string
          payload?: Json
          payment_mechanism?: string | null
          pdf_storage_path?: string | null
          rectifica_documento_id?: string | null
          serie_id: string
          status: string
          system_entry?: string
          taxa_cambio_aoa?: number | null
          tipo_documento: string
          total_bruto_aoa: number
          total_impostos_aoa: number
          total_liquido_aoa: number
          xml_storage_path?: string | null
        }
        Update: {
          assinatura_base64?: string | null
          canonical_string?: string | null
          cliente_id?: string | null
          cliente_nif?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          documento_origem_id?: string | null
          empresa_id?: string
          hash_anterior?: string | null
          hash_control?: string
          id?: string
          invoice_date?: string
          key_version?: number
          moeda?: string
          numero?: number
          numero_formatado?: string
          payload?: Json
          payment_mechanism?: string | null
          pdf_storage_path?: string | null
          rectifica_documento_id?: string | null
          serie_id?: string
          status?: string
          system_entry?: string
          taxa_cambio_aoa?: number | null
          tipo_documento?: string
          total_bruto_aoa?: number
          total_impostos_aoa?: number
          total_liquido_aoa?: number
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documentos_documento_origem_fk"
            columns: ["documento_origem_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_fk_key_version"
            columns: ["empresa_id", "key_version"]
            isOneToOne: false
            referencedRelation: "fiscal_chaves"
            referencedColumns: ["empresa_id", "key_version"]
          },
          {
            foreignKeyName: "fiscal_documentos_rectifica_documento_id_fkey"
            columns: ["rectifica_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "fiscal_series"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documentos_eventos: {
        Row: {
          created_at: string
          created_by: string | null
          documento_id: string
          empresa_id: string
          id: string
          payload: Json
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          documento_id: string
          empresa_id: string
          id?: string
          payload?: Json
          tipo_evento: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          documento_id?: string
          empresa_id?: string
          id?: string
          payload?: Json
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documentos_eventos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documentos_eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_empresa_users: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_empresa_users_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_empresas: {
        Row: {
          certificado_agt_numero: string | null
          created_at: string
          endereco: string | null
          id: string
          metadata: Json
          nif: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          certificado_agt_numero?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          metadata?: Json
          nif: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          certificado_agt_numero?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          metadata?: Json
          nif?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_escola_bindings: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          empresa_id: string
          escola_id: string
          id: string
          is_primary: boolean
          metadata: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          empresa_id: string
          escola_id: string
          id?: string
          is_primary?: boolean
          metadata?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          empresa_id?: string
          escola_id?: string
          id?: string
          is_primary?: boolean
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_escola_bindings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_escola_bindings_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_escola_bindings_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_reprocess_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          empresa_id: string
          error_message: string | null
          escola_id: string
          failed_links: number
          id: string
          metadata: Json
          processed_links: number
          requested_by: string | null
          started_at: string | null
          status: string
          success_links: number
          total_links: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          empresa_id: string
          error_message?: string | null
          escola_id: string
          failed_links?: number
          id?: string
          metadata?: Json
          processed_links?: number
          requested_by?: string | null
          started_at?: string | null
          status?: string
          success_links?: number
          total_links?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          empresa_id?: string
          error_message?: string | null
          escola_id?: string
          failed_links?: number
          id?: string
          metadata?: Json
          processed_links?: number
          requested_by?: string | null
          started_at?: string | null
          status?: string
          success_links?: number
          total_links?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_reprocess_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_reprocess_jobs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_reprocess_jobs_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_saft_exports: {
        Row: {
          arquivo_storage_path: string | null
          checksum_sha256: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          metadata: Json
          periodo_fim: string
          periodo_inicio: string
          status: string
          xsd_version: string
        }
        Insert: {
          arquivo_storage_path?: string | null
          checksum_sha256: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          metadata?: Json
          periodo_fim: string
          periodo_inicio: string
          status?: string
          xsd_version: string
        }
        Update: {
          arquivo_storage_path?: string | null
          checksum_sha256?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          metadata?: Json
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          xsd_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_saft_exports_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_series: {
        Row: {
          ativa: boolean
          created_at: string
          descontinuada_em: string | null
          empresa_id: string
          id: string
          metadata: Json
          origem_documento: string
          prefixo: string
          tipo_documento: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          descontinuada_em?: string | null
          empresa_id: string
          id?: string
          metadata?: Json
          origem_documento: string
          prefixo: string
          tipo_documento: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          descontinuada_em?: string | null
          empresa_id?: string
          id?: string
          metadata?: Json
          origem_documento?: string
          prefixo?: string
          tipo_documento?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_series_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "fiscal_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_aulas: {
        Row: {
          cohort_id: string
          conteudo_previsto: string | null
          conteudo_realizado: string | null
          created_at: string | null
          data: string
          escola_id: string
          formador_user_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          horas_ministradas: number | null
          id: string
          observacoes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          cohort_id: string
          conteudo_previsto?: string | null
          conteudo_realizado?: string | null
          created_at?: string | null
          data: string
          escola_id: string
          formador_user_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          horas_ministradas?: number | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          cohort_id?: string
          conteudo_previsto?: string | null
          conteudo_realizado?: string | null
          created_at?: string | null
          data?: string
          escola_id?: string
          formador_user_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          horas_ministradas?: number | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_aulas_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_aulas_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_aulas_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_aulas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_aulas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_certificado_templates: {
        Row: {
          ativo: boolean
          base_legal: string | null
          cargo_assinatura: string | null
          created_at: string
          created_by: string | null
          diretora_nome: string | null
          escola_id: string
          id: string
          nome: string
          regime_default: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base_legal?: string | null
          cargo_assinatura?: string | null
          created_at?: string
          created_by?: string | null
          diretora_nome?: string | null
          escola_id: string
          id?: string
          nome: string
          regime_default?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base_legal?: string | null
          cargo_assinatura?: string | null
          created_at?: string
          created_by?: string | null
          diretora_nome?: string | null
          escola_id?: string
          id?: string
          nome?: string
          regime_default?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_certificado_templates_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_certificado_templates_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_certificados_emitidos: {
        Row: {
          cohort_id: string | null
          created_at: string
          created_by: string | null
          emitido_em: string
          escola_id: string
          formando_user_id: string
          id: string
          numero_documento: string
          payload_snapshot: Json
          template_id: string | null
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          emitido_em?: string
          escola_id: string
          formando_user_id: string
          id?: string
          numero_documento: string
          payload_snapshot?: Json
          template_id?: string | null
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          emitido_em?: string
          escola_id?: string
          formando_user_id?: string
          id?: string
          numero_documento?: string
          payload_snapshot?: Json
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_certificados_emitidos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_certificados_emitidos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_certificados_emitidos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_certificados_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_certificados_emitidos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_certificados_emitidos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "formacao_certificado_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_clientes_b2b: {
        Row: {
          created_at: string
          email_financeiro: string | null
          escola_id: string
          id: string
          nif: string | null
          nome_fantasia: string
          razao_social: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_financeiro?: string | null
          escola_id: string
          id?: string
          nif?: string | null
          nome_fantasia: string
          razao_social?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_financeiro?: string | null
          escola_id?: string
          id?: string
          nif?: string | null
          nome_fantasia?: string
          razao_social?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_clientes_b2b_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_clientes_b2b_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_cohort_financeiro: {
        Row: {
          cohort_id: string
          created_at: string
          created_by: string | null
          custo_marketing: number
          escola_id: string
          id: string
          moeda: string
          updated_at: string
          valor_referencia: number
        }
        Insert: {
          cohort_id: string
          created_at?: string
          created_by?: string | null
          custo_marketing?: number
          escola_id: string
          id?: string
          moeda?: string
          updated_at?: string
          valor_referencia: number
        }
        Update: {
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          custo_marketing?: number
          escola_id?: string
          id?: string
          moeda?: string
          updated_at?: string
          valor_referencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohort_financeiro_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_financeiro_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_cohort_financeiro_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_financeiro_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_financeiro_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_cohort_formadores: {
        Row: {
          cohort_id: string
          created_at: string
          escola_id: string
          formador_user_id: string
          id: string
          percentual_honorario: number
        }
        Insert: {
          cohort_id: string
          created_at?: string
          escola_id: string
          formador_user_id: string
          id?: string
          percentual_honorario?: number
        }
        Update: {
          cohort_id?: string
          created_at?: string
          escola_id?: string
          formador_user_id?: string
          id?: string
          percentual_honorario?: number
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohort_formadores_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_formadores_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_cohort_formadores_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_formadores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_formadores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_cohort_materiais: {
        Row: {
          cohort_id: string
          created_at: string | null
          curso_id: string | null
          escola_id: string
          id: string
          tipo: string
          titulo: string
          updated_at: string | null
          url: string
        }
        Insert: {
          cohort_id: string
          created_at?: string | null
          curso_id?: string | null
          escola_id: string
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string | null
          url: string
        }
        Update: {
          cohort_id?: string
          created_at?: string | null
          curso_id?: string | null
          escola_id?: string
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohort_materiais_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_materiais_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_cohort_materiais_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_materiais_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_materiais_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_cohort_materiais_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_materiais_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_cohort_modulos: {
        Row: {
          carga_horaria: number | null
          cohort_id: string
          created_at: string
          curso_id: string
          descricao: string | null
          escola_id: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          carga_horaria?: number | null
          cohort_id: string
          created_at?: string
          curso_id: string
          descricao?: string | null
          escola_id: string
          id?: string
          ordem: number
          titulo: string
          updated_at?: string
        }
        Update: {
          carga_horaria?: number | null
          cohort_id?: string
          created_at?: string
          curso_id?: string
          descricao?: string | null
          escola_id?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohort_modulos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_modulos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_cohort_modulos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_cohort_modulos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohort_modulos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_cohorts: {
        Row: {
          carga_horaria_total: number
          codigo: string
          created_at: string
          curso_id: string | null
          curso_nome: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id: string
          nome: string
          status: string
          turno: string | null
          updated_at: string
          vagas: number
          visivel_na_landing: boolean | null
        }
        Insert: {
          carga_horaria_total: number
          codigo: string
          created_at?: string
          curso_id?: string | null
          curso_nome: string
          data_fim: string
          data_inicio: string
          escola_id: string
          id?: string
          nome: string
          status?: string
          turno?: string | null
          updated_at?: string
          vagas: number
          visivel_na_landing?: boolean | null
        }
        Update: {
          carga_horaria_total?: number
          codigo?: string
          created_at?: string
          curso_id?: string | null
          curso_nome?: string
          data_fim?: string
          data_inicio?: string
          escola_id?: string
          id?: string
          nome?: string
          status?: string
          turno?: string | null
          updated_at?: string
          vagas?: number
          visivel_na_landing?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohorts_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohorts_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_contratos_b2b: {
        Row: {
          b2b_token: string
          cohort_id: string
          created_at: string | null
          empresa_nif: string
          empresa_nome: string
          escola_id: string
          fatura_externa_ref: string | null
          id: string
          status: string | null
          updated_at: string | null
          vagas_compradas: number
          vagas_utilizadas: number
          valor_total: number
        }
        Insert: {
          b2b_token: string
          cohort_id: string
          created_at?: string | null
          empresa_nif: string
          empresa_nome: string
          escola_id: string
          fatura_externa_ref?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          vagas_compradas: number
          vagas_utilizadas?: number
          valor_total: number
        }
        Update: {
          b2b_token?: string
          cohort_id?: string
          created_at?: string | null
          empresa_nif?: string
          empresa_nome?: string
          escola_id?: string
          fatura_externa_ref?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          vagas_compradas?: number
          vagas_utilizadas?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "formacao_contratos_b2b_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_contratos_b2b_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_contratos_b2b_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_contratos_b2b_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_contratos_b2b_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_curso_comercial: {
        Row: {
          created_at: string
          curso_id: string
          custo_hora_estimado: number | null
          desconto_ativo: boolean
          desconto_percentual: number
          escola_id: string
          id: string
          parceria_b2b_ativa: boolean
          preco_tabela: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          custo_hora_estimado?: number | null
          desconto_ativo?: boolean
          desconto_percentual?: number
          escola_id: string
          id?: string
          parceria_b2b_ativa?: boolean
          preco_tabela?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          custo_hora_estimado?: number | null
          desconto_ativo?: boolean
          desconto_percentual?: number
          escola_id?: string
          id?: string
          parceria_b2b_ativa?: boolean
          preco_tabela?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_curso_comercial_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: true
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_curso_comercial_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: true
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_curso_comercial_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_curso_comercial_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_curso_materiais: {
        Row: {
          created_at: string | null
          curso_id: string
          escola_id: string
          id: string
          tipo: string
          titulo: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          curso_id: string
          escola_id: string
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          curso_id?: string
          escola_id?: string
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_curso_materiais_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_curso_materiais_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_curso_materiais_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_curso_materiais_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_curso_modulos: {
        Row: {
          carga_horaria: number | null
          created_at: string
          curso_id: string
          descricao: string | null
          escola_id: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          carga_horaria?: number | null
          created_at?: string
          curso_id: string
          descricao?: string | null
          escola_id: string
          id?: string
          ordem: number
          titulo: string
          updated_at?: string
        }
        Update: {
          carga_horaria?: number | null
          created_at?: string
          curso_id?: string
          descricao?: string | null
          escola_id?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_curso_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_curso_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_curso_modulos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_curso_modulos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_cursos: {
        Row: {
          area: string | null
          carga_horaria: number | null
          certificado_template_id: string | null
          codigo: string
          created_at: string
          escola_id: string
          id: string
          modalidade: string
          nome: string
          objetivos: Json | null
          requisitos: Json | null
          seo_config: Json | null
          slug: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          area?: string | null
          carga_horaria?: number | null
          certificado_template_id?: string | null
          codigo: string
          created_at?: string
          escola_id: string
          id?: string
          modalidade?: string
          nome: string
          objetivos?: Json | null
          requisitos?: Json | null
          seo_config?: Json | null
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          area?: string | null
          carga_horaria?: number | null
          certificado_template_id?: string | null
          codigo?: string
          created_at?: string
          escola_id?: string
          id?: string
          modalidade?: string
          nome?: string
          objetivos?: Json | null
          requisitos?: Json | null
          seo_config?: Json | null
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cursos_certificado_template_id_fkey"
            columns: ["certificado_template_id"]
            isOneToOne: false
            referencedRelation: "formacao_certificado_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cursos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cursos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_faturas_lote: {
        Row: {
          b2b_token: string | null
          cliente_b2b_id: string
          cohort_id: string | null
          created_at: string
          created_by: string | null
          emissao_em: string
          escola_id: string
          id: string
          moeda: string
          referencia: string
          status: string
          total_bruto: number
          total_desconto: number
          total_liquido: number | null
          updated_at: string
          vagas_contratadas: number | null
          vagas_utilizadas: number | null
          vencimento_em: string
        }
        Insert: {
          b2b_token?: string | null
          cliente_b2b_id: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          emissao_em?: string
          escola_id: string
          id?: string
          moeda?: string
          referencia: string
          status?: string
          total_bruto?: number
          total_desconto?: number
          total_liquido?: number | null
          updated_at?: string
          vagas_contratadas?: number | null
          vagas_utilizadas?: number | null
          vencimento_em: string
        }
        Update: {
          b2b_token?: string | null
          cliente_b2b_id?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          emissao_em?: string
          escola_id?: string
          id?: string
          moeda?: string
          referencia?: string
          status?: string
          total_bruto?: number
          total_desconto?: number
          total_liquido?: number | null
          updated_at?: string
          vagas_contratadas?: number | null
          vagas_utilizadas?: number | null
          vencimento_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_faturas_lote_cliente_b2b_id_fkey"
            columns: ["cliente_b2b_id"]
            isOneToOne: false
            referencedRelation: "formacao_clientes_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_faturas_lote_itens: {
        Row: {
          created_at: string
          desconto: number
          descricao: string
          escola_id: string
          fatura_lote_id: string
          formando_user_id: string
          id: string
          preco_unitario: number
          quantidade: number
          status_pagamento: string
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          desconto?: number
          descricao: string
          escola_id: string
          fatura_lote_id: string
          formando_user_id: string
          id?: string
          preco_unitario: number
          quantidade?: number
          status_pagamento?: string
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          desconto?: number
          descricao?: string
          escola_id?: string
          fatura_lote_id?: string
          formando_user_id?: string
          id?: string
          preco_unitario?: number
          quantidade?: number
          status_pagamento?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_faturas_lote_itens_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_itens_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_itens_fatura_lote_id_fkey"
            columns: ["fatura_lote_id"]
            isOneToOne: false
            referencedRelation: "formacao_faturas_lote"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_funnel_eventos: {
        Row: {
          app: string
          created_at: string
          details: Json
          event: string
          id: number
          path: string | null
          source: string | null
          stage: string
          tenant_id: string | null
          tenant_slug: string | null
          user_id: string | null
        }
        Insert: {
          app?: string
          created_at?: string
          details?: Json
          event: string
          id?: never
          path?: string | null
          source?: string | null
          stage: string
          tenant_id?: string | null
          tenant_slug?: string | null
          user_id?: string | null
        }
        Update: {
          app?: string
          created_at?: string
          details?: Json
          event?: string
          id?: never
          path?: string | null
          source?: string | null
          stage?: string
          tenant_id?: string | null
          tenant_slug?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      formacao_honorarios_lancamentos: {
        Row: {
          bonus: number
          cohort_id: string
          competencia: string
          created_at: string
          created_by: string | null
          desconto: number
          escola_id: string
          formador_user_id: string
          horas_ministradas: number
          id: string
          referencia: string
          status: string
          updated_at: string
          valor_bruto: number | null
          valor_hora: number
          valor_liquido: number | null
        }
        Insert: {
          bonus?: number
          cohort_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          desconto?: number
          escola_id: string
          formador_user_id: string
          horas_ministradas: number
          id?: string
          referencia: string
          status?: string
          updated_at?: string
          valor_bruto?: number | null
          valor_hora: number
          valor_liquido?: number | null
        }
        Update: {
          bonus?: number
          cohort_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          desconto?: number
          escola_id?: string
          formador_user_id?: string
          horas_ministradas?: number
          id?: string
          referencia?: string
          status?: string
          updated_at?: string
          valor_bruto?: number | null
          valor_hora?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_honorarios_lancamentos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_inscricoes: {
        Row: {
          bi_snapshot: string | null
          cancelled_at: string | null
          cohort_id: string
          created_at: string
          created_by: string | null
          email_snapshot: string | null
          escola_id: string
          estado: string
          formando_user_id: string
          id: string
          metadata: Json
          modalidade: string
          nome_snapshot: string | null
          origem: string
          status_pagamento: string
          telefone_snapshot: string | null
          updated_at: string
          valor_cobrado: number
        }
        Insert: {
          bi_snapshot?: string | null
          cancelled_at?: string | null
          cohort_id: string
          created_at?: string
          created_by?: string | null
          email_snapshot?: string | null
          escola_id: string
          estado?: string
          formando_user_id: string
          id?: string
          metadata?: Json
          modalidade?: string
          nome_snapshot?: string | null
          origem?: string
          status_pagamento?: string
          telefone_snapshot?: string | null
          updated_at?: string
          valor_cobrado?: number
        }
        Update: {
          bi_snapshot?: string | null
          cancelled_at?: string | null
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          email_snapshot?: string | null
          escola_id?: string
          estado?: string
          formando_user_id?: string
          id?: string
          metadata?: Json
          modalidade?: string
          nome_snapshot?: string | null
          origem?: string
          status_pagamento?: string
          telefone_snapshot?: string | null
          updated_at?: string
          valor_cobrado?: number
        }
        Relationships: [
          {
            foreignKeyName: "formacao_inscricoes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_inscricoes_staging: {
        Row: {
          bi_passaporte: string
          cohort_id: string
          comprovativo_url: string
          created_at: string
          email: string | null
          escola_id: string
          id: string
          nome_completo: string
          status: string
          telefone: string
        }
        Insert: {
          bi_passaporte: string
          cohort_id: string
          comprovativo_url: string
          created_at?: string
          email?: string | null
          escola_id: string
          id?: string
          nome_completo: string
          status?: string
          telefone: string
        }
        Update: {
          bi_passaporte?: string
          cohort_id?: string
          comprovativo_url?: string
          created_at?: string
          email?: string | null
          escola_id?: string
          id?: string
          nome_completo?: string
          status?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_inscricoes_staging_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_leads: {
        Row: {
          cohort_id: string | null
          created_at: string | null
          curso_id: string | null
          email: string | null
          escola_id: string
          id: string
          metadata: Json | null
          nome: string
          origem: string | null
          telefone: string | null
          turno_preferencia: string | null
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          email?: string | null
          escola_id: string
          id?: string
          metadata?: Json | null
          nome: string
          origem?: string | null
          telefone?: string | null
          turno_preferencia?: string | null
        }
        Update: {
          cohort_id?: string | null
          created_at?: string | null
          curso_id?: string | null
          email?: string | null
          escola_id?: string
          id?: string
          metadata?: Json | null
          nome?: string
          origem?: string | null
          telefone?: string | null
          turno_preferencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_leads_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_leads_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_leads_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_leads_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "formacao_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_leads_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_curso_cockpit_metrics"
            referencedColumns: ["curso_id"]
          },
          {
            foreignKeyName: "formacao_leads_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_leads_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_modulo_avaliacoes: {
        Row: {
          conceito: string | null
          created_at: string | null
          escola_id: string
          id: string
          inscricao_id: string
          modulo_id: string
          nota: number | null
          observacoes: string | null
          updated_at: string | null
        }
        Insert: {
          conceito?: string | null
          created_at?: string | null
          escola_id: string
          id?: string
          inscricao_id: string
          modulo_id: string
          nota?: number | null
          observacoes?: string | null
          updated_at?: string | null
        }
        Update: {
          conceito?: string | null
          created_at?: string | null
          escola_id?: string
          id?: string
          inscricao_id?: string
          modulo_id?: string
          nota?: number | null
          observacoes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_modulo_avaliacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_modulo_avaliacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_modulo_avaliacoes_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "formacao_inscricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_modulo_avaliacoes_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_estudante_progresso"
            referencedColumns: ["inscricao_id"]
          },
          {
            foreignKeyName: "formacao_modulo_avaliacoes_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohort_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_plan_settings: {
        Row: {
          discount_percent: number
          plan: string
          price_anual_kz: number
          price_mensal_kz: number
          promo_ends_at: string | null
          promo_label: string | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          discount_percent?: number
          plan: string
          price_anual_kz?: number
          price_mensal_kz?: number
          promo_ends_at?: string | null
          promo_label?: string | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          discount_percent?: number
          plan?: string
          price_anual_kz?: number
          price_mensal_kz?: number
          promo_ends_at?: string | null
          promo_label?: string | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      formacao_presencas: {
        Row: {
          aula_id: string
          created_at: string | null
          escola_id: string
          id: string
          inscricao_id: string
          justificativa: string | null
          presente: boolean
          updated_at: string | null
        }
        Insert: {
          aula_id: string
          created_at?: string | null
          escola_id: string
          id?: string
          inscricao_id: string
          justificativa?: string | null
          presente?: boolean
          updated_at?: string | null
        }
        Update: {
          aula_id?: string
          created_at?: string | null
          escola_id?: string
          id?: string
          inscricao_id?: string
          justificativa?: string | null
          presente?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_presencas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "formacao_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_presencas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_presencas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_presencas_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "formacao_inscricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_presencas_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_estudante_progresso"
            referencedColumns: ["inscricao_id"]
          },
        ]
      }
      formacao_salas_infraestrutura: {
        Row: {
          capacidade: number
          created_at: string
          escola_id: string
          id: string
          localizacao: string | null
          nome: string
          observacoes: string | null
          recursos: Json
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          capacidade: number
          created_at?: string
          escola_id: string
          id?: string
          localizacao?: string | null
          nome: string
          observacoes?: string | null
          recursos?: Json
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          capacidade?: number
          created_at?: string
          escola_id?: string
          id?: string
          localizacao?: string | null
          nome?: string
          observacoes?: string | null
          recursos?: Json
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_salas_infraestrutura_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_salas_infraestrutura_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      formacao_testemunhos: {
        Row: {
          autor_avatar_url: string | null
          autor_cargo: string | null
          autor_nome: string
          conteudo: string
          created_at: string
          curso_nome: string | null
          escola_id: string
          estrelas: number
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          autor_avatar_url?: string | null
          autor_cargo?: string | null
          autor_nome: string
          conteudo: string
          created_at?: string
          curso_nome?: string | null
          escola_id: string
          estrelas?: number
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          autor_avatar_url?: string | null
          autor_cargo?: string | null
          autor_nome?: string
          conteudo?: string
          created_at?: string
          curso_nome?: string | null
          escola_id?: string
          estrelas?: number
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formacao_testemunhos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_testemunhos_escola_id_fkey"
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
      frequencias_2026_04: {
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
      frequencias_2026_05: {
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
      frequencias_2026_06: {
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
          ano_letivo_id: string | null
          data_fechamento: string
          escola_id: string
          id: string
          matricula_id: string | null
          media_geral: number | null
          resultado_final: string
          snapshot_lock_run_id: string | null
          snapshot_locked_at: string | null
          snapshot_reopen_reason: string | null
          snapshot_reopened_at: string | null
          snapshot_reopened_by: string | null
          snapshot_status: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          ano_letivo: number
          ano_letivo_id?: string | null
          data_fechamento?: string
          escola_id: string
          id?: string
          matricula_id?: string | null
          media_geral?: number | null
          resultado_final: string
          snapshot_lock_run_id?: string | null
          snapshot_locked_at?: string | null
          snapshot_reopen_reason?: string | null
          snapshot_reopened_at?: string | null
          snapshot_reopened_by?: string | null
          snapshot_status?: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number
          ano_letivo_id?: string | null
          data_fechamento?: string
          escola_id?: string
          id?: string
          matricula_id?: string | null
          media_geral?: number | null
          resultado_final?: string
          snapshot_lock_run_id?: string | null
          snapshot_locked_at?: string | null
          snapshot_reopen_reason?: string | null
          snapshot_reopened_at?: string | null
          snapshot_reopened_by?: string | null
          snapshot_status?: string
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
      historico_snapshot_locks: {
        Row: {
          allow_reopen: boolean
          ano_letivo_id: string
          created_at: string
          escola_id: string
          historico_ano_id: string | null
          id: string
          lock_job_id: string | null
          lock_reason: string | null
          lock_run_id: string | null
          lock_source: string
          lock_step: string | null
          locked_at: string | null
          matricula_id: string
          reopened_at: string | null
          reopened_by: string | null
          reopened_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allow_reopen?: boolean
          ano_letivo_id: string
          created_at?: string
          escola_id: string
          historico_ano_id?: string | null
          id?: string
          lock_job_id?: string | null
          lock_reason?: string | null
          lock_run_id?: string | null
          lock_source?: string
          lock_step?: string | null
          locked_at?: string | null
          matricula_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          reopened_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allow_reopen?: boolean
          ano_letivo_id?: string
          created_at?: string
          escola_id?: string
          historico_ano_id?: string | null
          id?: string
          lock_job_id?: string | null
          lock_reason?: string | null
          lock_run_id?: string | null
          lock_source?: string
          lock_step?: string | null
          locked_at?: string | null
          matricula_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          reopened_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_snapshot_locks_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "anos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "vw_escola_ano_letivo_preferido"
            referencedColumns: ["ano_letivo_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_historico_ano_id_fkey"
            columns: ["historico_ano_id"]
            isOneToOne: false
            referencedRelation: "historico_anos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      horario_eventos: {
        Row: {
          created_at: string
          created_by: string | null
          escola_id: string
          id: string
          payload: Json | null
          tipo: string
          turma_id: string
          versao_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          escola_id: string
          id?: string
          payload?: Json | null
          tipo: string
          turma_id: string
          versao_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          escola_id?: string
          id?: string
          payload?: Json | null
          tipo?: string
          turma_id?: string
          versao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horario_eventos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_eventos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_eventos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_eventos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "horario_eventos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_eventos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "horario_versoes"
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
      horario_versoes: {
        Row: {
          created_at: string
          escola_id: string
          id: string
          publicado_em: string | null
          status: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escola_id: string
          id?: string
          publicado_em?: string | null
          status?: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escola_id?: string
          id?: string
          publicado_em?: string | null
          status?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horario_versoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_versoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_versoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horario_versoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "horario_versoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          escola_id: string
          key: string
          result: Json | null
          scope: string
        }
        Insert: {
          created_at?: string
          escola_id: string
          key: string
          result?: Json | null
          scope: string
        }
        Update: {
          created_at?: string
          escola_id?: string
          key?: string
          result?: Json | null
          scope?: string
        }
        Relationships: []
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
      import_financeiro_pendencias: {
        Row: {
          aluno_id: string | null
          created_at: string
          detalhes: Json | null
          escola_id: string
          id: string
          import_id: string
          matricula_id: string | null
          mensagem: string
          motivo: string
          resolved_at: string | null
          resolved_by: string | null
          resolvido: boolean | null
          turma_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          detalhes?: Json | null
          escola_id: string
          id?: string
          import_id: string
          matricula_id?: string | null
          mensagem: string
          motivo: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolvido?: boolean | null
          turma_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          detalhes?: Json | null
          escola_id?: string
          id?: string
          import_id?: string
          matricula_id?: string | null
          mensagem?: string
          motivo?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolvido?: boolean | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_financeiro_pendencias_import_id_fkey"
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
      lancamentos_2026_04: {
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
      lancamentos_2026_05: {
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
      lancamentos_2026_06: {
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
          data_fecho: string | null
          data_inicio_financeiro: string | null
          data_matricula: string | null
          escola_id: string
          id: string
          import_id: string | null
          motivo_desconto: string | null
          motivo_fecho: string | null
          numero_chamada: number | null
          numero_matricula: string | null
          origem_transicao_matricula_id: string | null
          percentagem_desconto: number | null
          secao_id: string | null
          session_id: string | null
          status: string
          status_fecho_origem: string | null
          turma_id: string | null
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          ano_letivo?: number | null
          ativo?: boolean | null
          created_at?: string | null
          data_fecho?: string | null
          data_inicio_financeiro?: string | null
          data_matricula?: string | null
          escola_id: string
          id?: string
          import_id?: string | null
          motivo_desconto?: string | null
          motivo_fecho?: string | null
          numero_chamada?: number | null
          numero_matricula?: string | null
          origem_transicao_matricula_id?: string | null
          percentagem_desconto?: number | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          status_fecho_origem?: string | null
          turma_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number | null
          ativo?: boolean | null
          created_at?: string | null
          data_fecho?: string | null
          data_inicio_financeiro?: string | null
          data_matricula?: string | null
          escola_id?: string
          id?: string
          import_id?: string | null
          motivo_desconto?: string | null
          motivo_fecho?: string | null
          numero_chamada?: number | null
          numero_matricula?: string | null
          origem_transicao_matricula_id?: string | null
          percentagem_desconto?: number | null
          secao_id?: string | null
          session_id?: string | null
          status?: string
          status_fecho_origem?: string | null
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
            foreignKeyName: "matriculas_origem_transicao_fk"
            columns: ["origem_transicao_matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_origem_transicao_fk"
            columns: ["origem_transicao_matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_origem_transicao_fk"
            columns: ["origem_transicao_matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_origem_transicao_fk"
            columns: ["origem_transicao_matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_origem_transicao_fk"
            columns: ["origem_transicao_matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_origem_transicao_fk"
            columns: ["origem_transicao_matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
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
      matriculas_status_audit: {
        Row: {
          alterado_por: string | null
          created_at: string
          id: number
          matricula_id: string
          motivo: string | null
          origem: string
          status_anterior: string
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string
          id?: number
          matricula_id: string
          motivo?: string | null
          origem: string
          status_anterior: string
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string
          id?: number
          matricula_id?: string
          motivo?: string | null
          origem?: string
          status_anterior?: string
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_status_audit_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_status_audit_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_status_audit_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_status_audit_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_status_audit_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "matriculas_status_audit_matricula_id_fkey"
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
          desconto_aplicado: number | null
          escola_id: string | null
          fiscal_documento_id: string | null
          fiscal_error: string | null
          id: string
          matricula_id: string | null
          mes_referencia: number | null
          metodo_pagamento: string | null
          observacao: string | null
          observacoes: string | null
          status: string | null
          status_fiscal: string | null
          tabela_id: string | null
          turma_id: string | null
          updated_at: string
          updated_by: string | null
          valor: number
          valor_original: number | null
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
          desconto_aplicado?: number | null
          escola_id?: string | null
          fiscal_documento_id?: string | null
          fiscal_error?: string | null
          id?: string
          matricula_id?: string | null
          mes_referencia?: number | null
          metodo_pagamento?: string | null
          observacao?: string | null
          observacoes?: string | null
          status?: string | null
          status_fiscal?: string | null
          tabela_id?: string | null
          turma_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: number
          valor_original?: number | null
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
          desconto_aplicado?: number | null
          escola_id?: string | null
          fiscal_documento_id?: string | null
          fiscal_error?: string | null
          id?: string
          matricula_id?: string | null
          mes_referencia?: number | null
          metodo_pagamento?: string | null
          observacao?: string | null
          observacoes?: string | null
          status?: string | null
          status_fiscal?: string | null
          tabela_id?: string | null
          turma_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_original?: number | null
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
            foreignKeyName: "mensalidades_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
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
          {
            foreignKeyName: "mensalidades_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "financeiro_tabelas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_avaliacao: {
        Row: {
          componentes: Json
          created_at: string
          curso_id: string | null
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
          curso_id?: string | null
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
          curso_id?: string | null
          escola_id?: string
          formula?: Json
          id?: string
          is_default?: boolean | null
          nome?: string
          regras?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_avaliacao_curso_fk"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_avaliacao_curso_fk"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "vw_search_cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          avaliacao_id: string
          created_at: string
          escola_id: string
          id: string
          is_isento: boolean | null
          matricula_id: string
          metadata: Json | null
          updated_at: string
          valor: number
        }
        Insert: {
          avaliacao_id: string
          created_at?: string
          escola_id: string
          id?: string
          is_isento?: boolean | null
          matricula_id: string
          metadata?: Json | null
          updated_at?: string
          valor: number
        }
        Update: {
          avaliacao_id?: string
          created_at?: string
          escola_id?: string
          id?: string
          is_isento?: boolean | null
          matricula_id?: string
          metadata?: Json | null
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
      notificacoes: {
        Row: {
          action_label: string | null
          action_url: string | null
          agrupamento_chave: string | null
          arquivada: boolean
          arquivada_em: string | null
          corpo: string | null
          created_at: string
          destinatario_id: string
          escola_id: string
          evento_id: string
          gatilho: string | null
          id: string
          lida: boolean
          lida_em: string | null
          modal_id: string | null
          prioridade: Database["public"]["Enums"]["notificacao_prioridade"]
          tipo: string | null
          titulo: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          agrupamento_chave?: string | null
          arquivada?: boolean
          arquivada_em?: string | null
          corpo?: string | null
          created_at?: string
          destinatario_id: string
          escola_id: string
          evento_id: string
          gatilho?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          modal_id?: string | null
          prioridade?: Database["public"]["Enums"]["notificacao_prioridade"]
          tipo?: string | null
          titulo: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          agrupamento_chave?: string | null
          arquivada?: boolean
          arquivada_em?: string | null
          corpo?: string | null
          created_at?: string
          destinatario_id?: string
          escola_id?: string
          evento_id?: string
          gatilho?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          modal_id?: string | null
          prioridade?: Database["public"]["Enums"]["notificacao_prioridade"]
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_eventos_secretaria_admin: {
        Row: {
          created_at: string | null
          descricao: string | null
          escola_id: string
          evento_id: string | null
          id: string
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          escola_id: string
          evento_id?: string | null
          id?: string
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          escola_id?: string
          evento_id?: string | null
          id?: string
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_eventos_secretaria_admin_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_eventos_secretaria_admin_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_pagamento_admin: {
        Row: {
          created_at: string | null
          descricao: string | null
          escola_id: string
          id: string
          pagamento_id: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          escola_id: string
          id?: string
          pagamento_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          escola_id?: string
          id?: string
          pagamento_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_pagamento_admin_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_pagamento_admin_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_pagamento_admin_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_pagamento_admin_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "vw_pagamentos_pendentes"
            referencedColumns: ["pagamento_id"]
          },
          {
            foreignKeyName: "notificacoes_pagamento_admin_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "vw_search_pagamentos"
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
      onboarding_requests: {
        Row: {
          ano_letivo: string | null
          classes: Json | null
          created_at: string | null
          director_nome: string | null
          director_tel: string | null
          escola_abrev: string | null
          escola_codigo: string | null
          escola_email: string | null
          escola_id: string | null
          escola_morada: string | null
          escola_municipio: string | null
          escola_nif: string | null
          escola_nome: string
          escola_provincia: string | null
          escola_tel: string | null
          faixa_propina: string | null
          financeiro: Json | null
          id: string
          notas_admin: string | null
          source: string | null
          status: string
          turmas: Json | null
          turnos: Json | null
          updated_at: string | null
          utilizadores: Json | null
        }
        Insert: {
          ano_letivo?: string | null
          classes?: Json | null
          created_at?: string | null
          director_nome?: string | null
          director_tel?: string | null
          escola_abrev?: string | null
          escola_codigo?: string | null
          escola_email?: string | null
          escola_id?: string | null
          escola_morada?: string | null
          escola_municipio?: string | null
          escola_nif?: string | null
          escola_nome: string
          escola_provincia?: string | null
          escola_tel?: string | null
          faixa_propina?: string | null
          financeiro?: Json | null
          id?: string
          notas_admin?: string | null
          source?: string | null
          status?: string
          turmas?: Json | null
          turnos?: Json | null
          updated_at?: string | null
          utilizadores?: Json | null
        }
        Update: {
          ano_letivo?: string | null
          classes?: Json | null
          created_at?: string | null
          director_nome?: string | null
          director_tel?: string | null
          escola_abrev?: string | null
          escola_codigo?: string | null
          escola_email?: string | null
          escola_id?: string | null
          escola_morada?: string | null
          escola_municipio?: string | null
          escola_nif?: string | null
          escola_nome?: string
          escola_provincia?: string | null
          escola_tel?: string | null
          faixa_propina?: string | null
          financeiro?: Json | null
          id?: string
          notas_admin?: string | null
          source?: string | null
          status?: string
          turmas?: Json | null
          turnos?: Json | null
          updated_at?: string | null
          utilizadores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_requests_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_requests_escola_id_fkey"
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
          fiscal_documento_id: string | null
          fiscal_error: string | null
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
          status_fiscal: string | null
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
          fiscal_documento_id?: string | null
          fiscal_error?: string | null
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
          status_fiscal?: string | null
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
          fiscal_documento_id?: string | null
          fiscal_error?: string | null
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
          status_fiscal?: string | null
          telemovel_origem?: string | null
          transacao_id_externo?: string | null
          updated_at?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_fiscal_documento_id_fkey"
            columns: ["fiscal_documento_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documentos"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "vw_pagamentos_pendentes"
            referencedColumns: ["mensalidade_id"]
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
      pagamentos_saas: {
        Row: {
          assinatura_id: string
          comprovativo_url: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string | null
          escola_id: string
          id: string
          metodo: string
          periodo_fim: string
          periodo_inicio: string
          referencia_ext: string | null
          status: string
          valor_kz: number
        }
        Insert: {
          assinatura_id: string
          comprovativo_url?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string | null
          escola_id: string
          id?: string
          metodo: string
          periodo_fim: string
          periodo_inicio: string
          referencia_ext?: string | null
          status: string
          valor_kz: number
        }
        Update: {
          assinatura_id?: string
          comprovativo_url?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string | null
          escola_id?: string
          id?: string
          metodo?: string
          periodo_fim?: string
          periodo_inicio?: string
          referencia_ext?: string | null
          status?: string
          valor_kz?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_saas_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_saas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_saas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas_lote_itens: {
        Row: {
          artifact_expires_at: string | null
          checksum_sha256: string | null
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          pdf_path: string | null
          retry_count: number
          status: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          artifact_expires_at?: string | null
          checksum_sha256?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          pdf_path?: string | null
          retry_count?: number
          status?: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          artifact_expires_at?: string | null
          checksum_sha256?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          pdf_path?: string | null
          retry_count?: number
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
          cancel_requested_at: string | null
          created_at: string
          created_by: string | null
          documento_tipo: string | null
          error_message: string | null
          escola_id: string
          failed_count: number
          id: string
          idempotency_key: string | null
          manifest_path: string | null
          periodo_letivo_id: string | null
          processed: number
          signed_url_expires_at: string | null
          status: string
          success_count: number
          tipo: string
          total_turmas: number
          updated_at: string
          zip_checksum_sha256: string | null
          zip_path: string | null
        }
        Insert: {
          cancel_requested_at?: string | null
          created_at?: string
          created_by?: string | null
          documento_tipo?: string | null
          error_message?: string | null
          escola_id: string
          failed_count?: number
          id?: string
          idempotency_key?: string | null
          manifest_path?: string | null
          periodo_letivo_id?: string | null
          processed?: number
          signed_url_expires_at?: string | null
          status?: string
          success_count?: number
          tipo: string
          total_turmas?: number
          updated_at?: string
          zip_checksum_sha256?: string | null
          zip_path?: string | null
        }
        Update: {
          cancel_requested_at?: string | null
          created_at?: string
          created_by?: string | null
          documento_tipo?: string | null
          error_message?: string | null
          escola_id?: string
          failed_count?: number
          id?: string
          idempotency_key?: string | null
          manifest_path?: string | null
          periodo_letivo_id?: string | null
          processed?: number
          signed_url_expires_at?: string | null
          status?: string
          success_count?: number
          tipo?: string
          total_turmas?: number
          updated_at?: string
          zip_checksum_sha256?: string | null
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
          banco: string | null
          bi_numero: string | null
          bio: string | null
          created_at: string | null
          current_escola_id: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          email_auth: string | null
          email_real: string | null
          encarregado_relacao: string | null
          escola_id: string | null
          especialidades: string[] | null
          global_role: string | null
          grau_academico: string | null
          iban: string | null
          naturalidade: string | null
          nif: string | null
          nome: string
          numero_login: string | null
          numero_processo_login: string | null
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
          banco?: string | null
          bi_numero?: string | null
          bio?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          email_auth?: string | null
          email_real?: string | null
          encarregado_relacao?: string | null
          escola_id?: string | null
          especialidades?: string[] | null
          global_role?: string | null
          grau_academico?: string | null
          iban?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome: string
          numero_login?: string | null
          numero_processo_login?: string | null
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
          banco?: string | null
          bi_numero?: string | null
          bio?: string | null
          created_at?: string | null
          current_escola_id?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          email_auth?: string | null
          email_real?: string | null
          encarregado_relacao?: string | null
          escola_id?: string | null
          especialidades?: string[] | null
          global_role?: string | null
          grau_academico?: string | null
          iban?: string | null
          naturalidade?: string | null
          nif?: string | null
          nome?: string
          numero_login?: string | null
          numero_processo_login?: string | null
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
            foreignKeyName: "fk_quadro_horarios_disciplina_escola"
            columns: ["disciplina_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_professor_escola"
            columns: ["professor_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_professor_escola"
            columns: ["professor_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "vw_search_professores"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_sala_escola"
            columns: ["sala_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_slot_escola"
            columns: ["slot_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "horario_slots"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_turma_escola"
            columns: ["turma_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_turma_escola"
            columns: ["turma_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_versao_escola_turma"
            columns: ["versao_id", "escola_id", "turma_id"]
            isOneToOne: false
            referencedRelation: "horario_versoes"
            referencedColumns: ["id", "escola_id", "turma_id"]
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
          conta_para_media_med: boolean
          created_at: string | null
          custom_name: string | null
          custom_weekly_hours: number | null
          escola_id: string
          id: string
          is_active: boolean | null
          preset_subject_id: string
        }
        Insert: {
          conta_para_media_med?: boolean
          created_at?: string | null
          custom_name?: string | null
          custom_weekly_hours?: number | null
          escola_id: string
          id?: string
          is_active?: boolean | null
          preset_subject_id: string
        }
        Update: {
          conta_para_media_med?: boolean
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
      substituicoes_professores: {
        Row: {
          created_at: string | null
          data: string
          escola_id: string
          id: string
          motivo: string | null
          professor_id: string
          slot_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string | null
          data?: string
          escola_id: string
          id?: string
          motivo?: string | null
          professor_id: string
          slot_id: string
          turma_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          escola_id?: string
          id?: string
          motivo?: string | null
          professor_id?: string
          slot_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substituicoes_professores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_professores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "vw_search_professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_professores_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "horario_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "substituicoes_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_commercial_settings: {
        Row: {
          auto_reminders_enabled: boolean | null
          banco: string | null
          email_comercial: string | null
          iban: string | null
          id: boolean
          kwik_chave: string | null
          lembrete_expirado_template: string
          lembrete_inatividade_template: string
          lembrete_onboarding_template: string
          lembrete_trial_template: string
          link_pagamento: string | null
          numero_conta: string | null
          telefone_comercial: string | null
          titular_conta: string | null
          updated_at: string
          updated_by: string | null
          whatsapp_comercial: string | null
        }
        Insert: {
          auto_reminders_enabled?: boolean | null
          banco?: string | null
          email_comercial?: string | null
          iban?: string | null
          id?: boolean
          kwik_chave?: string | null
          lembrete_expirado_template?: string
          lembrete_inatividade_template?: string
          lembrete_onboarding_template?: string
          lembrete_trial_template?: string
          link_pagamento?: string | null
          numero_conta?: string | null
          telefone_comercial?: string | null
          titular_conta?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_comercial?: string | null
        }
        Update: {
          auto_reminders_enabled?: boolean | null
          banco?: string | null
          email_comercial?: string | null
          iban?: string | null
          id?: boolean
          kwik_chave?: string | null
          lembrete_expirado_template?: string
          lembrete_inatividade_template?: string
          lembrete_onboarding_template?: string
          lembrete_trial_template?: string
          link_pagamento?: string | null
          numero_conta?: string | null
          telefone_comercial?: string | null
          titular_conta?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_comercial?: string | null
        }
        Relationships: []
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
          conta_para_media_med: boolean
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
          conta_para_media_med?: boolean
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
          conta_para_media_med?: boolean
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
      vw_admin_activity_feed_enriched: {
        Row: {
          actor_name: string | null
          aluno_nome: string | null
          amount_kz: number | null
          escola_id: string | null
          event_family: string | null
          event_type: string | null
          headline: string | null
          id: string | null
          occurred_at: string | null
          payload: Json | null
          subline: string | null
          turma_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_events_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_events_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
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
          conta_para_media_med: boolean | null
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
          receita_mes_paga: number | null
          receita_mes_total: number | null
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
      vw_formacao_cohort_economics: {
        Row: {
          avg_horas_conversao: number | null
          cac: number | null
          cohort_id: string | null
          cohort_nome: string | null
          curso_nome: string | null
          custo_honorarios: number | null
          custo_marketing: number | null
          escola_id: string | null
          inscritos_pagos: number | null
          inscritos_total: number | null
          ltv_medio: number | null
          margem_bruta: number | null
          margem_liquida: number | null
          receita_total: number | null
          roi_percentual: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_cohorts_lotacao: {
        Row: {
          cohort_id: string | null
          cohort_nome: string | null
          escola_id: string | null
          inscritos_pagos: number | null
          inscritos_total: number | null
          lotacao_percentual: number | null
          vagas: number | null
        }
        Relationships: []
      }
      vw_formacao_cohorts_overview: {
        Row: {
          carga_horaria_total: number | null
          codigo: string | null
          curso_nome: string | null
          data_fim: string | null
          data_inicio: string | null
          escola_id: string | null
          id: string | null
          nome: string | null
          status: string | null
          total_formadores: number | null
          vagas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_conversion_stats: {
        Row: {
          avg_horas_conversao: number | null
          cohort_id: string | null
          escola_id: string | null
          total_conversoes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_inscricoes_staging_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_staging_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_course_economics: {
        Row: {
          avg_horas_conversao: number | null
          avg_roi_percentual: number | null
          curso_nome: string | null
          custo_honorarios: number | null
          custo_marketing: number | null
          escola_id: string | null
          margem_liquida: number | null
          receita_total: number | null
          total_cohorts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cohorts_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_curso_cockpit_metrics: {
        Row: {
          curso_id: string | null
          escola_id: string | null
          ocupacao_media: number | null
          receita_estimada: number | null
          total_leads: number | null
          total_turmas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_cursos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_cursos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_estudante_progresso: {
        Row: {
          cohort_id: string | null
          elegivel_certificacao: boolean | null
          escola_id: string | null
          formando_user_id: string | null
          inscricao_id: string | null
          modulos_aprovados: number | null
          percentual_presenca: number | null
          total_aulas_realizadas: number | null
          total_modulos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_inscricoes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_inscricoes_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_faturas_formando: {
        Row: {
          desconto: number | null
          descricao: string | null
          emissao_em: string | null
          escola_id: string | null
          fatura_lote_id: string | null
          formando_user_id: string | null
          item_id: string | null
          preco_unitario: number | null
          quantidade: number | null
          referencia: string | null
          status_fatura: string | null
          status_pagamento: string | null
          valor_total: number | null
          vencimento_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_faturas_lote_itens_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_itens_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_faturas_lote_itens_fatura_lote_id_fkey"
            columns: ["fatura_lote_id"]
            isOneToOne: false
            referencedRelation: "formacao_faturas_lote"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_honorarios_formador: {
        Row: {
          bonus: number | null
          cohort_id: string | null
          cohort_nome: string | null
          competencia: string | null
          desconto: number | null
          escola_id: string | null
          formador_user_id: string | null
          horas_ministradas: number | null
          id: string | null
          referencia: string | null
          status: string | null
          valor_bruto: number | null
          valor_hora: number | null
          valor_liquido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_honorarios_lancamentos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_honorarios_lancamentos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_formacao_inadimplencia_resumo: {
        Row: {
          b2b_faturas_em_aberto: number | null
          b2b_valor_em_aberto: number | null
          b2c_titulos_em_aberto: number | null
          b2c_valor_em_aberto: number | null
          escola_id: string | null
          total_em_aberto: number | null
        }
        Relationships: []
      }
      vw_formacao_margem_por_edicao: {
        Row: {
          cohort_id: string | null
          cohort_nome: string | null
          custo_honorarios: number | null
          escola_id: string | null
          margem_bruta: number | null
          receita_total: number | null
        }
        Relationships: []
      }
      vw_formacao_relatorio_honorarios_aulas: {
        Row: {
          cohort_id: string | null
          escola_id: string | null
          formador_user_id: string | null
          mes_referencia: string | null
          total_aulas: number | null
          total_horas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formacao_aulas_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "formacao_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_aulas_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohort_economics"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "formacao_aulas_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "vw_formacao_cohorts_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_aulas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formacao_aulas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
        ]
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
      vw_historico_snapshot_status: {
        Row: {
          allow_reopen: boolean | null
          ano_letivo_id: string | null
          escola_id: string | null
          historico_ano_id: string | null
          lock_reason: string | null
          lock_run_id: string | null
          lock_step: string | null
          locked_at: string | null
          matricula_id: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopened_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          allow_reopen?: boolean | null
          ano_letivo_id?: string | null
          escola_id?: string | null
          historico_ano_id?: string | null
          lock_reason?: string | null
          lock_run_id?: string | null
          lock_step?: string | null
          locked_at?: string | null
          matricula_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reopened_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_reopen?: boolean | null
          ano_letivo_id?: string | null
          escola_id?: string | null
          historico_ano_id?: string | null
          lock_reason?: string | null
          lock_run_id?: string | null
          lock_step?: string | null
          locked_at?: string | null
          matricula_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reopened_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_snapshot_locks_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "anos_letivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_ano_letivo_id_fkey"
            columns: ["ano_letivo_id"]
            isOneToOne: false
            referencedRelation: "vw_escola_ano_letivo_preferido"
            referencedColumns: ["ano_letivo_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_historico_ano_id_fkey"
            columns: ["historico_ano_id"]
            isOneToOne: false
            referencedRelation: "historico_anos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_boletim_por_matricula_legacy"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_secretaria"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_matriculas_validas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_presencas_por_turma"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "historico_snapshot_locks_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "vw_search_matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_klasse_network_aprovacao: {
        Row: {
          ano_letivo: number | null
          aprovacao_media_percentagem: number | null
          classe: string | null
          curso: string | null
          provincia: string | null
          total_alunos_avaliados: number | null
          total_turmas: number | null
        }
        Relationships: []
      }
      vw_klasse_network_matriculas: {
        Row: {
          ano_letivo: number | null
          curso: string | null
          provincia: string | null
          total_escolas: number | null
          total_matriculas: number | null
        }
        Relationships: []
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
      vw_pagamentos_pendentes: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          comprovante_url: string | null
          created_at: string | null
          escola_id: string | null
          mensagem_aluno: string | null
          mensalidade_id: string | null
          metodo: string | null
          pagamento_id: string | null
          reference: string | null
          turma_codigo: string | null
          valor_enviado: number | null
          valor_esperado: number | null
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
        ]
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
      vw_rotinas_compat: {
        Row: {
          curso_oferta_id: string | null
          escola_id: string | null
          fim: string | null
          id: string | null
          inicio: string | null
          professor_user_id: string | null
          sala: string | null
          secao_id: string | null
          turma_id: string | null
          weekday: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quadro_horarios_disciplina_escola"
            columns: ["curso_oferta_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "disciplinas_catalogo"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_turma_escola"
            columns: ["turma_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "fk_quadro_horarios_turma_escola"
            columns: ["turma_id", "escola_id"]
            isOneToOne: false
            referencedRelation: "vw_search_turmas"
            referencedColumns: ["id", "escola_id"]
          },
          {
            foreignKeyName: "professores_profile_id_fkey"
            columns: ["professor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
        ]
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
      vw_search_candidaturas: {
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
      admin_get_storage_usage: {
        Args: { p_bucket_ids?: string[]; p_limit?: number }
        Returns: {
          escola_id: string
          escola_nome: string
          last_30d_bytes: number
          projected_30d_bytes: number
          total_bytes: number
          total_documentos: number
        }[]
      }
      admin_get_system_health: { Args: never; Returns: Json }
      admin_list_profiles: {
        Args: { p_limit?: number; p_roles: string[] }
        Returns: {
          current_escola_id: string
          email: string
          escola_id: string
          nome: string
          numero_processo_login: string
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
      admissao_finalizar_matricula: {
        Args: {
          p_candidatura_id: string
          p_escola_id: string
          p_idempotency_key?: string
          p_observacao?: string
          p_pagamento?: Json
          p_turma_id: string
        }
        Returns: Json
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
      aluno_submeter_comprovativo_pagamento: {
        Args: {
          p_evidence_url: string
          p_mensagem?: string
          p_mensalidade_id: string
          p_meta?: Json
          p_valor_informado?: number
        }
        Returns: Json
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
      assign_professor_turma_disciplina_atomic: {
        Args: {
          p_curso_matriz_id: string
          p_escola_id: string
          p_horarios?: Json
          p_planejamento?: Json
          p_professor_id: string
          p_turma_id: string
        }
        Returns: {
          carga_atual: number
          carga_maxima: number
          disciplina_id: string
          mode: string
          professor_profile_id: string
        }[]
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
      build_numero_login: {
        Args: { p_escola_id: string; p_numero_processo: string }
        Returns: string
      }
      calcular_media_trimestral: {
        Args: { p_notas: Json; p_regras: Json }
        Returns: number
      }
      can_access: { Args: { eid: string }; Returns: boolean }
      can_access_formacao_backoffice: {
        Args: { p_escola_id: string }
        Returns: boolean
      }
      can_access_formacao_cohort_as_formador: {
        Args: { p_cohort_id: string; p_escola_id: string }
        Returns: boolean
      }
      can_access_formacao_fatura_as_formando: {
        Args: { p_escola_id: string; p_formando_user_id: string }
        Returns: boolean
      }
      can_bypass_pauta_lock: {
        Args: {
          p_avaliacao_id: string
          p_escola_id: string
          p_turma_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_manage_school: { Args: { p_escola_id: string }; Returns: boolean }
      can_professor_school: { Args: { p_escola_id: string }; Returns: boolean }
      canonicalize_matricula_status_text: {
        Args: { input: string }
        Returns: string
      }
      check_professor_operational_consistency: {
        Args: { p_escola_id: string; p_limit?: number }
        Returns: {
          check_key: string
          sample: Json
          severity: string
          total: number
        }[]
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
      confirmar_matricula_core: {
        Args: {
          p_aluno_id: string
          p_ano_letivo: number
          p_matricula_id?: string
          p_turma_id?: string
        }
        Returns: number
      }
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
      create_or_update_professor_academico: {
        Args: {
          p_disciplina_ids?: string[]
          p_escola_id: string
          p_profile: Json
          p_teacher: Json
          p_user_id: string
        }
        Returns: Json
      }
      current_escola_id: { Args: never; Returns: string }
      current_tenant_empresa_id: { Args: never; Returns: string }
      current_tenant_escola_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      curriculo_backfill_matriz_from_preset: {
        Args: { p_curso_id: string; p_escola_id: string }
        Returns: number
      }
      curriculo_create_avaliacoes_for_turmas: {
        Args: {
          p_ano_letivo_id: string
          p_classe_id?: string
          p_curso_id: string
          p_escola_id: string
        }
        Returns: number
      }
      curriculo_install_orchestrated: {
        Args: {
          p_advanced_config?: Json
          p_ano_letivo_id: string
          p_auto_publish?: boolean
          p_custom_data?: Json
          p_escola_id: string
          p_generate_turmas?: boolean
          p_idempotency_key?: string
          p_preset_key: string
        }
        Returns: Json
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
      curriculum_preset_subjects_delete: {
        Args: { p_subject_id: string }
        Returns: boolean
      }
      curriculum_preset_subjects_upsert: {
        Args: {
          p_component: Database["public"]["Enums"]["discipline_component"]
          p_grade_level: string
          p_name: string
          p_preset_id: string
          p_subject_id: string
          p_subject_type?: string
          p_weekly_hours: number
        }
        Returns: {
          component: Database["public"]["Enums"]["discipline_component"]
          grade_level: string
          id: string
          name: string
          preset_id: string
          subject_type: string
          weekly_hours: number
        }[]
      }
      curriculum_presets_delete: { Args: { p_id: string }; Returns: boolean }
      curriculum_presets_upsert:
        | {
            Args: {
              p_category: Database["public"]["Enums"]["course_category"]
              p_description?: string
              p_id: string
              p_name: string
            }
            Returns: {
              category: Database["public"]["Enums"]["course_category"]
              description: string
              id: string
              name: string
            }[]
          }
        | {
            Args: {
              p_badge?: string
              p_category: Database["public"]["Enums"]["course_category"]
              p_class_max?: number
              p_class_min?: number
              p_course_code?: string
              p_description?: string
              p_id: string
              p_name: string
              p_recommended?: boolean
            }
            Returns: {
              category: Database["public"]["Enums"]["course_category"]
              description: string
              id: string
              name: string
            }[]
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
      ensure_horario_versao: {
        Args: {
          p_escola_id: string
          p_status?: string
          p_turma_id: string
          p_versao_id?: string
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
      finalizar_matricula_blindada: {
        Args: {
          p_escola_id: string
          p_is_override_manual?: boolean
          p_matricula_id: string
          p_motivo?: string
          p_status_override?: string
        }
        Returns: Json
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
          fiscal_documento_id: string | null
          fiscal_error: string | null
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
          status_fiscal: string | null
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
          fiscal_documento_id: string | null
          fiscal_error: string | null
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
          status_fiscal: string | null
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
      fiscal_anular_documento: {
        Args: { p_documento_id: string; p_metadata?: Json; p_motivo: string }
        Returns: Json
      }
      fiscal_emitir_documento:
        | {
            Args: {
              p_cliente: Json
              p_documento_origem_id: string
              p_empresa_id: string
              p_invoice_date: string
              p_itens: Json
              p_metadata: Json
              p_moeda: string
              p_origem_documento: string
              p_prefixo_serie: string
              p_rectifica_documento_id: string
              p_serie_id: string
              p_taxa_cambio_aoa: number
              p_tipo_documento: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assinatura_base64: string
              p_cliente: Json
              p_documento_origem_id: string
              p_empresa_id: string
              p_invoice_date: string
              p_itens: Json
              p_metadata: Json
              p_moeda: string
              p_origem_documento: string
              p_prefixo_serie: string
              p_rectifica_documento_id: string
              p_serie_id: string
              p_taxa_cambio_aoa: number
              p_tipo_documento: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assinatura_base64?: string
              p_cliente: Json
              p_documento_origem_id?: string
              p_empresa_id: string
              p_invoice_date: string
              p_itens: Json
              p_metadata?: Json
              p_moeda: string
              p_origem_documento: string
              p_prefixo_serie: string
              p_rectifica_documento_id?: string
              p_serie_id: string
              p_taxa_cambio_aoa?: number
              p_tipo_documento: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assinatura_base64?: string
              p_cliente: Json
              p_documento_origem_id?: string
              p_empresa_id: string
              p_invoice_date: string
              p_itens: Json
              p_metadata?: Json
              p_moeda: string
              p_origem_documento: string
              p_payment_mechanism?: string
              p_prefixo_serie: string
              p_rectifica_documento_id?: string
              p_serie_id: string
              p_taxa_cambio_aoa?: number
              p_tipo_documento: string
            }
            Returns: Json
          }
      fiscal_empresa_has_members: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      fiscal_finalizar_assinatura: {
        Args: {
          p_assinatura_base64: string
          p_canonical_string: string
          p_documento_id: string
          p_hash_control: string
        }
        Returns: Json
      }
      fiscal_rectificar_documento: {
        Args: { p_documento_id: string; p_metadata?: Json; p_motivo: string }
        Returns: Json
      }
      fiscal_reservar_numero_serie: {
        Args: { p_serie_id: string }
        Returns: {
          numero: number
          numero_formatado: string
        }[]
      }
      fn_transitar_alunos: {
        Args: {
          p_aluno_ids: string[]
          p_ano_letivo_dest: number
          p_ano_letivo_origem: number
          p_escola_id: string
          p_turma_destino_id: string
          p_turma_origem_id: string
        }
        Returns: {
          aluno_id: string
          erro: string
          sucesso: boolean
        }[]
      }
      formacao_create_inscricao: {
        Args: {
          p_bi_snapshot?: string
          p_cohort_id: string
          p_created_by?: string
          p_email_snapshot?: string
          p_escola_id: string
          p_formando_user_id: string
          p_modalidade?: string
          p_nome_snapshot?: string
          p_origem?: string
          p_telefone_snapshot?: string
          p_valor_cobrado?: number
        }
        Returns: {
          bi_snapshot: string | null
          cancelled_at: string | null
          cohort_id: string
          created_at: string
          created_by: string | null
          email_snapshot: string | null
          escola_id: string
          estado: string
          formando_user_id: string
          id: string
          metadata: Json
          modalidade: string
          nome_snapshot: string | null
          origem: string
          status_pagamento: string
          telefone_snapshot: string | null
          updated_at: string
          valor_cobrado: number
        }
        SetofOptions: {
          from: "*"
          to: "formacao_inscricoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      formacao_emitir_certificados_batch: {
        Args: { p_cohort_id: string; p_escola_id: string; p_user_ids: string[] }
        Returns: {
          count: number
        }[]
      }
      formacao_extend_trial: {
        Args: { p_days?: number; p_escola_id: string }
        Returns: Json
      }
      formacao_formadores_por_centro: {
        Args: { p_escola_id: string }
        Returns: {
          banco: string
          bi_numero: string
          bio: string
          email: string
          especialidades: string[]
          grau_academico: string
          iban: string
          nif: string
          nome: string
          sexo: string
          telefone: string
          user_id: string
        }[]
      }
      formacao_get_subscription_info: {
        Args: { p_escola_id: string }
        Returns: Json
      }
      formacao_self_service_create_inscricao: {
        Args: {
          p_bi_numero?: string
          p_cohort_ref: string
          p_email?: string
          p_escola_slug: string
          p_formando_user_id: string
          p_nome: string
          p_telefone?: string
        }
        Returns: {
          bi_snapshot: string | null
          cancelled_at: string | null
          cohort_id: string
          created_at: string
          created_by: string | null
          email_snapshot: string | null
          escola_id: string
          estado: string
          formando_user_id: string
          id: string
          metadata: Json
          modalidade: string
          nome_snapshot: string | null
          origem: string
          status_pagamento: string
          telefone_snapshot: string | null
          updated_at: string
          valor_cobrado: number
        }
        SetofOptions: {
          from: "*"
          to: "formacao_inscricoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      formacao_self_service_precheck: {
        Args: {
          p_bi_numero: string
          p_cohort_ref: string
          p_escola_slug: string
        }
        Returns: {
          cohort_id: string
          cohort_nome: string
          curso_nome: string
          escola_id: string
          escola_nome: string
          existing_email: string
          existing_user_id: string
        }[]
      }
      formacao_self_service_resolve_target: {
        Args: { p_cohort_ref: string; p_escola_slug: string }
        Returns: {
          cohort_codigo: string
          cohort_id: string
          cohort_nome: string
          curso_nome: string
          data_fim: string
          data_inicio: string
          escola_id: string
          escola_nome: string
          escola_slug: string
          status: string
          vagas: number
          vagas_ocupadas: number
        }[]
      }
      formacao_update_dados_pagamento: {
        Args: { p_dados: Json; p_escola_id: string }
        Returns: Json
      }
      formacao_update_landing_config: {
        Args: { p_config: Json; p_escola_id: string }
        Returns: Json
      }
      formacao_upsert_formando_profile: {
        Args: {
          p_bi_numero?: string
          p_email?: string
          p_escola_id: string
          p_nome: string
          p_telefone?: string
          p_user_id: string
        }
        Returns: {
          avatar_url: string | null
          banco: string | null
          bi_numero: string | null
          bio: string | null
          created_at: string | null
          current_escola_id: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          email_auth: string | null
          email_real: string | null
          encarregado_relacao: string | null
          escola_id: string | null
          especialidades: string[] | null
          global_role: string | null
          grau_academico: string | null
          iban: string | null
          naturalidade: string | null
          nif: string | null
          nome: string
          numero_login: string | null
          numero_processo_login: string | null
          onboarding_finalizado: boolean | null
          provincia: string | null
          role: Database["public"]["Enums"]["user_role"]
          sexo: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
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
      generate_escola_slug: {
        Args: { p_id?: string; p_nome: string }
        Returns: string
      }
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
      get_aluno_timeline_360: {
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
      get_curso_professor_responsavel_map: {
        Args: { p_curso_ids: string[]; p_escola_id: string }
        Returns: {
          curso_id: string
          professor_id: string
        }[]
      }
      get_escola_sigla: { Args: { p_escola_id: string }; Returns: string }
      get_estado_academico: {
        Args: {
          p_curriculo_id?: string
          p_curso_id?: string
          p_escola_id: string
          p_turma_id?: string
        }
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
      get_professor_atribuicoes: {
        Args: never
        Returns: {
          curso_matriz_id: string
          disciplina_id: string
          disciplina_nome: string
          turma_disciplina_id: string
          turma_id: string
          turma_nome: string
          turma_status_fecho: string
        }[]
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
      get_public_landing_data: { Args: { p_slug: string }; Returns: Json }
      get_public_slug_for_current_tenant: {
        Args: { p_escola_id?: string }
        Returns: string
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
      get_turma_occupancy_history: {
        Args: { p_turma_id: string }
        Returns: {
          mes_referencia: string
          total_alunos: number
        }[]
      }
      get_turmas_pedagogico_stats: {
        Args: { p_escola_id: string }
        Returns: {
          alunos_abaixo_notas: number
          alunos_abaixo_presenca: number
          candidatos_espera: number
          decomposicao_saude: Json
          is_desescoberta: boolean
          media_notas: number
          media_presenca: number
          turma_id: string
        }[]
      }
      get_user_escola_id:
        | { Args: never; Returns: string }
        | { Args: { p_user_id: string }; Returns: string }
      get_user_export_json: { Args: { p_user_id: string }; Returns: Json }
      get_user_tenant: { Args: never; Returns: string }
      get_users_by_role: {
        Args: {
          p_escola_id: string
          p_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: {
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      gradeengine_calcular_situacao: {
        Args: { p_matricula_id: string }
        Returns: Json
      }
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
      historico_set_snapshot_state: {
        Args: {
          p_ano_letivo_id: string
          p_escola_id: string
          p_matricula_ids: string[]
          p_motivo: string
          p_novo_estado: string
          p_run_id?: string
        }
        Returns: Json
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
      inserir_notificacao: {
        Args: {
          p_action_label?: string
          p_action_url?: string
          p_corpo?: string
          p_destinatario_id: string
          p_escola_id: string
          p_evento_id: string
          p_prioridade?: Database["public"]["Enums"]["notificacao_prioridade"]
          p_titulo: string
        }
        Returns: undefined
      }
      is_admin_escola: { Args: never; Returns: boolean }
      is_escola_admin: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_diretor: { Args: { p_escola_id: string }; Returns: boolean }
      is_escola_member: { Args: { p_escola_id: string }; Returns: boolean }
      is_global_admin: { Args: never; Returns: boolean }
      is_internal_service_role: { Args: never; Returns: boolean }
      is_membro_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_staff_escola: { Args: { escola_uuid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_super_or_global_admin: { Args: never; Returns: boolean }
      lancar_notas_batch: {
        Args: {
          p_disciplina_id: string
          p_escola_id: string
          p_is_isento?: boolean
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
      list_centro_formacao_team: {
        Args: { p_escola_id: string }
        Returns: {
          created_at: string
          email: string
          nome: string
          papel: string
          role: string
          telefone: string
          user_id: string
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
      log_horario_event: {
        Args: {
          p_escola_id: string
          p_payload?: Json
          p_tipo: string
          p_turma_id: string
          p_versao_id: string
        }
        Returns: undefined
      }
      map_admin_activity_family: { Args: { p_action: string }; Returns: string }
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
      nota_para_extenso_ptao: { Args: { p_nota: number }; Returns: string }
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
      provisionar_escola_from_onboarding: {
        Args: { p_escola_id: string; p_request_id: string }
        Returns: Json
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
      publish_horario_versao: {
        Args: { p_escola_id: string; p_turma_id: string; p_versao_id: string }
        Returns: string
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
      refresh_mv_formacao_cohorts_lotacao: { Args: never; Returns: undefined }
      refresh_mv_formacao_inadimplencia_resumo: {
        Args: never
        Returns: undefined
      }
      refresh_mv_formacao_margem_por_edicao: { Args: never; Returns: undefined }
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
          inserted: Json
          skipped: Json
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
      safe_auth_uid: { Args: never; Returns: string }
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
          numero_processo: string
          numero_processo_login: string
          origem: string
          responsavel: string
          status: string
          telefone_responsavel: string
        }[]
      }
      set_curso_professor_responsavel: {
        Args: {
          p_actor_id?: string
          p_curso_id: string
          p_escola_id: string
          p_professor_id: string
        }
        Returns: {
          curso_id: string
          professor_id: string
          professor_profile_id: string
          updated_at: string
        }[]
      }
      setup_active_ano_letivo: {
        Args: { p_ano_data: Json; p_escola_id: string }
        Returns: Json
      }
      slugify: { Args: { v_text: string }; Returns: string }
      slugify_escola_nome: { Args: { input: string }; Returns: string }
      soft_delete_aluno: {
        Args: { p_deleted_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      sum_component_pesos: { Args: { p_componentes: Json }; Returns: number }
      sync_escola_plano_from_assinatura: {
        Args: { p_escola_id: string }
        Returns: undefined
      }
      sync_formacao_fiscal_memberships_for_escola: {
        Args: { p_escola_id: string }
        Returns: undefined
      }
      tenant_profiles_by_ids: {
        Args: { p_user_ids: string[] }
        Returns: {
          created_at: string
          current_escola_id: string
          email: string
          escola_id: string
          last_login: string
          nome: string
          numero_processo_login: string
          role: string
          telefone: string
          user_id: string
        }[]
      }
      transferir_aluno_turma: {
        Args: {
          p_matricula_origem_id: string
          p_motivo?: string
          p_turma_destino_id: string
        }
        Returns: string
      }
      transferir_matricula: {
        Args: {
          p_escola_id: string
          p_matricula_id: string
          p_target_turma_id: string
        }
        Returns: Json
      }
      trg_evento_curriculo_published_fn: {
        Args: { ev: Database["public"]["Tables"]["eventos"]["Row"] }
        Returns: undefined
      }
      trg_evento_notas_lancadas_fn: {
        Args: { ev: Database["public"]["Tables"]["eventos"]["Row"] }
        Returns: undefined
      }
      trg_evento_pagamento_confirmado_fn: {
        Args: { ev: Database["public"]["Tables"]["eventos"]["Row"] }
        Returns: undefined
      }
      trg_evento_turmas_generated_fn: {
        Args: { ev: Database["public"]["Tables"]["eventos"]["Row"] }
        Returns: undefined
      }
      try_start_pautas_lote_job: {
        Args: { p_escola_id: string; p_job_id: string }
        Returns: boolean
      }
      turma_set_status_fecho: {
        Args: {
          p_escola_id: string
          p_reason?: string
          p_status: string
          p_turma_id: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_escola_slug: {
        Args: { p_escola_id: string; p_slug: string }
        Returns: undefined
      }
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
      upsert_quadro_horarios_versao_atomic: {
        Args: {
          p_escola_id: string
          p_items: Json
          p_publish?: boolean
          p_turma_id: string
          p_versao_id: string
        }
        Returns: Json
      }
      user_has_role_in_empresa: {
        Args: { p_empresa_id: string; p_roles: string[] }
        Returns: boolean
      }
      user_has_role_in_school: {
        Args: { p_escola_id: string; p_roles: string[] }
        Returns: boolean
      }
      validar_pagamento: {
        Args: {
          p_aprovado: boolean
          p_mensagem_secretaria?: string
          p_pagamento_id: string
        }
        Returns: Json
      }
      validate_curriculum_presets: {
        Args: { p_escola_id?: string }
        Returns: {
          carga_horaria_sugerida: number
          curso_id: string
          disciplina_nome: string
          escola_id: string
          grade_level: string
          ocorrencias: number
          preset_id: string
        }[]
      }
      validate_presets_global: {
        Args: never
        Returns: {
          disciplina_nome: string
          grade_level: string
          preset_id: string
          status: string
        }[]
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
      evento_tipo:
        | "curriculo.published"
        | "turmas.generated"
        | "notas.lancadas"
        | "pagamento.confirmado"
        | "matricula.concluida"
        | "aluno.arquivado"
        | "documento.emitido"
        | "sistema.manutencao"
        | "sistema.funcionalidade"
        | "plano.limite_80"
        | "plano.limite_100"
        | "subscricao.expira"
        | "subscricao.expirada"
        | "turma.aprovada"
        | "turma.rejeitada"
        | "propina.definida"
        | "desconto.aprovado"
        | "importacao.alunos.concluida"
        | "catalogo.precos.ativado"
        | "financeiro.fecho.autorizado"
        | "ano_letivo.ativado"
        | "turma.atribuida"
        | "notas.prazo_3d"
        | "notas.prazo_expirado"
        | "matricula.aluno_matriculado"
        | "matricula.aluno_transferido"
        | "matricula.aluno_cancelado"
        | "matricula.aluno_reintegrado"
        | "matricula.confirmada"
        | "matricula.renovacao_disponivel"
        | "propina.atraso"
        | "propina.vence_3d"
        | "nota.lancada"
        | "avaliacao.marcada"
        | "frequencia.falta_registada"
        | "frequencia.faltas_limite"
        | "nota.abaixo_media"
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
      notificacao_prioridade: "info" | "aviso" | "urgente"
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
        | "comprovante_matricula"
        | "boletim_trimestral"
        | "ficha_inscricao"
      user_role:
        | "super_admin"
        | "global_admin"
        | "admin"
        | "professor"
        | "aluno"
        | "secretaria"
        | "financeiro"
        | "encarregado"
        | "secretaria_financeiro"
        | "admin_financeiro"
        | "admin_escola"
        | "staff_admin"
        | "formacao_admin"
        | "formacao_secretaria"
        | "formacao_financeiro"
        | "formador"
        | "formando"
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
      evento_tipo: [
        "curriculo.published",
        "turmas.generated",
        "notas.lancadas",
        "pagamento.confirmado",
        "matricula.concluida",
        "aluno.arquivado",
        "documento.emitido",
        "sistema.manutencao",
        "sistema.funcionalidade",
        "plano.limite_80",
        "plano.limite_100",
        "subscricao.expira",
        "subscricao.expirada",
        "turma.aprovada",
        "turma.rejeitada",
        "propina.definida",
        "desconto.aprovado",
        "importacao.alunos.concluida",
        "catalogo.precos.ativado",
        "financeiro.fecho.autorizado",
        "ano_letivo.ativado",
        "turma.atribuida",
        "notas.prazo_3d",
        "notas.prazo_expirado",
        "matricula.aluno_matriculado",
        "matricula.aluno_transferido",
        "matricula.aluno_cancelado",
        "matricula.aluno_reintegrado",
        "matricula.confirmada",
        "matricula.renovacao_disponivel",
        "propina.atraso",
        "propina.vence_3d",
        "nota.lancada",
        "avaliacao.marcada",
        "frequencia.falta_registada",
        "frequencia.faltas_limite",
        "nota.abaixo_media",
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
      notificacao_prioridade: ["info", "aviso", "urgente"],
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
        "comprovante_matricula",
        "boletim_trimestral",
        "ficha_inscricao",
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
        "secretaria_financeiro",
        "admin_financeiro",
        "admin_escola",
        "staff_admin",
        "formacao_admin",
        "formacao_secretaria",
        "formacao_financeiro",
        "formador",
        "formando",
      ],
    },
  },
} as const
