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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          acao: string
          antes: Json | null
          contexto: Json | null
          criado_em: string
          depois: Json | null
          id: string
          registro_id: string | null
          tabela: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          contexto?: Json | null
          criado_em?: string
          depois?: Json | null
          id?: string
          registro_id?: string | null
          tabela?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          contexto?: Json | null
          criado_em?: string
          depois?: Json | null
          id?: string
          registro_id?: string | null
          tabela?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      candidatos: {
        Row: {
          arquivado_em: string | null
          arquivado_por: string | null
          comprovante_path: string | null
          cpf: string
          cpf_path: string | null
          created_at: string
          creci: string | null
          creci_path: string | null
          drive_folder_id: string | null
          email: string | null
          id: string
          lead_id: string | null
          nome: string
          regiao: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id: string | null
          rg_path: string | null
          status: Database["public"]["Enums"]["candidato_status"]
          telefone: string
          updated_at: string
        }
        Insert: {
          arquivado_em?: string | null
          arquivado_por?: string | null
          comprovante_path?: string | null
          cpf: string
          cpf_path?: string | null
          created_at?: string
          creci?: string | null
          creci_path?: string | null
          drive_folder_id?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          nome: string
          regiao: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id?: string | null
          rg_path?: string | null
          status?: Database["public"]["Enums"]["candidato_status"]
          telefone: string
          updated_at?: string
        }
        Update: {
          arquivado_em?: string | null
          arquivado_por?: string | null
          comprovante_path?: string | null
          cpf?: string
          cpf_path?: string | null
          created_at?: string
          creci?: string | null
          creci_path?: string | null
          drive_folder_id?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          nome?: string
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id?: string | null
          rg_path?: string | null
          status?: Database["public"]["Enums"]["candidato_status"]
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      chaves_log: {
        Row: {
          corretor_id: string
          criado_em: string
          foto_url: string
          id: string
          imovel_id: string
          observacao: string | null
          tipo: string
        }
        Insert: {
          corretor_id: string
          criado_em?: string
          foto_url: string
          id?: string
          imovel_id: string
          observacao?: string | null
          tipo: string
        }
        Update: {
          corretor_id?: string
          criado_em?: string
          foto_url?: string
          id?: string
          imovel_id?: string
          observacao?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaves_log_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaves_log_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaves_log_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis_portfolio"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          canal: string
          contrato_id: string
          created_at: string
          id: string
          mensagem: string | null
          pagamento_id: string | null
          realizada_por: string | null
        }
        Insert: {
          canal?: string
          contrato_id: string
          created_at?: string
          id?: string
          mensagem?: string | null
          pagamento_id?: string | null
          realizada_por?: string | null
        }
        Update: {
          canal?: string
          contrato_id?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          pagamento_id?: string | null
          realizada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      conquistas: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string
          icone: string
          id: string
          meta_valor: number
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao: string
          icone: string
          id: string
          meta_valor?: number
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          meta_valor?: number
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      contratos: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          dia_vencimento: number | null
          drive_folder_id: string | null
          duracao_meses: number
          endereco_anterior: string | null
          id: string
          imovel_id: string
          indice_reajuste: string | null
          locatario_cpf: string | null
          locatario_email: string | null
          locatario_nome: string
          locatario_rg: string | null
          locatario_telefone: string | null
          observacoes: string | null
          status: string
          updated_at: string
          valor_aluguel: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          dia_vencimento?: number | null
          drive_folder_id?: string | null
          duracao_meses?: number
          endereco_anterior?: string | null
          id?: string
          imovel_id: string
          indice_reajuste?: string | null
          locatario_cpf?: string | null
          locatario_email?: string | null
          locatario_nome: string
          locatario_rg?: string | null
          locatario_telefone?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_aluguel?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          dia_vencimento?: number | null
          drive_folder_id?: string | null
          duracao_meses?: number
          endereco_anterior?: string | null
          id?: string
          imovel_id?: string
          indice_reajuste?: string | null
          locatario_cpf?: string | null
          locatario_email?: string | null
          locatario_nome?: string
          locatario_rg?: string | null
          locatario_telefone?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_aluguel?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis_portfolio"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_disponibilidade: {
        Row: {
          corretor_id: string
          created_at: string
          data: string | null
          dia_semana: number | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacao: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          corretor_id: string
          created_at?: string
          data?: string | null
          dia_semana?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          created_at?: string
          data?: string | null
          dia_semana?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          contrato_id: string | null
          created_at: string
          drive_file_id: string
          drive_web_content_link: string | null
          drive_web_view_link: string | null
          id: string
          imovel_id: string | null
          mime_type: string | null
          nome: string
          tamanho_bytes: number | null
          tipo: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          drive_file_id: string
          drive_web_content_link?: string | null
          drive_web_view_link?: string | null
          id?: string
          imovel_id?: string | null
          mime_type?: string | null
          nome: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          drive_file_id?: string
          drive_web_content_link?: string | null
          drive_web_view_link?: string | null
          id?: string
          imovel_id?: string | null
          mime_type?: string | null
          nome?: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis_portfolio"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          image_path: string | null
          media_type: string
          source: string
          source_ref: string | null
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          image_path?: string | null
          media_type?: string
          source?: string
          source_ref?: string | null
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          image_path?: string | null
          media_type?: string
          source?: string
          source_ref?: string | null
        }
        Relationships: []
      }
      feed_stories: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          duration_ms: number | null
          expires_at: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          image_path: string
          media_type: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          duration_ms?: number | null
          expires_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          image_path: string
          media_type?: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          duration_ms?: number | null
          expires_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          image_path?: string
          media_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_stories_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "feed_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamentos: {
        Row: {
          comp_renda_path: string | null
          comp_residencia_path: string | null
          cpf: string
          cpf_path: string | null
          created_at: string
          criado_por: string | null
          email: string | null
          estado_civil: string | null
          extrato_path: string | null
          id: string
          imovel_endereco: string | null
          imovel_valor: number | null
          lead_id: string | null
          nome: string
          observacao: string | null
          profissao: string | null
          renda_mensal: number | null
          rg_path: string | null
          status: Database["public"]["Enums"]["financiamento_status"]
          telefone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comp_renda_path?: string | null
          comp_residencia_path?: string | null
          cpf: string
          cpf_path?: string | null
          created_at?: string
          criado_por?: string | null
          email?: string | null
          estado_civil?: string | null
          extrato_path?: string | null
          id?: string
          imovel_endereco?: string | null
          imovel_valor?: number | null
          lead_id?: string | null
          nome: string
          observacao?: string | null
          profissao?: string | null
          renda_mensal?: number | null
          rg_path?: string | null
          status?: Database["public"]["Enums"]["financiamento_status"]
          telefone: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comp_renda_path?: string | null
          comp_residencia_path?: string | null
          cpf?: string
          cpf_path?: string | null
          created_at?: string
          criado_por?: string | null
          email?: string | null
          estado_civil?: string | null
          extrato_path?: string | null
          id?: string
          imovel_endereco?: string | null
          imovel_valor?: number | null
          lead_id?: string | null
          nome?: string
          observacao?: string | null
          profissao?: string | null
          renda_mensal?: number | null
          rg_path?: string | null
          status?: Database["public"]["Enums"]["financiamento_status"]
          telefone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financiamentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vendas_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imoveis: {
        Row: {
          area_m2: number | null
          bairro: string | null
          banheiros: number | null
          captador_id: string | null
          cep: string | null
          chave_atraso_notificado_em: string | null
          chave_com_id: string | null
          chave_foto_atual: string | null
          chave_retirada_em: string | null
          cidade: string | null
          codigo: string | null
          complemento: string | null
          condominio: number | null
          corretor_fechamento_id: string | null
          created_at: string
          created_by: string | null
          data_locacao: string | null
          data_venda: string | null
          dia_vencimento: number | null
          drive_folder_id: string | null
          executivo_fechamento_id: string | null
          fechado_em: string | null
          fechado_por: string | null
          finalidade: string
          fotos: string[] | null
          garantia: string | null
          gestao_patrimonio: boolean
          id: string
          iptu: number | null
          latitude: number | null
          lead_fechamento_id: string | null
          locatario_documento: string | null
          locatario_email: string | null
          locatario_nome: string | null
          locatario_telefone: string | null
          longitude: number | null
          numero: string | null
          observacoes: string | null
          proprietario_documento: string | null
          proprietario_email: string | null
          proprietario_nome: string
          proprietario_telefone: string | null
          quartos: number | null
          rua: string
          status: string
          tipo: string
          updated_at: string
          vagas: number | null
          valor_aluguel: number | null
          valor_venda: number | null
          vitrine_url: string | null
        }
        Insert: {
          area_m2?: number | null
          bairro?: string | null
          banheiros?: number | null
          captador_id?: string | null
          cep?: string | null
          chave_atraso_notificado_em?: string | null
          chave_com_id?: string | null
          chave_foto_atual?: string | null
          chave_retirada_em?: string | null
          cidade?: string | null
          codigo?: string | null
          complemento?: string | null
          condominio?: number | null
          corretor_fechamento_id?: string | null
          created_at?: string
          created_by?: string | null
          data_locacao?: string | null
          data_venda?: string | null
          dia_vencimento?: number | null
          drive_folder_id?: string | null
          executivo_fechamento_id?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          finalidade?: string
          fotos?: string[] | null
          garantia?: string | null
          gestao_patrimonio?: boolean
          id?: string
          iptu?: number | null
          latitude?: number | null
          lead_fechamento_id?: string | null
          locatario_documento?: string | null
          locatario_email?: string | null
          locatario_nome?: string | null
          locatario_telefone?: string | null
          longitude?: number | null
          numero?: string | null
          observacoes?: string | null
          proprietario_documento?: string | null
          proprietario_email?: string | null
          proprietario_nome: string
          proprietario_telefone?: string | null
          quartos?: number | null
          rua: string
          status?: string
          tipo: string
          updated_at?: string
          vagas?: number | null
          valor_aluguel?: number | null
          valor_venda?: number | null
          vitrine_url?: string | null
        }
        Update: {
          area_m2?: number | null
          bairro?: string | null
          banheiros?: number | null
          captador_id?: string | null
          cep?: string | null
          chave_atraso_notificado_em?: string | null
          chave_com_id?: string | null
          chave_foto_atual?: string | null
          chave_retirada_em?: string | null
          cidade?: string | null
          codigo?: string | null
          complemento?: string | null
          condominio?: number | null
          corretor_fechamento_id?: string | null
          created_at?: string
          created_by?: string | null
          data_locacao?: string | null
          data_venda?: string | null
          dia_vencimento?: number | null
          drive_folder_id?: string | null
          executivo_fechamento_id?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          finalidade?: string
          fotos?: string[] | null
          garantia?: string | null
          gestao_patrimonio?: boolean
          id?: string
          iptu?: number | null
          latitude?: number | null
          lead_fechamento_id?: string | null
          locatario_documento?: string | null
          locatario_email?: string | null
          locatario_nome?: string | null
          locatario_telefone?: string | null
          longitude?: number | null
          numero?: string | null
          observacoes?: string | null
          proprietario_documento?: string | null
          proprietario_email?: string | null
          proprietario_nome?: string
          proprietario_telefone?: string | null
          quartos?: number | null
          rua?: string
          status?: string
          tipo?: string
          updated_at?: string
          vagas?: number | null
          valor_aluguel?: number | null
          valor_venda?: number | null
          vitrine_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_captador_id_fkey"
            columns: ["captador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_chave_com_id_fkey"
            columns: ["chave_com_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_corretor_fechamento_id_fkey"
            columns: ["corretor_fechamento_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_executivo_fechamento_id_fkey"
            columns: ["executivo_fechamento_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_lead_fechamento_id_fkey"
            columns: ["lead_fechamento_id"]
            isOneToOne: false
            referencedRelation: "vendas_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_historico: {
        Row: {
          acao: string
          created_at: string
          detalhe: Json | null
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhe?: Json | null
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhe?: Json | null
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at: string
          creci: string | null
          dados_corretor: Json | null
          descredenciado_em: string | null
          descredenciado_por: string | null
          email: string | null
          etapa: Database["public"]["Enums"]["lead_etapa"]
          faixa_valor: string | null
          fechado_em: string | null
          first_response_at: string | null
          followup_alerta_em: string | null
          id: string
          is_corretor: boolean
          motivo_descredenciamento: string | null
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          reativacao_sugerida_em: string | null
          regiao: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id: string | null
          telefone: string
          tipo_imovel: string | null
          updated_at: string
        }
        Insert: {
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          creci?: string | null
          dados_corretor?: Json | null
          descredenciado_em?: string | null
          descredenciado_por?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["lead_etapa"]
          faixa_valor?: string | null
          fechado_em?: string | null
          first_response_at?: string | null
          followup_alerta_em?: string | null
          id?: string
          is_corretor?: boolean
          motivo_descredenciamento?: string | null
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          reativacao_sugerida_em?: string | null
          regiao: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id?: string | null
          telefone: string
          tipo_imovel?: string | null
          updated_at?: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          creci?: string | null
          dados_corretor?: Json | null
          descredenciado_em?: string | null
          descredenciado_por?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["lead_etapa"]
          faixa_valor?: string | null
          fechado_em?: string | null
          first_response_at?: string | null
          followup_alerta_em?: string | null
          id?: string
          is_corretor?: boolean
          motivo_descredenciamento?: string | null
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          reativacao_sugerida_em?: string | null
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id?: string | null
          telefone?: string
          tipo_imovel?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagem_templates: {
        Row: {
          conteudo: string
          created_at: string
          escopo: string
          id: string
          owner_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          escopo?: string
          id?: string
          owner_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          escopo?: string
          id?: string
          owner_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_form_mapping: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at: string
          form_id: string
          id: string
          nome: string
          regiao: Database["public"]["Enums"]["lead_regiao"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          form_id: string
          id?: string
          nome: string
          regiao: Database["public"]["Enums"]["lead_regiao"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          form_id?: string
          id?: string
          nome?: string
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          updated_at?: string
        }
        Relationships: []
      }
      metas_mensais: {
        Row: {
          ano: number
          corretor_id: string
          created_at: string
          criado_por: string | null
          id: string
          mes: number
          meta_leads_atendidos: number
          meta_locacoes: number
          meta_receita: number
          meta_vendas: number
          updated_at: string
        }
        Insert: {
          ano: number
          corretor_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mes: number
          meta_leads_atendidos?: number
          meta_locacoes?: number
          meta_receita?: number
          meta_vendas?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          corretor_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mes?: number
          meta_leads_atendidos?: number
          meta_locacoes?: number
          meta_receita?: number
          meta_vendas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_mensais_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_mensais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          destino: string
          id: string
          lead_id: string | null
          payload: Json | null
          resposta: Json | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          destino: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          resposta?: Json | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          destino?: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          resposta?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          contrato_id: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          id: string
          juros: number | null
          mes_referencia: string
          multa: number | null
          observacoes: string | null
          status: string
          updated_at: string
          valor_pago: number | null
          valor_previsto: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          juros?: number | null
          mes_referencia: string
          multa?: number | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_pago?: number | null
          valor_previsto?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          juros?: number | null
          mes_referencia?: string
          multa?: number | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_pago?: number | null
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas_satisfacao: {
        Row: {
          comentario: string | null
          corretor_id: string | null
          created_at: string
          enviada_em: string | null
          erro_envio: string | null
          expira_em: string | null
          id: string
          lead_id: string
          nota: number | null
          respondida_em: string | null
          status: Database["public"]["Enums"]["satisfacao_status"]
          telefone: string
          tentativas: number
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          corretor_id?: string | null
          created_at?: string
          enviada_em?: string | null
          erro_envio?: string | null
          expira_em?: string | null
          id?: string
          lead_id: string
          nota?: number | null
          respondida_em?: string | null
          status?: Database["public"]["Enums"]["satisfacao_status"]
          telefone: string
          tentativas?: number
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          corretor_id?: string | null
          created_at?: string
          enviada_em?: string | null
          erro_envio?: string | null
          expira_em?: string | null
          id?: string
          lead_id?: string
          nota?: number | null
          respondida_em?: string | null
          status?: Database["public"]["Enums"]["satisfacao_status"]
          telefone?: string
          tentativas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_satisfacao_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_satisfacao_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vendas_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      plantao_escala: {
        Row: {
          corretor_id: string
          created_at: string
          criado_por: string | null
          data: string
          id: string
          notificado_em: string | null
          updated_at: string
        }
        Insert: {
          corretor_id: string
          created_at?: string
          criado_por?: string | null
          data: string
          id?: string
          notificado_em?: string | null
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          created_at?: string
          criado_por?: string | null
          data?: string
          id?: string
          notificado_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plantao_log: {
        Row: {
          corretor_id: string | null
          criado_em: string
          detalhe: Json | null
          id: string
          lead_id: string | null
          motivo: Database["public"]["Enums"]["plantao_motivo"]
          origem: Database["public"]["Enums"]["lead_origem"] | null
        }
        Insert: {
          corretor_id?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: string
          lead_id?: string | null
          motivo: Database["public"]["Enums"]["plantao_motivo"]
          origem?: Database["public"]["Enums"]["lead_origem"] | null
        }
        Update: {
          corretor_id?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: string
          lead_id?: string | null
          motivo?: Database["public"]["Enums"]["plantao_motivo"]
          origem?: Database["public"]["Enums"]["lead_origem"] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          id: string
          nome: string
          onesignal_external_id: string | null
          plantao_elegivel: boolean
          responsavel_id: string | null
          updated_at: string
          vendas_acesso: boolean
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          id: string
          nome?: string
          onesignal_external_id?: string | null
          plantao_elegivel?: boolean
          responsavel_id?: string | null
          updated_at?: string
          vendas_acesso?: boolean
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string
          onesignal_external_id?: string | null
          plantao_elegivel?: boolean
          responsavel_id?: string | null
          updated_at?: string
          vendas_acesso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      regiao_responsavel: {
        Row: {
          regiao: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id: string
          updated_at: string
        }
        Insert: {
          regiao: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id: string
          updated_at?: string
        }
        Update: {
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          responsavel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regiao_responsavel_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at: string
          id: string
          nome: string
          onesignal_external_id: string | null
          regiao: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          id?: string
          nome: string
          onesignal_external_id?: string | null
          regiao?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          canal?: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          id?: string
          nome?: string
          onesignal_external_id?: string | null
          regiao?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      reuniao_lembretes: {
        Row: {
          enviado_em: string
          id: string
          reuniao_id: string
          tipo: Database["public"]["Enums"]["reuniao_lembrete_tipo"]
        }
        Insert: {
          enviado_em?: string
          id?: string
          reuniao_id: string
          tipo: Database["public"]["Enums"]["reuniao_lembrete_tipo"]
        }
        Update: {
          enviado_em?: string
          id?: string
          reuniao_id?: string
          tipo?: Database["public"]["Enums"]["reuniao_lembrete_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_lembretes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      reuniao_participantes: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          lead_id: string | null
          recorrente: boolean
          responsavel_id: string | null
          reuniao_id: string
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          recorrente?: boolean
          responsavel_id?: string | null
          reuniao_id: string
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          recorrente?: boolean
          responsavel_id?: string | null
          reuniao_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_participantes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reuniao_participantes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reuniao_participantes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      reunioes: {
        Row: {
          created_at: string
          criado_por: string | null
          data_inicio: string
          descricao: string | null
          duracao_min: number
          google_event_ids: Json
          id: string
          local: string | null
          recorrente: boolean
          resultado: string | null
          status: Database["public"]["Enums"]["reuniao_status"]
          tipo: Database["public"]["Enums"]["reuniao_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_inicio: string
          descricao?: string | null
          duracao_min?: number
          google_event_ids?: Json
          id?: string
          local?: string | null
          recorrente?: boolean
          resultado?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_inicio?: string
          descricao?: string | null
          duracao_min?: number
          google_event_ids?: Json
          id?: string
          local?: string | null
          recorrente?: boolean
          resultado?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_conquistas: {
        Row: {
          conquista_id: string
          created_at: string
          desbloqueada_em: string | null
          id: string
          notificada: boolean
          progresso: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conquista_id: string
          created_at?: string
          desbloqueada_em?: string | null
          id?: string
          notificada?: boolean
          progresso?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conquista_id?: string
          created_at?: string
          desbloqueada_em?: string | null
          id?: string
          notificada?: boolean
          progresso?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_conquistas_conquista_id_fkey"
            columns: ["conquista_id"]
            isOneToOne: false
            referencedRelation: "conquistas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          last_heartbeat_at: string | null
          login_at: string
          logout_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_heartbeat_at?: string | null
          login_at?: string
          logout_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_heartbeat_at?: string | null
          login_at?: string
          logout_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vendas_lead_historico: {
        Row: {
          criado_em: string
          etapa_anterior: Database["public"]["Enums"]["vendas_etapa"] | null
          etapa_nova: Database["public"]["Enums"]["vendas_etapa"]
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          etapa_anterior?: Database["public"]["Enums"]["vendas_etapa"] | null
          etapa_nova: Database["public"]["Enums"]["vendas_etapa"]
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          etapa_anterior?: Database["public"]["Enums"]["vendas_etapa"] | null
          etapa_nova?: Database["public"]["Enums"]["vendas_etapa"]
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_lead_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vendas_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_leads: {
        Row: {
          atribuicao_status: string | null
          atribuido_em: string | null
          atribuido_por: string | null
          comissao: number | null
          corretor_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          etapa: Database["public"]["Enums"]["vendas_etapa"]
          executivo_canal: Database["public"]["Enums"]["lead_canal"] | null
          fechado_em: string | null
          first_response_at: string | null
          followup_alerta_em: string | null
          id: string
          imovel_id: string | null
          nome: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["lead_origem"]
          origem_detalhe: string | null
          plantao_dia: string | null
          reativacao_sugerida_em: string | null
          recusas: Json
          regiao: Database["public"]["Enums"]["lead_regiao"]
          telefone: string
          tipo: Database["public"]["Enums"]["vendas_tipo"]
          ultima_mensagem_em: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          atribuicao_status?: string | null
          atribuido_em?: string | null
          atribuido_por?: string | null
          comissao?: number | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["vendas_etapa"]
          executivo_canal?: Database["public"]["Enums"]["lead_canal"] | null
          fechado_em?: string | null
          first_response_at?: string | null
          followup_alerta_em?: string | null
          id?: string
          imovel_id?: string | null
          nome: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          origem_detalhe?: string | null
          plantao_dia?: string | null
          reativacao_sugerida_em?: string | null
          recusas?: Json
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          telefone: string
          tipo?: Database["public"]["Enums"]["vendas_tipo"]
          ultima_mensagem_em?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          atribuicao_status?: string | null
          atribuido_em?: string | null
          atribuido_por?: string | null
          comissao?: number | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["vendas_etapa"]
          executivo_canal?: Database["public"]["Enums"]["lead_canal"] | null
          fechado_em?: string | null
          first_response_at?: string | null
          followup_alerta_em?: string | null
          id?: string
          imovel_id?: string | null
          nome?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          origem_detalhe?: string | null
          plantao_dia?: string | null
          reativacao_sugerida_em?: string | null
          recusas?: Json
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          telefone?: string
          tipo?: Database["public"]["Enums"]["vendas_tipo"]
          ultima_mensagem_em?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_leads_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_leads_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis_portfolio"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_visitas: {
        Row: {
          chave_lembrete_enviado_em: string | null
          checklist: Json
          comparecimento: string | null
          confirmada_em: string | null
          confirmada_por: string | null
          corretor_id: string
          created_at: string
          data_inicio: string
          duracao_min: number
          endereco: string
          google_event_id: string | null
          id: string
          imovel_id: string | null
          lead_id: string
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          chave_lembrete_enviado_em?: string | null
          checklist?: Json
          comparecimento?: string | null
          confirmada_em?: string | null
          confirmada_por?: string | null
          corretor_id: string
          created_at?: string
          data_inicio: string
          duracao_min?: number
          endereco: string
          google_event_id?: string | null
          id?: string
          imovel_id?: string | null
          lead_id: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          chave_lembrete_enviado_em?: string | null
          checklist?: Json
          comparecimento?: string | null
          confirmada_em?: string | null
          confirmada_por?: string | null
          corretor_id?: string
          created_at?: string
          data_inicio?: string
          duracao_min?: number
          endereco?: string
          google_event_id?: string | null
          id?: string
          imovel_id?: string | null
          lead_id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_visitas_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_visitas_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis_portfolio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vendas_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_log: {
        Row: {
          criado_em: string
          erro: string | null
          fonte: string
          id: string
          payload_resumo: Json | null
          status_code: number | null
          sucesso: boolean
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          fonte: string
          id?: string
          payload_resumo?: Json | null
          status_code?: number | null
          sucesso?: boolean
        }
        Update: {
          criado_em?: string
          erro?: string | null
          fonte?: string
          id?: string
          payload_resumo?: Json | null
          status_code?: number | null
          sucesso?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      imoveis_portfolio: {
        Row: {
          area_m2: number | null
          bairro: string | null
          banheiros: number | null
          captador_id: string | null
          cep: string | null
          chave_com_id: string | null
          chave_foto_atual: string | null
          chave_retirada_em: string | null
          cidade: string | null
          codigo: string | null
          complemento: string | null
          condominio: number | null
          created_at: string | null
          finalidade: string | null
          fotos: string[] | null
          gestao_patrimonio: boolean | null
          id: string | null
          iptu: number | null
          numero: string | null
          observacoes: string | null
          quartos: number | null
          rua: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
          vagas: number | null
          valor_aluguel: number | null
          valor_venda: number | null
          vitrine_url: string | null
        }
        Insert: {
          area_m2?: number | null
          bairro?: string | null
          banheiros?: number | null
          captador_id?: string | null
          cep?: string | null
          chave_com_id?: string | null
          chave_foto_atual?: string | null
          chave_retirada_em?: string | null
          cidade?: string | null
          codigo?: string | null
          complemento?: string | null
          condominio?: number | null
          created_at?: string | null
          finalidade?: string | null
          fotos?: string[] | null
          gestao_patrimonio?: boolean | null
          id?: string | null
          iptu?: number | null
          numero?: string | null
          observacoes?: string | null
          quartos?: number | null
          rua?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          vagas?: number | null
          valor_aluguel?: number | null
          valor_venda?: number | null
          vitrine_url?: string | null
        }
        Update: {
          area_m2?: number | null
          bairro?: string | null
          banheiros?: number | null
          captador_id?: string | null
          cep?: string | null
          chave_com_id?: string | null
          chave_foto_atual?: string | null
          chave_retirada_em?: string | null
          cidade?: string | null
          codigo?: string | null
          complemento?: string | null
          condominio?: number | null
          created_at?: string | null
          finalidade?: string | null
          fotos?: string[] | null
          gestao_patrimonio?: boolean | null
          id?: string | null
          iptu?: number | null
          numero?: string | null
          observacoes?: string | null
          quartos?: number | null
          rua?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          vagas?: number | null
          valor_aluguel?: number | null
          valor_venda?: number | null
          vitrine_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_captador_id_fkey"
            columns: ["captador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_chave_com_id_fkey"
            columns: ["chave_com_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_lead_canal_value: { Args: { _value: string }; Returns: undefined }
      buscar_lead_360: {
        Args: { _cpf?: string; _telefone?: string }
        Returns: Json
      }
      can_user_view_reuniao: { Args: { _reuniao_id: string }; Returns: boolean }
      can_view_candidatos: { Args: { _user_id?: string }; Returns: boolean }
      can_write_imovel_foto: {
        Args: { _name: string; _uid?: string }
        Returns: boolean
      }
      corretor_ocupado_agora: {
        Args: { _at?: string; _corretor_id: string }
        Returns: boolean
      }
      current_corretor_responsavel_id: { Args: never; Returns: string }
      current_user_executivo_id: { Args: never; Returns: string }
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_is_executivo: { Args: never; Returns: boolean }
      current_user_responsavel_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      devolver_chave: {
        Args: { _foto_url: string; _imovel_id: string; _observacao?: string }
        Returns: string
      }
      expirar_pesquisas_satisfacao: { Args: never; Returns: number }
      fechar_lead_vendas: {
        Args: { _imovel_id: string; _lead_id: string }
        Returns: Json
      }
      get_comparativo_regioes: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      get_funil_conversao: {
        Args: {
          _from: string
          _pipeline: string
          _scope?: string
          _target?: string
          _to: string
        }
        Returns: Json
      }
      get_leads_sem_resposta: { Args: never; Returns: Json }
      get_meta_progresso: {
        Args: { _ano: number; _corretor_id: string; _mes: number }
        Returns: Json
      }
      get_metas_progresso_lista: {
        Args: { _ano: number; _mes: number }
        Returns: Json
      }
      get_portfolio_stats: { Args: { _days?: number }; Returns: Json }
      get_receita_administracao: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      get_satisfacao_stats: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      get_saude_sistema: { Args: never; Returns: Json }
      get_tempo_resposta_ranking: {
        Args: { _from: string; _scope?: string; _target?: string; _to: string }
        Returns: Json
      }
      get_vendas_relatorio: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      get_vendas_relatorio_escopos: { Args: never; Returns: Json }
      get_vendas_relatorio_v2: {
        Args: {
          _from: string
          _scope?: string
          _target_id?: string
          _to: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_administrativo: { Args: { _user_id?: string }; Returns: boolean }
      is_correspondente_bancaria: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      is_corretor_vendas_ou_executivo: {
        Args: { _uid?: string }
        Returns: boolean
      }
      link_corretor_to_executivo: {
        Args: { _profile_id: string }
        Returns: string
      }
      list_visitas_nao_compareceu: {
        Args: {
          _from: string
          _scope?: string
          _status?: string
          _target_id?: string
          _to: string
        }
        Returns: Json
      }
      log_audit: {
        Args: {
          _acao: string
          _antes?: Json
          _contexto?: Json
          _depois?: Json
          _registro_id?: string
          _tabela?: string
        }
        Returns: string
      }
      normalize_cpf: { Args: { _cpf: string }; Returns: string }
      normalize_telefone: { Args: { _tel: string }; Returns: string }
      plantonista_do_dia: { Args: { _data: string }; Returns: string }
      recalcular_conquistas_todos: { Args: never; Returns: number }
      recalcular_conquistas_usuario: {
        Args: { _user_id: string }
        Returns: {
          conquista_id: string
          icone: string
          nome: string
        }[]
      }
      registrar_resposta_satisfacao: {
        Args: { _mensagem: string; _telefone: string }
        Returns: Json
      }
      retirar_chave: {
        Args: { _foto_url: string; _imovel_id: string; _observacao?: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "corretor"
        | "corretor_vendas"
        | "administrativo"
        | "correspondente_bancaria"
        | "candidatos_viewer"
      candidato_status: "pendente_revisao" | "arquivado" | "recebido_confirmado"
      financiamento_status: "pendente" | "em_analise" | "aprovado" | "recusado"
      lead_canal: "denise" | "fabiola" | "renata" | "robson" | "teste_nego"
      lead_etapa:
        | "novos_leads"
        | "em_atendimento"
        | "reuniao_agendada"
        | "solicitacao_documentos"
        | "documentos_enviados"
        | "em_negociacao"
        | "follow_up"
        | "fechado"
        | "descartado"
        | "descredenciado"
      lead_origem:
        | "zap_imoveis"
        | "olx"
        | "site"
        | "whatsapp_empresa"
        | "facebook"
        | "manual"
        | "outro"
      lead_regiao:
        | "barra_da_tijuca"
        | "recreio"
        | "jacarepagua"
        | "zona_sul"
        | "zona_norte"
        | "zona_oeste"
        | "centro"
        | "outras"
        | "belford_roxo"
        | "nilopolis"
        | "mesquita"
        | "nova_iguacu"
      plantao_motivo:
        | "novo_lead"
        | "reincidencia"
        | "redirecionamento_demora"
        | "sem_plantonista"
      reuniao_lembrete_tipo: "1d" | "1h" | "15min"
      reuniao_status: "agendada" | "realizada" | "cancelada"
      reuniao_tipo: "individual" | "institucional" | "alinhamento" | "mentoria"
      satisfacao_status:
        | "pendente"
        | "enviada"
        | "respondida"
        | "sem_resposta_valida"
        | "falha_envio"
      vendas_etapa:
        | "novo_lead"
        | "contato_realizado"
        | "visita_agendada"
        | "proposta_enviada"
        | "em_negociacao"
        | "follow_up"
        | "fechado"
        | "perdido"
      vendas_tipo: "compra" | "locacao"
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
      app_role: [
        "admin",
        "corretor",
        "corretor_vendas",
        "administrativo",
        "correspondente_bancaria",
        "candidatos_viewer",
      ],
      candidato_status: [
        "pendente_revisao",
        "arquivado",
        "recebido_confirmado",
      ],
      financiamento_status: ["pendente", "em_analise", "aprovado", "recusado"],
      lead_canal: ["denise", "fabiola", "renata", "robson", "teste_nego"],
      lead_etapa: [
        "novos_leads",
        "em_atendimento",
        "reuniao_agendada",
        "solicitacao_documentos",
        "documentos_enviados",
        "em_negociacao",
        "follow_up",
        "fechado",
        "descartado",
        "descredenciado",
      ],
      lead_origem: [
        "zap_imoveis",
        "olx",
        "site",
        "whatsapp_empresa",
        "facebook",
        "manual",
        "outro",
      ],
      lead_regiao: [
        "barra_da_tijuca",
        "recreio",
        "jacarepagua",
        "zona_sul",
        "zona_norte",
        "zona_oeste",
        "centro",
        "outras",
        "belford_roxo",
        "nilopolis",
        "mesquita",
        "nova_iguacu",
      ],
      plantao_motivo: [
        "novo_lead",
        "reincidencia",
        "redirecionamento_demora",
        "sem_plantonista",
      ],
      reuniao_lembrete_tipo: ["1d", "1h", "15min"],
      reuniao_status: ["agendada", "realizada", "cancelada"],
      reuniao_tipo: ["individual", "institucional", "alinhamento", "mentoria"],
      satisfacao_status: [
        "pendente",
        "enviada",
        "respondida",
        "sem_resposta_valida",
        "falha_envio",
      ],
      vendas_etapa: [
        "novo_lead",
        "contato_realizado",
        "visita_agendada",
        "proposta_enviada",
        "em_negociacao",
        "follow_up",
        "fechado",
        "perdido",
      ],
      vendas_tipo: ["compra", "locacao"],
    },
  },
} as const
