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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          action_done_at: string | null
          action_kind: string | null
          confidence: string | null
          created_at: string
          human_review: boolean
          id: string
          inputs_used: string[] | null
          next_action: string | null
          patient_id: string
          safety_level: string
          source: string
          what_changed: string | null
          why_matters: string | null
        }
        Insert: {
          action_done_at?: string | null
          action_kind?: string | null
          confidence?: string | null
          created_at?: string
          human_review?: boolean
          id?: string
          inputs_used?: string[] | null
          next_action?: string | null
          patient_id: string
          safety_level?: string
          source?: string
          what_changed?: string | null
          why_matters?: string | null
        }
        Update: {
          action_done_at?: string | null
          action_kind?: string | null
          confidence?: string | null
          created_at?: string
          human_review?: boolean
          id?: string
          inputs_used?: string[] | null
          next_action?: string | null
          patient_id?: string
          safety_level?: string
          source?: string
          what_changed?: string | null
          why_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_name: string
          actor_role: string
          created_at: string
          data_category: string
          id: string
          patient_id: string
          purpose: string
        }
        Insert: {
          action?: string
          actor_name: string
          actor_role: string
          created_at?: string
          data_category: string
          id?: string
          patient_id: string
          purpose: string
        }
        Update: {
          action?: string
          actor_name?: string
          actor_role?: string
          created_at?: string
          data_category?: string
          id?: string
          patient_id?: string
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          consultant_notes: string | null
          flagged_followup: boolean
          id: string
          last_reviewed_at: string | null
          patient_id: string
          plan_actions: string | null
          review_status: string
          updated_at: string
        }
        Insert: {
          consultant_notes?: string | null
          flagged_followup?: boolean
          id?: string
          last_reviewed_at?: string | null
          patient_id: string
          plan_actions?: string | null
          review_status?: string
          updated_at?: string
        }
        Update: {
          consultant_notes?: string | null
          flagged_followup?: boolean
          id?: string
          last_reviewed_at?: string | null
          patient_id?: string
          plan_actions?: string | null
          review_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          category: string
          data_label: string
          granted_at: string | null
          id: string
          optional: boolean
          patient_id: string
          purpose: string
          recipient_name: string
          recipient_type: string
          retention: string | null
          status: string
          withdrawn_at: string | null
        }
        Insert: {
          category: string
          data_label: string
          granted_at?: string | null
          id?: string
          optional?: boolean
          patient_id: string
          purpose: string
          recipient_name: string
          recipient_type: string
          retention?: string | null
          status?: string
          withdrawn_at?: string | null
        }
        Update: {
          category?: string
          data_label?: string
          granted_at?: string | null
          id?: string
          optional?: boolean
          patient_id?: string
          purpose?: string
          recipient_name?: string
          recipient_type?: string
          retention?: string | null
          status?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          hospital: string | null
          id: string
          name: string
          specialty: string | null
        }
        Insert: {
          hospital?: string | null
          id: string
          name: string
          specialty?: string | null
        }
        Update: {
          hospital?: string | null
          id?: string
          name?: string
          specialty?: string | null
        }
        Relationships: []
      }
      deletion_requests: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          scope: string[]
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          scope: string[]
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          scope?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_accounts: {
        Row: {
          email: string
          patient_id: string
        }
        Insert: {
          email: string
          patient_id: string
        }
        Update: {
          email?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_accounts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      health_signals: {
        Row: {
          id: string
          meta: Json
          patient_id: string
          recorded_at: string
          signal_type: string
          source: string
          unit: string | null
          value: number | null
        }
        Insert: {
          id?: string
          meta?: Json
          patient_id: string
          recorded_at?: string
          signal_type: string
          source: string
          unit?: string | null
          value?: number | null
        }
        Update: {
          id?: string
          meta?: Json
          patient_id?: string
          recorded_at?: string
          signal_type?: string
          source?: string
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_signals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      kpis: {
        Row: {
          direction: string
          frequency: string
          id: string
          metric: string
          name: string
          notes: string | null
          patient_id: string
          source: string
          status: string
          target: number
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          direction?: string
          frequency?: string
          id?: string
          metric: string
          name: string
          notes?: string | null
          patient_id: string
          source?: string
          status?: string
          target: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          direction?: string
          frequency?: string
          id?: string
          metric?: string
          name?: string
          notes?: string | null
          patient_id?: string
          source?: string
          status?: string
          target?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          history: Json
          id: string
          patient_id: string
          pharmacy_id: string
          prescription_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          history?: Json
          id?: string
          patient_id: string
          pharmacy_id: string
          prescription_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          history?: Json
          id?: string
          patient_id?: string
          pharmacy_id?: string
          prescription_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          org_type: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          org_type: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          org_type?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          age: number | null
          city: string | null
          condition: string
          consultant_id: string | null
          created_at: string
          gender: string | null
          id: string
          insurer_id: string | null
          is_demo: boolean
          name: string
          pharmacy_id: string | null
          user_id: string | null
        }
        Insert: {
          age?: number | null
          city?: string | null
          condition?: string
          consultant_id?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          insurer_id?: string | null
          is_demo?: boolean
          name: string
          pharmacy_id?: string | null
          user_id?: string | null
        }
        Update: {
          age?: number | null
          city?: string | null
          condition?: string
          consultant_id?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          insurer_id?: string | null
          is_demo?: boolean
          name?: string
          pharmacy_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          city: string | null
          id: string
          name: string
        }
        Insert: {
          city?: string | null
          id: string
          name: string
        }
        Update: {
          city?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          dosage: string | null
          id: string
          medicine: string
          patient_id: string
          prescribed_by: string | null
          prescribed_on: string
          quantity: string | null
          refill_due: string | null
          status: string
          valid_until: string | null
        }
        Insert: {
          dosage?: string | null
          id?: string
          medicine: string
          patient_id: string
          prescribed_by?: string | null
          prescribed_on: string
          quantity?: string | null
          refill_due?: string | null
          status?: string
          valid_until?: string | null
        }
        Update: {
          dosage?: string | null
          id?: string
          medicine?: string
          patient_id?: string
          prescribed_by?: string | null
          prescribed_on?: string
          quantity?: string | null
          refill_due?: string | null
          status?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          amount: number | null
          category: string
          created_at: string
          file_path: string | null
          id: string
          notes: string | null
          patient_id: string
          payment_status: string | null
          report_date: string
          title: string
        }
        Insert: {
          amount?: number | null
          category: string
          created_at?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          payment_status?: string | null
          report_date?: string
          title: string
        }
        Update: {
          amount?: number | null
          category?: string
          created_at?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          payment_status?: string | null
          report_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      wellness_status: {
        Row: {
          benefit_eligible: boolean
          outcome_status: string
          patient_id: string
          programme: string
          updated_at: string
        }
        Insert: {
          benefit_eligible?: boolean
          outcome_status?: string
          patient_id: string
          programme?: string
          updated_at?: string
        }
        Update: {
          benefit_eligible?: boolean
          outcome_status?: string
          patient_id?: string
          programme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_status_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _audit: {
        Args: {
          _action: string
          _actor: string
          _cat: string
          _pid: string
          _purpose: string
          _role: string
        }
        Returns: undefined
      }
      _seed_consents: {
        Args: { _granted: string[]; _pid: string }
        Returns: undefined
      }
      _seed_patient_data: { Args: { _pid: string }; Returns: undefined }
      advance_order: {
        Args: { _order: string; _status: string }
        Returns: undefined
      }
      claim_demo_patient: { Args: never; Returns: boolean }
      claim_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      consent_active: {
        Args: { _category: string; _pid: string }
        Returns: boolean
      }
      consultant_review: {
        Args: {
          _followup: boolean
          _note: string
          _pid: string
          _status: string
        }
        Returns: undefined
      }
      create_order: {
        Args: { _pharmacy: string; _prescription: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_patient_consultant: { Args: { _pid: string }; Returns: boolean }
      is_patient_insurer: { Args: { _pid: string }; Returns: boolean }
      is_patient_owner: { Args: { _pid: string }; Returns: boolean }
      is_patient_pharmacy: { Args: { _pid: string }; Returns: boolean }
      log_access: {
        Args: { _category: string; _pid: string; _purpose: string }
        Returns: undefined
      }
      my_org: {
        Args: { _type: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      onboard_patient: {
        Args: {
          _age: number
          _city: string
          _condition: string
          _consultant: string
          _gender: string
          _granted: string[]
          _insurer: string
          _name: string
        }
        Returns: string
      }
      reset_demo_patient: { Args: never; Returns: undefined }
      set_consent: {
        Args: { _category: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "patient" | "consultant" | "pharmacy" | "insurer" | "caregiver"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["patient", "consultant", "pharmacy", "insurer", "caregiver"],
    },
  },
} as const
