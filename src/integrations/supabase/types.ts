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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agent_settings: {
        Row: {
          auto_approve: boolean
          credit_usage: number | null
          id: number
          last_sync_at: string | null
          lovable_api_key_override: string | null
          model: string
          sync_schedule: string | null
          sync_secret: string | null
          sync_token: string | null
          system_prompt: string
          updated_at: string
        }
        Insert: {
          auto_approve?: boolean
          credit_usage?: number | null
          id?: number
          last_sync_at?: string | null
          lovable_api_key_override?: string | null
          model?: string
          sync_schedule?: string | null
          sync_secret?: string | null
          sync_token?: string | null
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          auto_approve?: boolean
          credit_usage?: number | null
          id?: number
          last_sync_at?: string | null
          lovable_api_key_override?: string | null
          model?: string
          sync_schedule?: string | null
          sync_secret?: string | null
          sync_token?: string | null
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          version_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked?: boolean
          version_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "training_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string | null
          created_at: string
          external_id: string | null
          id: string
          source: string
          updated_at: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          source?: string
          updated_at?: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          seq: number
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          seq?: number
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          items_count: number | null
          metadata: Json | null
          source: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          items_count?: number | null
          metadata?: Json | null
          source?: string | null
          started_at?: string | null
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          items_count?: number | null
          metadata?: Json | null
          source?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      training_jobs: {
        Row: {
          created_at: string | null
          error_log: string | null
          finished_at: string | null
          id: string
          started_at: string | null
          status: string
          sync_run_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_log?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status: string
          sync_run_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_log?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_jobs_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_pairs: {
        Row: {
          answer: string
          context: string | null
          conversation_id: string | null
          created_at: string
          id: string
          question: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          answer: string
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          question: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          answer?: string
          context?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          question?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_pairs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_versions: {
        Row: {
          created_at: string | null
          id: string
          name: string
          snapshot_data: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          snapshot_data?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          snapshot_data?: Json | null
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
      search_training_pairs: {
        Args: { _limit?: number; _query: string }
        Returns: {
          answer: string
          id: string
          question: string
          score: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
