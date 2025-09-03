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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      notifications: {
        Row: {
          alert_id: string | null
          delivered_at: string | null
          delivery_error: string | null
          delivery_status: string
          id: string
          is_read: boolean | null
          message: string
          property_id: string
          qa_validated_at: string | null
          quality_issues: Json | null
          quality_score: number | null
          sent_at: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          is_read?: boolean | null
          message: string
          property_id: string
          qa_validated_at?: string | null
          quality_issues?: Json | null
          quality_score?: number | null
          sent_at?: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          is_read?: boolean | null
          message?: string
          property_id?: string
          qa_validated_at?: string | null
          quality_issues?: Json | null
          quality_score?: number | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "user_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          max_alerts: number | null
          notifications_paused: boolean
          phone: string | null
          subscription_end_date: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_start_date: string | null
          trial_used: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          max_alerts?: number | null
          notifications_paused?: boolean
          phone?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_start_date?: string | null
          trial_used?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          max_alerts?: number | null
          notifications_paused?: boolean
          phone?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_start_date?: string | null
          trial_used?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          currency: string | null
          description: string | null
          external_id: string
          features: string[] | null
          first_seen_at: string
          furnishing: string | null
          id: string
          image_urls: string[] | null
          is_active: boolean | null
          last_updated_at: string
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          price: number | null
          property_type: string | null
          source: string
          surface_area: number | null
          title: string
          url: string
        }
        Insert: {
          address?: string | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          currency?: string | null
          description?: string | null
          external_id: string
          features?: string[] | null
          first_seen_at?: string
          furnishing?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          last_updated_at?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          price?: number | null
          property_type?: string | null
          source: string
          surface_area?: number | null
          title: string
          url: string
        }
        Update: {
          address?: string | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          currency?: string | null
          description?: string | null
          external_id?: string
          features?: string[] | null
          first_seen_at?: string
          furnishing?: string | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          last_updated_at?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          price?: number | null
          property_type?: string | null
          source?: string
          surface_area?: number | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      qa_admin_alerts: {
        Row: {
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          message: string
          resolved_at: string | null
          sent_at: string | null
          severity: string
          status: string
          test_run_id: string | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          resolved_at?: string | null
          sent_at?: string | null
          severity?: string
          status?: string
          test_run_id?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          resolved_at?: string | null
          sent_at?: string | null
          severity?: string
          status?: string
          test_run_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_admin_alerts_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_results: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          quality_score: number | null
          response_time_ms: number | null
          started_at: string
          status: string
          test_data: Json | null
          test_name: string
          test_run_id: string
          test_target: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          quality_score?: number | null
          response_time_ms?: number | null
          started_at?: string
          status: string
          test_data?: Json | null
          test_name: string
          test_run_id: string
          test_target?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          quality_score?: number | null
          response_time_ms?: number | null
          started_at?: string
          status?: string
          test_data?: Json | null
          test_name?: string
          test_run_id?: string
          test_target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_results_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          failed_tests: number | null
          id: string
          passed_tests: number | null
          started_at: string
          status: string
          test_property_id: string | null
          test_user_id: string | null
          total_tests: number | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          failed_tests?: number | null
          id?: string
          passed_tests?: number | null
          started_at?: string
          status?: string
          test_property_id?: string | null
          test_user_id?: string | null
          total_tests?: number | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          failed_tests?: number | null
          id?: string
          passed_tests?: number | null
          started_at?: string
          status?: string
          test_property_id?: string | null
          test_user_id?: string | null
          total_tests?: number | null
        }
        Relationships: []
      }
      qa_test_users: {
        Row: {
          cleaned_up_at: string | null
          cleanup_attempts: number | null
          created_at: string
          email: string
          id: string
          test_run_id: string | null
          user_id: string
        }
        Insert: {
          cleaned_up_at?: string | null
          cleanup_attempts?: number | null
          created_at?: string
          email: string
          id?: string
          test_run_id?: string | null
          user_id: string
        }
        Update: {
          cleaned_up_at?: string | null
          cleanup_attempts?: number | null
          created_at?: string
          email?: string
          id?: string
          test_run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_users_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_health: {
        Row: {
          backup_selectors: Json[] | null
          backup_urls: string[] | null
          consecutive_failures: number | null
          consecutive_hours_zero_properties: number | null
          created_at: string | null
          current_selectors: Json | null
          current_url: string | null
          id: string
          is_in_repair_mode: boolean | null
          last_admin_alert: string | null
          last_failure_run: string | null
          last_qa_check: string | null
          last_repair_attempt: string | null
          last_successful_run: string | null
          qa_failure_count: number | null
          repair_attempt_count: number | null
          repair_attempts: number | null
          repair_status: string | null
          source: string
          updated_at: string | null
        }
        Insert: {
          backup_selectors?: Json[] | null
          backup_urls?: string[] | null
          consecutive_failures?: number | null
          consecutive_hours_zero_properties?: number | null
          created_at?: string | null
          current_selectors?: Json | null
          current_url?: string | null
          id?: string
          is_in_repair_mode?: boolean | null
          last_admin_alert?: string | null
          last_failure_run?: string | null
          last_qa_check?: string | null
          last_repair_attempt?: string | null
          last_successful_run?: string | null
          qa_failure_count?: number | null
          repair_attempt_count?: number | null
          repair_attempts?: number | null
          repair_status?: string | null
          source: string
          updated_at?: string | null
        }
        Update: {
          backup_selectors?: Json[] | null
          backup_urls?: string[] | null
          consecutive_failures?: number | null
          consecutive_hours_zero_properties?: number | null
          created_at?: string | null
          current_selectors?: Json | null
          current_url?: string | null
          id?: string
          is_in_repair_mode?: boolean | null
          last_admin_alert?: string | null
          last_failure_run?: string | null
          last_qa_check?: string | null
          last_repair_attempt?: string | null
          last_successful_run?: string | null
          qa_failure_count?: number | null
          repair_attempt_count?: number | null
          repair_attempts?: number | null
          repair_status?: string | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scraping_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          new_properties: number | null
          properties_found: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          new_properties?: number | null
          properties_found?: number | null
          source: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          new_properties?: number | null
          properties_found?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          trial_end: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_alerts: {
        Row: {
          cities: string[] | null
          created_at: string
          furnishing: string[] | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          latitude: number | null
          location_radius: number | null
          longitude: number | null
          max_bedrooms: number | null
          max_price: number | null
          min_bedrooms: number | null
          min_price: number | null
          min_surface_area: number | null
          name: string
          notification_methods: string[] | null
          postal_codes: string[] | null
          property_types: string[] | null
          sources: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cities?: string[] | null
          created_at?: string
          furnishing?: string[] | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          latitude?: number | null
          location_radius?: number | null
          longitude?: number | null
          max_bedrooms?: number | null
          max_price?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          min_surface_area?: number | null
          name: string
          notification_methods?: string[] | null
          postal_codes?: string[] | null
          property_types?: string[] | null
          sources?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cities?: string[] | null
          created_at?: string
          furnishing?: string[] | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          latitude?: number | null
          location_radius?: number | null
          longitude?: number | null
          max_bedrooms?: number | null
          max_price?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          min_surface_area?: number | null
          name?: string
          notification_methods?: string[] | null
          postal_codes?: string[] | null
          property_types?: string[] | null
          sources?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_qa_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
