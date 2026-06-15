export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          match_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      concierge_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_from_admin: boolean
          is_read: boolean
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          is_read?: boolean
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          is_read?: boolean
          user_id?: string
        }
        Relationships: []
      }
      date_milestones: {
        Row: {
          completed_at: string | null
          completed_by_a: boolean
          completed_by_b: boolean
          confirmed_at: string | null
          confirmed_by_a: boolean
          confirmed_by_b: boolean
          confirmed_datetime: string | null
          confirmed_location: string | null
          created_at: string
          feedback_sent_at: string | null
          id: string
          match_id: string
          milestone_no: number
          proposed_at: string | null
          proposed_by: string | null
          proposed_datetime: string | null
          proposed_location: string | null
          status: Database["public"]["Enums"]["milestone_status"]
        }
        Insert: {
          completed_at?: string | null
          completed_by_a?: boolean
          completed_by_b?: boolean
          confirmed_at?: string | null
          confirmed_by_a?: boolean
          confirmed_by_b?: boolean
          confirmed_datetime?: string | null
          confirmed_location?: string | null
          created_at?: string
          feedback_sent_at?: string | null
          id?: string
          match_id: string
          milestone_no: number
          proposed_at?: string | null
          proposed_by?: string | null
          proposed_datetime?: string | null
          proposed_location?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
        }
        Update: {
          completed_at?: string | null
          completed_by_a?: boolean
          completed_by_b?: boolean
          confirmed_at?: string | null
          confirmed_by_a?: boolean
          confirmed_by_b?: boolean
          confirmed_datetime?: string | null
          confirmed_location?: string | null
          created_at?: string
          feedback_sent_at?: string | null
          id?: string
          match_id?: string
          milestone_no?: number
          proposed_at?: string | null
          proposed_by?: string | null
          proposed_datetime?: string | null
          proposed_location?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
        }
        Relationships: []
      }
      feedback_surveys: {
        Row: {
          answered_at: string | null
          created_at: string
          free_comment: string | null
          id: string
          is_answered: boolean
          milestone_id: string
          sent_at: string | null
          sentiment: Database["public"]["Enums"]["feedback_sentiment"] | null
          stop_reason: string | null
          user_id: string
          want_next_date: boolean | null
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          free_comment?: string | null
          id?: string
          is_answered?: boolean
          milestone_id: string
          sent_at?: string | null
          sentiment?: Database["public"]["Enums"]["feedback_sentiment"] | null
          stop_reason?: string | null
          user_id: string
          want_next_date?: boolean | null
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          free_comment?: string | null
          id?: string
          is_answered?: boolean
          milestone_id?: string
          sent_at?: string | null
          sentiment?: Database["public"]["Enums"]["feedback_sentiment"] | null
          stop_reason?: string | null
          user_id?: string
          want_next_date?: boolean | null
        }
        Relationships: []
      }
      icebreaker_cards: {
        Row: {
          category: string
          id: string
          is_active: boolean
          question: string
        }
        Insert: {
          category?: string
          id?: string
          is_active?: boolean
          question: string
        }
        Update: {
          category?: string
          id?: string
          is_active?: boolean
          question?: string
        }
        Relationships: []
      }
      like_quotas: {
        Row: {
          daily_limit: number
          reset_at: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          daily_limit?: number
          reset_at?: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          daily_limit?: number
          reset_at?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          admin_note: string | null
          closed_at: string | null
          id: string
          matched_at: string
          meetings_done: number
          state: Database["public"]["Enums"]["match_state"]
          stop_reason: string | null
          stopped_by: string | null
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          admin_note?: string | null
          closed_at?: string | null
          id?: string
          matched_at?: string
          meetings_done?: number
          state?: Database["public"]["Enums"]["match_state"]
          stop_reason?: string | null
          stopped_by?: string | null
          user_a_id: string
          user_b_id: string
        }
        Update: {
          admin_note?: string | null
          closed_at?: string | null
          id?: string
          matched_at?: string
          meetings_done?: number
          state?: Database["public"]["Enums"]["match_state"]
          stop_reason?: string | null
          stopped_by?: string | null
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          completed_at: string | null
          confirmed_by_a: boolean
          confirmed_by_b: boolean
          created_at: string
          id: string
          location: string | null
          match_id: string
          meeting_number: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["meeting_status"]
        }
        Insert: {
          completed_at?: string | null
          confirmed_by_a?: boolean
          confirmed_by_b?: boolean
          created_at?: string
          id?: string
          location?: string | null
          match_id: string
          meeting_number: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
        }
        Update: {
          completed_at?: string | null
          confirmed_by_a?: boolean
          confirmed_by_b?: boolean
          created_at?: string
          id?: string
          location?: string | null
          match_id?: string
          meeting_number?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
        }
        Relationships: []
      }
      payments: {
        Row: {
          created_at: string
          deposit_amount: number
          id: string
          paid_at: string | null
          portone_payment_id: string | null
          portone_receipt_url: string | null
          portone_tx_id: string | null
          refund_reason: string | null
          refunded_amount: number | null
          refunded_at: string | null
          service_fee: number
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number
          id?: string
          paid_at?: string | null
          portone_payment_id?: string | null
          portone_receipt_url?: string | null
          portone_tx_id?: string | null
          refund_reason?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          service_fee?: number
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number
          id?: string
          paid_at?: string | null
          portone_payment_id?: string | null
          portone_receipt_url?: string | null
          portone_tx_id?: string | null
          refund_reason?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          service_fee?: number
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      surveys: {
        Row: {
          busan_district: string | null
          created_at: string
          date_styles: string[] | null
          dealbreakers: string | null
          hobbies: string[] | null
          id: string
          ideal_contact_freq: string | null
          mbti: Database["public"]["Enums"]["mbti_type"] | null
          personality_tags: string[] | null
          relationship_goal: string | null
          self_intro: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          busan_district?: string | null
          created_at?: string
          date_styles?: string[] | null
          dealbreakers?: string | null
          hobbies?: string[] | null
          id?: string
          ideal_contact_freq?: string | null
          mbti?: Database["public"]["Enums"]["mbti_type"] | null
          personality_tags?: string[] | null
          relationship_goal?: string | null
          self_intro?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          busan_district?: string | null
          created_at?: string
          date_styles?: string[] | null
          dealbreakers?: string | null
          hobbies?: string[] | null
          id?: string
          ideal_contact_freq?: string | null
          mbti?: Database["public"]["Enums"]["mbti_type"] | null
          personality_tags?: string[] | null
          relationship_goal?: string | null
          self_intro?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          bio: string | null
          birth_year: number
          company_name: string | null
          contact_freq: string | null
          created_at: string
          date_styles: string[] | null
          district: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          hobbies: string[] | null
          id: string
          is_active: boolean
          is_deposit_paid: boolean
          mbti: string | null
          name: string
          occupation: string | null
          phone: string
          profile_photo_url: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          bio?: string | null
          birth_year?: number
          company_name?: string | null
          contact_freq?: string | null
          created_at?: string
          date_styles?: string[] | null
          district?: string | null
          gender?: Database["public"]["Enums"]["gender_type"]
          hobbies?: string[] | null
          id?: string
          is_active?: boolean
          is_deposit_paid?: boolean
          mbti?: string | null
          name?: string
          occupation?: string | null
          phone?: string
          profile_photo_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          bio?: string | null
          birth_year?: number
          company_name?: string | null
          contact_freq?: string | null
          created_at?: string
          date_styles?: string[] | null
          district?: string | null
          gender?: Database["public"]["Enums"]["gender_type"]
          hobbies?: string[] | null
          id?: string
          is_active?: boolean
          is_deposit_paid?: boolean
          mbti?: string | null
          name?: string
          occupation?: string | null
          phone?: string
          profile_photo_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      verification_documents: {
        Row: {
          admin_note: string | null
          business_card_path: string | null
          business_card_url: string | null
          created_at: string
          id: string
          id_card_storage_path: string | null
          id_card_url: string | null
          income_proof_path: string | null
          income_proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          user_id: string
          work_email: string | null
          work_email_code: string | null
          work_email_expires_at: string | null
          work_email_verified: boolean
        }
        Insert: {
          admin_note?: string | null
          business_card_path?: string | null
          business_card_url?: string | null
          created_at?: string
          id?: string
          id_card_storage_path?: string | null
          id_card_url?: string | null
          income_proof_path?: string | null
          income_proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id: string
          work_email?: string | null
          work_email_code?: string | null
          work_email_expires_at?: string | null
          work_email_verified?: boolean
        }
        Update: {
          admin_note?: string | null
          business_card_path?: string | null
          business_card_url?: string | null
          created_at?: string
          id?: string
          id_card_storage_path?: string | null
          id_card_url?: string | null
          income_proof_path?: string | null
          income_proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id?: string
          work_email?: string | null
          work_email_code?: string | null
          work_email_expires_at?: string | null
          work_email_verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      user_active_matches: {
        Row: {
          match_id: string | null
          matched_at: string | null
          meetings_done: number | null
          state: Database["public"]["Enums"]["match_state"] | null
          user_a_id: string | null
          user_b_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_match: { Args: { p_user_id: string }; Returns: boolean }
      upsert_like_quota: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      deposit_status: "pending" | "held" | "released" | "refunded"
      feedback_sentiment: "up" | "stay" | "down"
      gender_type: "male" | "female"
      match_state:
        | "waiting"
        | "active"
        | "success"
        | "stopped_no_fault"
        | "stopped_fault"
        | "cancelled"
      mbti_type:
        | "INTJ"
        | "INTP"
        | "ENTJ"
        | "ENTP"
        | "INFJ"
        | "INFP"
        | "ENFJ"
        | "ENFP"
        | "ISTJ"
        | "ISFJ"
        | "ESTJ"
        | "ESFJ"
        | "ISTP"
        | "ISFP"
        | "ESTP"
        | "ESFP"
      meeting_status: "scheduled" | "completed" | "cancelled"
      milestone_status:
        | "pending"
        | "proposed"
        | "confirmed"
        | "completed"
        | "cancelled"
      payment_status:
        | "pending"
        | "paid"
        | "fee_only"
        | "refunded"
        | "fully_released"
      verification_status: "pending" | "approved" | "rejected"
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
