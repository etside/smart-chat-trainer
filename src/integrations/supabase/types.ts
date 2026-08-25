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
          alt_api_keys: Json | null
          auto_approve: boolean
          b2b_backblaze_key: string | null
          boson_workspace_id: string | null
          credit_usage: number | null
          cron_secret: string | null
          data_policy_content: string | null
          enable_streaming: boolean | null
          fish_audio_api_key: string | null
          id: number
          last_sync_at: string | null
          last_sync_details: Json | null
          last_sync_status: string | null
          lovable_api_key_override: string | null
          max_simultaneous_replies: number | null
          meta_access_token: string | null
          meta_api_version: string | null
          meta_app_id: string | null
          meta_app_secret: string | null
          meta_page_id: string | null
          meta_webhook_verify_token: string | null
          meta_whatsapp_business_account_id: string | null
          model: string
          reduce_motion: boolean | null
          sync_schedule: string | null
          sync_secret: string | null
          sync_token: string | null
          system_prompt: string
          updated_at: string
          usage_config: Json | null
          vps_hosting_config: Json | null
          webhook_secret: string | null
        }
        Insert: {
          alt_api_keys?: Json | null
          auto_approve?: boolean
          b2b_backblaze_key?: string | null
          boson_workspace_id?: string | null
          credit_usage?: number | null
          cron_secret?: string | null
          data_policy_content?: string | null
          enable_streaming?: boolean | null
          fish_audio_api_key?: string | null
          id?: number
          last_sync_at?: string | null
          last_sync_details?: Json | null
          last_sync_status?: string | null
          lovable_api_key_override?: string | null
          max_simultaneous_replies?: number | null
          meta_access_token?: string | null
          meta_api_version?: string | null
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_page_id?: string | null
          meta_webhook_verify_token?: string | null
          meta_whatsapp_business_account_id?: string | null
          model?: string
          reduce_motion?: boolean | null
          sync_schedule?: string | null
          sync_secret?: string | null
          sync_token?: string | null
          system_prompt?: string
          updated_at?: string
          usage_config?: Json | null
          vps_hosting_config?: Json | null
          webhook_secret?: string | null
        }
        Update: {
          alt_api_keys?: Json | null
          auto_approve?: boolean
          b2b_backblaze_key?: string | null
          boson_workspace_id?: string | null
          credit_usage?: number | null
          cron_secret?: string | null
          data_policy_content?: string | null
          enable_streaming?: boolean | null
          fish_audio_api_key?: string | null
          id?: number
          last_sync_at?: string | null
          last_sync_details?: Json | null
          last_sync_status?: string | null
          lovable_api_key_override?: string | null
          max_simultaneous_replies?: number | null
          meta_access_token?: string | null
          meta_api_version?: string | null
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_page_id?: string | null
          meta_webhook_verify_token?: string | null
          meta_whatsapp_business_account_id?: string | null
          model?: string
          reduce_motion?: boolean | null
          sync_schedule?: string | null
          sync_secret?: string | null
          sync_token?: string | null
          system_prompt?: string
          updated_at?: string
          usage_config?: Json | null
          vps_hosting_config?: Json | null
          webhook_secret?: string | null
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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      auto_reply_template_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          language: string
          name: string
          platform: string
          status: string
          template_id: string
          template_text: string
          variables: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          language: string
          name: string
          platform: string
          status?: string
          template_id: string
          template_text: string
          variables?: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name?: string
          platform?: string
          status?: string
          template_id?: string
          template_text?: string
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "auto_reply_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reply_templates: {
        Row: {
          created_at: string | null
          id: string
          language: string
          name: string
          platform: string
          status: string
          template_text: string
          updated_at: string | null
          variables: Json | null
          version: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          language: string
          name: string
          platform: string
          status?: string
          template_text: string
          updated_at?: string | null
          variables?: Json | null
          version?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string
          name?: string
          platform?: string
          status?: string
          template_text?: string
          updated_at?: string | null
          variables?: Json | null
          version?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          channel: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          metric_value: number | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          metric_value?: number | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          metric_value?: number | null
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          shortcut: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          shortcut?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          shortcut?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      conversation_flows: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          edges: Json | null
          id: string
          is_active: boolean | null
          name: string
          nodes: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          edges?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          nodes?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          edges?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          nodes?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversation_sessions: {
        Row: {
          assigned_agent: string | null
          channel: string | null
          created_at: string | null
          customer_language: string | null
          customer_name: string | null
          external_id: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          started_at: string | null
          status: string | null
          summary: string | null
        }
        Insert: {
          assigned_agent?: string | null
          channel?: string | null
          created_at?: string | null
          customer_language?: string | null
          customer_name?: string | null
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
        }
        Update: {
          assigned_agent?: string | null
          channel?: string | null
          created_at?: string | null
          customer_language?: string | null
          customer_name?: string | null
          external_id?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
        }
        Relationships: []
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
      session_messages: {
        Row: {
          channel: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          channel?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          channel?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          action: string
          created_at: string | null
          duration_ms: number
          id: string
          metadata: Json | null
          request_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          duration_ms: number
          id?: string
          metadata?: Json | null
          request_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          duration_ms?: number
          id?: string
          metadata?: Json | null
          request_id?: string | null
        }
        Relationships: []
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
      tenant_credentials: {
        Row: {
          client_secret: string
          client_token: string
          created_at: string
          id: string
          platform: string
          rotated_at: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_verify_token: string
        }
        Insert: {
          client_secret: string
          client_token: string
          created_at?: string
          id?: string
          platform: string
          rotated_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_verify_token: string
        }
        Update: {
          client_secret?: string
          client_token?: string
          created_at?: string
          id?: string
          platform?: string
          rotated_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_verify_token?: string
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
          embedding: string | null
          id: string
          labels: string[] | null
          language: string | null
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
          embedding?: string | null
          id?: string
          labels?: string[] | null
          language?: string | null
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
          embedding?: string | null
          id?: string
          labels?: string[] | null
          language?: string | null
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
      usage_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          threshold_bdt: number
          threshold_credits: number
          threshold_usd: number
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          threshold_bdt: number
          threshold_credits: number
          threshold_usd: number
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          threshold_bdt?: number
          threshold_credits?: number
          threshold_usd?: number
          type?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          action: string
          actor_id: string | null
          cost_bdt: number
          cost_usd: number
          created_at: string
          credits_used: number
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          cost_bdt?: number
          cost_usd?: number
          created_at?: string
          credits_used?: number
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          cost_bdt?: number
          cost_usd?: number
          created_at?: string
          credits_used?: number
          id?: string
          metadata?: Json | null
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
      webhook_logs: {
        Row: {
          created_at: string | null
          direction: string
          error_details: string | null
          event_type: string | null
          headers: Json | null
          id: string
          last_attempt_at: string | null
          next_retry_at: string | null
          payload: Json | null
          processing_status: string | null
          retry_count: number | null
          source: string
          status_code: number | null
          target_url: string | null
        }
        Insert: {
          created_at?: string | null
          direction?: string
          error_details?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processing_status?: string | null
          retry_count?: number | null
          source: string
          status_code?: number | null
          target_url?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          error_details?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processing_status?: string | null
          retry_count?: number | null
          source?: string
          status_code?: number | null
          target_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      knowledge_base_articles: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          labels: string[] | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_usage_thresholds: { Args: never; Returns: undefined }
      get_analytics_summary: {
        Args: { _days?: number }
        Returns: {
          avg_messages_per_conversation: number
          channel_breakdown: Json
          response_accuracy: number
          top_questions: Json
          total_conversations: number
          total_messages: number
        }[]
      }
      get_usage_aggregates: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_agent_credits: { Args: { amount: number }; Returns: undefined }
      log_audit: {
        Args: {
          _action: string
          _actor_id: string
          _entity_id: string
          _entity_type: string
          _metadata: Json
        }
        Returns: undefined
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
      search_training_pairs_semantic: {
        Args: { _embedding: string; _limit?: number }
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
      app_role: "admin" | "user" | "editor" | "viewer"
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
      app_role: ["admin", "user", "editor", "viewer"],
    },
  },
} as const
