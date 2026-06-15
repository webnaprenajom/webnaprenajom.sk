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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      commissions: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          implementer: string
          note: string | null
          payment_status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          implementer: string
          note?: string | null
          payment_status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          implementer?: string
          note?: string | null
          payment_status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      design_proposals: {
        Row: {
          client_name: string
          created_at: string
          design_url: string | null
          email: string | null
          id: string
          notes: string | null
          sent_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          design_url?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          sent_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          design_url?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          sent_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          id: string
          note: string | null
          payment_status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          payment_status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          payment_status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_logs: {
        Row: {
          action: string
          changed_by_email: string | null
          changed_by_id: string | null
          created_at: string
          field: string | null
          id: string
          lead_email: string | null
          lead_id: string | null
          lead_name: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_by_email?: string | null
          changed_by_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          lead_email?: string | null
          lead_id?: string | null
          lead_name?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_by_email?: string | null
          changed_by_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          lead_email?: string | null
          lead_id?: string | null
          lead_name?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          amount: number | null
          assigned_to: string | null
          consultation_date: string | null
          consultation_time: string | null
          created_at: string
          email: string
          follow_up_date: string | null
          id: string
          import_batch: string | null
          imported: boolean
          language: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          status_changed_at: string | null
          temperature: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          consultation_date?: string | null
          consultation_time?: string | null
          created_at?: string
          email: string
          follow_up_date?: string | null
          id?: string
          import_batch?: string | null
          imported?: boolean
          language?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          temperature?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          consultation_date?: string | null
          consultation_time?: string | null
          created_at?: string
          email?: string
          follow_up_date?: string | null
          id?: string
          import_batch?: string | null
          imported?: boolean
          language?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          temperature?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      order_signatures: {
        Row: {
          address: string | null
          agreed_terms: boolean
          client_name: string
          company: string | null
          contract_months: number
          created_at: string
          dic: string | null
          email: string
          ico: string | null
          id: string
          ip_address: string | null
          notes: string | null
          package_name: string | null
          phone: string | null
          plan: string
          price: number
          signature_name: string
          signed_at: string
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          address?: string | null
          agreed_terms?: boolean
          client_name: string
          company?: string | null
          contract_months?: number
          created_at?: string
          dic?: string | null
          email: string
          ico?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          package_name?: string | null
          phone?: string | null
          plan?: string
          price?: number
          signature_name: string
          signed_at?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          address?: string | null
          agreed_terms?: boolean
          client_name?: string
          company?: string | null
          contract_months?: number
          created_at?: string
          dic?: string | null
          email?: string
          ico?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          package_name?: string | null
          phone?: string | null
          plan?: string
          price?: number
          signature_name?: string
          signed_at?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          notes: string | null
          password: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          password?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          password?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: []
      }
      rental_payments: {
        Row: {
          amount: number
          created_at: string
          custom_price: number | null
          id: string
          month: number
          paid: boolean
          paid_at: string | null
          status: string
          updated_at: string
          website_id: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          custom_price?: number | null
          id?: string
          month: number
          paid?: boolean
          paid_at?: string | null
          status?: string
          updated_at?: string
          website_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          custom_price?: number | null
          id?: string
          month?: number
          paid?: boolean
          paid_at?: string | null
          status?: string
          updated_at?: string
          website_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "rental_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_websites: {
        Row: {
          client_name: string | null
          created_at: string
          credits_used: number
          id: string
          implementers: Json
          monthly_price: number
          name: string
          note: string | null
          rental_start_date: string | null
          source: string | null
          updated_at: string
          url: string | null
          year: number
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          credits_used?: number
          id?: string
          implementers?: Json
          monthly_price?: number
          name: string
          note?: string | null
          rental_start_date?: string | null
          source?: string | null
          updated_at?: string
          url?: string | null
          year?: number
        }
        Update: {
          client_name?: string | null
          created_at?: string
          credits_used?: number
          id?: string
          implementers?: Json
          monthly_price?: number
          name?: string
          note?: string | null
          rental_start_date?: string | null
          source?: string | null
          updated_at?: string
          url?: string | null
          year?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          amount: number
          assignee: string | null
          client_name: string | null
          created_at: string
          deposit: number
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          assignee?: string | null
          client_name?: string | null
          created_at?: string
          deposit?: number
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assignee?: string | null
          client_name?: string | null
          created_at?: string
          deposit?: number
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title?: string
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
      wheel_spins: {
        Row: {
          coupon_code: string | null
          created_at: string
          email: string
          id: string
          ip_address: string | null
          language: string
          name: string | null
          notes: string | null
          phone: string | null
          prize_label: string
          prize_value: number
          redeemed: boolean
          redeemed_at: string | null
          reminder_sent_at: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          language?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          prize_label: string
          prize_value?: number
          redeemed?: boolean
          redeemed_at?: string | null
          reminder_sent_at?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          language?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          prize_label?: string
          prize_value?: number
          redeemed?: boolean
          redeemed_at?: string | null
          reminder_sent_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
