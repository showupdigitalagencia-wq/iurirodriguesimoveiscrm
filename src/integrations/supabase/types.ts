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
      responsaveis: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at: string
          id: string
          nome: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          canal: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["lead_canal"]
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          whatsapp?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "corretor"
      lead_canal: "denise" | "fabiola" | "renata" | "robson"
      lead_etapa:
        | "novos_leads"
        | "em_atendimento"
        | "visita_agendada"
        | "proposta_enviada"
        | "em_negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      lead_regiao:
        | "barra_da_tijuca"
        | "recreio"
        | "jacarepagua"
        | "zona_sul"
        | "zona_norte"
        | "zona_oeste"
        | "centro"
        | "outras"
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
      app_role: ["admin", "corretor"],
      lead_canal: ["denise", "fabiola", "renata", "robson"],
      lead_etapa: [
        "novos_leads",
        "em_atendimento",
        "visita_agendada",
        "proposta_enviada",
        "em_negociacao",
        "fechado_ganho",
        "fechado_perdido",
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
      ],
    },
  },
} as const
