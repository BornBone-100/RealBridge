export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_resolved: boolean | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          reason?: string
          user_id?: string
        }
      }
      blocks: {
        Row: { blocked: string; blocker: string; created_at: string | null; id: string }
        Insert: { blocked: string; blocker: string; created_at?: string | null; id?: string }
        Update: { blocked?: string; blocker?: string; created_at?: string | null; id?: string }
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          is_blocked: boolean | null
          match_id: string
          original_lang: string
          original_text: string
          sender_id: string
          translated_lang: string | null
          translated_text: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_blocked?: boolean | null
          match_id: string
          original_lang: string
          original_text: string
          sender_id: string
          translated_lang?: string | null
          translated_text?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_blocked?: boolean | null
          match_id?: string
          original_lang?: string
          original_text?: string
          sender_id?: string
          translated_lang?: string | null
          translated_text?: string | null
        }
      }
      kyc_verifications: {
        Row: {
          confidence: number
          id: string
          id_hash: string
          id_type: Database['public']['Enums']['id_type'] | null
          selfie_hash: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          confidence: number
          id?: string
          id_hash: string
          id_type?: Database['public']['Enums']['id_type'] | null
          selfie_hash: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          confidence?: number
          id?: string
          id_hash?: string
          id_type?: Database['public']['Enums']['id_type'] | null
          selfie_hash?: string
          user_id?: string
          verified_at?: string | null
        }
      }
      like_quotas: {
        Row: { quota_date: string | null; updated_at: string | null; used: number | null; user_id: string }
        Insert: { quota_date?: string | null; updated_at?: string | null; used?: number | null; user_id: string }
        Update: { quota_date?: string | null; updated_at?: string | null; used?: number | null; user_id?: string }
      }
      likes: {
        Row: { created_at: string | null; from_user: string; id: string; to_user: string }
        Insert: { created_at?: string | null; from_user: string; id?: string; to_user: string }
        Update: { created_at?: string | null; from_user?: string; id?: string; to_user?: string }
      }
      matches: {
        Row: {
          created_at: string | null
          id: string
          match_score: number | null
          status: Database['public']['Enums']['match_status'] | null
          topic_id: string | null
          updated_at: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_score?: number | null
          status?: Database['public']['Enums']['match_status'] | null
          topic_id?: string | null
          updated_at?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string | null
          id?: string
          match_score?: number | null
          status?: Database['public']['Enums']['match_status'] | null
          topic_id?: string | null
          updated_at?: string | null
          user_a?: string
          user_b?: string
        }
      }
      reports: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          reason: Database['public']['Enums']['report_reason']
          reported_id: string
          reporter_id: string
          status: Database['public']['Enums']['report_status'] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason: Database['public']['Enums']['report_reason']
          reported_id: string
          reporter_id: string
          status?: Database['public']['Enums']['report_status'] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: Database['public']['Enums']['report_reason']
          reported_id?: string
          reporter_id?: string
          status?: Database['public']['Enums']['report_status'] | null
        }
      }
      scam_violations: {
        Row: {
          action: Database['public']['Enums']['scam_action'] | null
          created_at: string | null
          id: string
          matched_patterns: Json | null
          original_text: string | null
          room_id: string | null
          severity_score: number | null
          user_id: string
        }
        Insert: {
          action?: Database['public']['Enums']['scam_action'] | null
          created_at?: string | null
          id?: string
          matched_patterns?: Json | null
          original_text?: string | null
          room_id?: string | null
          severity_score?: number | null
          user_id: string
        }
        Update: {
          action?: Database['public']['Enums']['scam_action'] | null
          created_at?: string | null
          id?: string
          matched_patterns?: Json | null
          original_text?: string | null
          room_id?: string | null
          severity_score?: number | null
          user_id?: string
        }
      }
      topics: {
        Row: {
          category: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          title_ja: string | null
          title_ko: string
          title_zh: string | null
        }
        Insert: {
          category?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          title_ja?: string | null
          title_ko: string
          title_zh?: string | null
        }
        Update: {
          category?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          title_ja?: string | null
          title_ko?: string
          title_zh?: string | null
        }
      }
      users: {
        Row: {
          bio: string | null
          birth_year: number | null
          created_at: string | null
          dating_values: string | null
          device_fp: string | null
          gender: string | null
          id: string
          is_verified: boolean | null
          lifestyle_tags: string[] | null
          name: string | null
          nationality: Database['public']['Enums']['nationality_code']
          phone: string
          profile_photos: string[] | null
          status: Database['public']['Enums']['account_status'] | null
          tier: Database['public']['Enums']['tier_type'] | null
          updated_at: string | null
          voice_intro_url: string | null
        }
        Insert: {
          bio?: string | null
          birth_year?: number | null
          created_at?: string | null
          dating_values?: string | null
          device_fp?: string | null
          gender?: string | null
          id?: string
          is_verified?: boolean | null
          lifestyle_tags?: string[] | null
          name?: string | null
          nationality: Database['public']['Enums']['nationality_code']
          phone: string
          profile_photos?: string[] | null
          status?: Database['public']['Enums']['account_status'] | null
          tier?: Database['public']['Enums']['tier_type'] | null
          updated_at?: string | null
          voice_intro_url?: string | null
        }
        Update: {
          bio?: string | null
          birth_year?: number | null
          created_at?: string | null
          dating_values?: string | null
          device_fp?: string | null
          gender?: string | null
          id?: string
          is_verified?: boolean | null
          lifestyle_tags?: string[] | null
          name?: string | null
          nationality?: Database['public']['Enums']['nationality_code']
          phone?: string
          profile_photos?: string[] | null
          status?: Database['public']['Enums']['account_status'] | null
          tier?: Database['public']['Enums']['tier_type'] | null
          updated_at?: string | null
          voice_intro_url?: string | null
        }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      account_status: 'active' | 'pending' | 'suspended' | 'banned'
      id_type: 'passport' | 'resident_card' | 'drivers_license'
      match_status: 'pending' | 'matched' | 'locked' | 'unmatched' | 'blocked'
      nationality_code: 'KR' | 'JP' | 'TW'
      report_reason: 'spam' | 'fake_profile' | 'harassment' | 'inappropriate' | 'scam' | 'other'
      report_status: 'pending' | 'reviewed' | 'resolved'
      scam_action: 'pass' | 'warn' | 'block'
      tier_type: 'basic' | 'truenote'
    }
  }
}
