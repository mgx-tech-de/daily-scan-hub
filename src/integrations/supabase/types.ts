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
      attendance_days: {
        Row: {
          break_minutes: number
          check_in_at: string | null
          check_out_at: string | null
          gross_minutes: number
          id: string
          late_minutes: number
          net_minutes: number
          overtime_minutes: number
          raw_check_in_at: string | null
          status: Database["public"]["Enums"]["day_status"]
          undertime_minutes: number
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          break_minutes?: number
          check_in_at?: string | null
          check_out_at?: string | null
          gross_minutes?: number
          id?: string
          late_minutes?: number
          net_minutes?: number
          overtime_minutes?: number
          raw_check_in_at?: string | null
          status?: Database["public"]["Enums"]["day_status"]
          undertime_minutes?: number
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          break_minutes?: number
          check_in_at?: string | null
          check_out_at?: string | null
          gross_minutes?: number
          id?: string
          late_minutes?: number
          net_minutes?: number
          overtime_minutes?: number
          raw_check_in_at?: string | null
          status?: Database["public"]["Enums"]["day_status"]
          undertime_minutes?: number
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      attendance_events: {
        Row: {
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          kind: Database["public"]["Enums"]["event_kind"]
          raw_at: string
          reason: string | null
          source: string
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_at: string
          id?: string
          kind: Database["public"]["Enums"]["event_kind"]
          raw_at?: string
          reason?: string | null
          source?: string
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          raw_at?: string
          reason?: string | null
          source?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          employee_code: string | null
          end_date: string | null
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          position: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string
          employee_code?: string | null
          end_date?: string | null
          first_name?: string
          hire_date?: string | null
          id: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          employee_code?: string | null
          end_date?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_tokens: {
        Row: {
          created_at: string
          id: string
          revoked: boolean
          secret: string
          work_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          revoked?: boolean
          secret: string
          work_date: string
        }
        Update: {
          created_at?: string
          id?: string
          revoked?: boolean
          secret?: string
          work_date?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          break_deduction_minutes: number
          break_threshold_minutes: number
          count_unapproved_overtime: boolean
          daily_cutoff: string
          grace_minutes: number
          id: number
          min_dwell_seconds: number
          org_name: string
          qr_open: string
          shift_end: string
          shift_start: string
          timezone: string
          updated_at: string
        }
        Insert: {
          break_deduction_minutes?: number
          break_threshold_minutes?: number
          count_unapproved_overtime?: boolean
          daily_cutoff?: string
          grace_minutes?: number
          id?: number
          min_dwell_seconds?: number
          org_name?: string
          qr_open?: string
          shift_end?: string
          shift_start?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          break_deduction_minutes?: number
          break_threshold_minutes?: number
          count_unapproved_overtime?: boolean
          daily_cutoff?: string
          grace_minutes?: number
          id?: number
          min_dwell_seconds?: number
          org_name?: string
          qr_open?: string
          shift_end?: string
          shift_start?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      app_role: "admin" | "employee"
      day_status:
        | "present"
        | "incomplete"
        | "absent"
        | "leave"
        | "holiday"
        | "weekend"
      event_kind: "check_in" | "check_out"
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
      app_role: ["admin", "employee"],
      day_status: [
        "present",
        "incomplete",
        "absent",
        "leave",
        "holiday",
        "weekend",
      ],
      event_kind: ["check_in", "check_out"],
    },
  },
} as const
