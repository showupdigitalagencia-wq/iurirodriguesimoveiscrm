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
          email: string | null
          etapa: Database["public"]["Enums"]["lead_etapa"]
          faixa_valor: string | null
          fechado_em: string | null
          first_response_at: string | null
          id: string
          is_corretor: boolean
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
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
          email?: string | null
          etapa?: Database["public"]["Enums"]["lead_etapa"]
          faixa_valor?: string | null
          fechado_em?: string | null
          first_response_at?: string | null
          id?: string
          is_corretor?: boolean
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
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
          email?: string | null
          etapa?: Database["public"]["Enums"]["lead_etapa"]
          faixa_valor?: string | null
          fechado_em?: string | null
          first_response_at?: string | null
          id?: string
          is_corretor?: boolean
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
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
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          onesignal_external_id: string | null
          responsavel_id: string | null
          updated_at: string
          vendas_acesso: boolean
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          nome?: string
          onesignal_external_id?: string | null
          responsavel_id?: string | null
          updated_at?: string
          vendas_acesso?: boolean
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          onesignal_external_id?: string | null
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
      responsaveis: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at: string
          id: string
          nome: string
          onesignal_external_id: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          id?: string
          nome: string
          onesignal_external_id?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          id?: string
          nome?: string
          onesignal_external_id?: string | null
          updated_at?: string
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
          created_at: string
          id: string
          lead_id: string | null
          responsavel_id: string | null
          reuniao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          responsavel_id?: string | null
          reuniao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          responsavel_id?: string | null
          reuniao_id?: string
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
          resultado?: string | null
          status?: Database["public"]["Enums"]["reuniao_status"]
          tipo?: Database["public"]["Enums"]["reuniao_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
          login_at: string
          logout_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          login_at?: string
          logout_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          login_at?: string
          logout_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vendas_leads: {
        Row: {
          atribuicao_status: string | null
          atribuido_em: string | null
          atribuido_por: string | null
          corretor_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          etapa: Database["public"]["Enums"]["vendas_etapa"]
          executivo_canal: Database["public"]["Enums"]["lead_canal"] | null
          id: string
          nome: string
          observacoes: string | null
          recusas: Json
          regiao: Database["public"]["Enums"]["lead_regiao"]
          telefone: string
          tipo: Database["public"]["Enums"]["vendas_tipo"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          atribuicao_status?: string | null
          atribuido_em?: string | null
          atribuido_por?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["vendas_etapa"]
          executivo_canal?: Database["public"]["Enums"]["lead_canal"] | null
          id?: string
          nome: string
          observacoes?: string | null
          recusas?: Json
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          telefone: string
          tipo?: Database["public"]["Enums"]["vendas_tipo"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          atribuicao_status?: string | null
          atribuido_em?: string | null
          atribuido_por?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["vendas_etapa"]
          executivo_canal?: Database["public"]["Enums"]["lead_canal"] | null
          id?: string
          nome?: string
          observacoes?: string | null
          recusas?: Json
          regiao?: Database["public"]["Enums"]["lead_regiao"]
          telefone?: string
          tipo?: Database["public"]["Enums"]["vendas_tipo"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      vendas_visitas: {
        Row: {
          corretor_id: string
          created_at: string
          data_inicio: string
          duracao_min: number
          endereco: string
          google_event_id: string | null
          id: string
          lead_id: string
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          corretor_id: string
          created_at?: string
          data_inicio: string
          duracao_min?: number
          endereco: string
          google_event_id?: string | null
          id?: string
          lead_id: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          created_at?: string
          data_inicio?: string
          duracao_min?: number
          endereco?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vendas_leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_responsavel_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "corretor" | "corretor_vendas"
      lead_canal: "denise" | "fabiola" | "renata" | "robson"
      lead_etapa:
        | "novos_leads"
        | "em_atendimento"
        | "reuniao_agendada"
        | "documentos_enviados"
        | "em_negociacao"
        | "follow_up"
        | "fechado"
        | "descartado"
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
      reuniao_lembrete_tipo: "1d" | "1h" | "15min"
      reuniao_status: "agendada" | "realizada" | "cancelada"
      reuniao_tipo: "individual" | "institucional" | "alinhamento"
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
      app_role: ["admin", "corretor", "corretor_vendas"],
      lead_canal: ["denise", "fabiola", "renata", "robson"],
      lead_etapa: [
        "novos_leads",
        "em_atendimento",
        "reuniao_agendada",
        "documentos_enviados",
        "em_negociacao",
        "follow_up",
        "fechado",
        "descartado",
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
      ],
      reuniao_lembrete_tipo: ["1d", "1h", "15min"],
      reuniao_status: ["agendada", "realizada", "cancelada"],
      reuniao_tipo: ["individual", "institucional", "alinhamento"],
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
