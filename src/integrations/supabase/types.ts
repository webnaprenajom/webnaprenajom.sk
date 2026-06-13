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
      commission_rule_overrides: {
        Row: {
          active: boolean
          client_name: string | null
          created_at: string
          customer_email: string | null
          id: string
          override_rate: number
          reason: string | null
          rental_website_id: string | null
          revenue_stream_kind: string | null
          rule_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_name?: string | null
          created_at?: string
          customer_email?: string | null
          id?: string
          override_rate: number
          reason?: string | null
          rental_website_id?: string | null
          revenue_stream_kind?: string | null
          rule_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_name?: string | null
          created_at?: string
          customer_email?: string | null
          id?: string
          override_rate?: number
          reason?: string | null
          rental_website_id?: string | null
          revenue_stream_kind?: string | null
          rule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rule_overrides_rental_website_id_fkey"
            columns: ["rental_website_id"]
            isOneToOne: false
            referencedRelation: "rental_websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rule_overrides_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          active: boolean
          created_at: string
          default_rate: number
          id: string
          implementer: string | null
          name: string
          note: string | null
          revenue_stream_kind: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_rate?: number
          id?: string
          implementer?: string | null
          name: string
          note?: string | null
          revenue_stream_kind: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_rate?: number
          id?: string
          implementer?: string | null
          name?: string
          note?: string | null
          revenue_stream_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_id: string | null
          date: string
          id: string
          implementer: string
          note: string | null
          payment_form: string | null
          payment_status: string
          source_id: string | null
          source_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          implementer: string
          note?: string | null
          payment_form?: string | null
          payment_status?: string
          source_id?: string | null
          source_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          implementer?: string
          note?: string | null
          payment_form?: string | null
          payment_status?: string
          source_id?: string | null
          source_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_events: {
        Row: {
          body_preview: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          id: string
          in_reply_to: string | null
          kind: string
          message_id: string | null
          metadata: Json
          occurred_at: string
          recipient_email: string | null
          sender_email: string | null
          source_id: string | null
          source_table: string | null
          thread_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          id?: string
          in_reply_to?: string | null
          kind: string
          message_id?: string | null
          metadata?: Json
          occurred_at?: string
          recipient_email?: string | null
          sender_email?: string | null
          source_id?: string | null
          source_table?: string | null
          thread_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          id?: string
          in_reply_to?: string | null
          kind?: string
          message_id?: string | null
          metadata?: Json
          occurred_at?: string
          recipient_email?: string | null
          sender_email?: string | null
          source_id?: string | null
          source_table?: string | null
          thread_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_webhook_incidents: {
        Row: {
          created_at: string
          customer_email: string | null
          id: string
          incident_type: string
          metadata: Json
          occurred_at: string
          provider_email_id: string | null
          sender_email: string | null
          summary: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          id?: string
          incident_type: string
          metadata?: Json
          occurred_at?: string
          provider_email_id?: string | null
          sender_email?: string | null
          summary: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          id?: string
          incident_type?: string
          metadata?: Json
          occurred_at?: string
          provider_email_id?: string | null
          sender_email?: string | null
          summary?: string
        }
        Relationships: []
      }
      cost_records: {
        Row: {
          amount: number
          category: string | null
          client_name: string | null
          created_at: string
          currency: string
          id: string
          imported_from: string | null
          incurred_at: string | null
          note: string | null
          paid_at: string | null
          reference: string | null
          rental_website_id: string | null
          source_id: string | null
          source_table: string | null
          truth_level: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          imported_from?: string | null
          incurred_at?: string | null
          note?: string | null
          paid_at?: string | null
          reference?: string | null
          rental_website_id?: string | null
          source_id?: string | null
          source_table?: string | null
          truth_level?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          imported_from?: string | null
          incurred_at?: string | null
          note?: string | null
          paid_at?: string | null
          reference?: string | null
          rental_website_id?: string | null
          source_id?: string | null
          source_table?: string | null
          truth_level?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_records_rental_website_id_fkey"
            columns: ["rental_website_id"]
            isOneToOne: false
            referencedRelation: "rental_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communication_summaries: {
        Row: {
          customer_id: string
          key_decisions: Json
          last_event_at: string | null
          next_steps: Json
          rolling_summary: string | null
          unresolved_topics: Json
          updated_at: string
        }
        Insert: {
          customer_id: string
          key_decisions?: Json
          last_event_at?: string | null
          next_steps?: Json
          rolling_summary?: string | null
          unresolved_topics?: Json
          updated_at?: string
        }
        Update: {
          customer_id?: string
          key_decisions?: Json
          last_event_at?: string | null
          next_steps?: Json
          rolling_summary?: string | null
          unresolved_topics?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_communication_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          metadata?: Json
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
      finance_issue_dismissals: {
        Row: {
          created_at: string
          created_by: string | null
          dismissal_type: string
          id: string
          issue_key: string
          issue_type: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dismissal_type?: string
          id?: string
          issue_key: string
          issue_type: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dismissal_type?: string
          id?: string
          issue_key?: string
          issue_type?: string
          reason?: string | null
        }
        Relationships: []
      }
      finance_policy_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active_default: boolean
          label: string
          policy_key: string
          policy_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active_default?: boolean
          label: string
          policy_key: string
          policy_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active_default?: boolean
          label?: string
          policy_key?: string
          policy_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_review_items: {
        Row: {
          created_at: string
          id: string
          item_key: string
          item_type: string
          review_cadence_days: number
          review_due_at: string | null
          review_note: string | null
          reviewed_at: string | null
          snoozed_until: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          item_type: string
          review_cadence_days?: number
          review_due_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          item_type?: string
          review_cadence_days?: number
          review_due_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hosting_records: {
        Row: {
          acquired_by: string | null
          active: boolean
          client_name: string | null
          commission_rule_override_id: string | null
          commissionable: boolean
          created_at: string
          customer_email: string | null
          customer_id: string | null
          domains_count: number | null
          id: string
          monthly_price: number | null
          note: string | null
          operating_cost: number
          provider: string | null
          rental_website_id: string | null
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          acquired_by?: string | null
          active?: boolean
          client_name?: string | null
          commission_rule_override_id?: string | null
          commissionable?: boolean
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          domains_count?: number | null
          id?: string
          monthly_price?: number | null
          note?: string | null
          operating_cost?: number
          provider?: string | null
          rental_website_id?: string | null
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          acquired_by?: string | null
          active?: boolean
          client_name?: string | null
          commission_rule_override_id?: string | null
          commissionable?: boolean
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          domains_count?: number | null
          id?: string
          monthly_price?: number | null
          note?: string | null
          operating_cost?: number
          provider?: string | null
          rental_website_id?: string | null
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hosting_records_commission_rule_override_id_fkey"
            columns: ["commission_rule_override_id"]
            isOneToOne: false
            referencedRelation: "commission_rule_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_records_rental_website_id_fkey"
            columns: ["rental_website_id"]
            isOneToOne: false
            referencedRelation: "rental_websites"
            referencedColumns: ["id"]
          },
        ]
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
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      payment_records: {
        Row: {
          amount: number
          client_name: string | null
          created_at: string
          currency: string
          customer_email: string | null
          id: string
          imported_from: string | null
          method: string | null
          note: string | null
          paid_at: string
          reference: string | null
          rental_website_id: string | null
          source_id: string | null
          source_table: string | null
          truth_level: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_name?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: string
          imported_from?: string | null
          method?: string | null
          note?: string | null
          paid_at: string
          reference?: string | null
          rental_website_id?: string | null
          source_id?: string | null
          source_table?: string | null
          truth_level?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_name?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: string
          imported_from?: string | null
          method?: string | null
          note?: string | null
          paid_at?: string
          reference?: string | null
          rental_website_id?: string | null
          source_id?: string | null
          source_table?: string | null
          truth_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_rental_website_id_fkey"
            columns: ["rental_website_id"]
            isOneToOne: false
            referencedRelation: "rental_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_records: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          implementer: string | null
          imported_from: string | null
          note: string | null
          paid_at: string
          reference: string | null
          source_id: string | null
          source_table: string | null
          truth_level: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          implementer?: string | null
          imported_from?: string | null
          note?: string | null
          paid_at: string
          reference?: string | null
          source_id?: string | null
          source_table?: string | null
          truth_level?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          implementer?: string | null
          imported_from?: string | null
          note?: string | null
          paid_at?: string
          reference?: string | null
          source_id?: string | null
          source_table?: string | null
          truth_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          client_name: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          operating_cost: number
          password: string | null
          project_type: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          operating_cost?: number
          password?: string | null
          project_type?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          operating_cost?: number
          password?: string | null
          project_type?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "rental_websites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          amount: number
          assignee: string | null
          client_name: string | null
          created_at: string
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          implementer_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          implementer_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          implementer_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_accounts: {
        Row: {
          config: Json
          created_at: string
          email_address: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          email_address: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          email_address?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
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
