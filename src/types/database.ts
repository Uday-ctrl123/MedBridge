export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      hospitals: {
        Row: {
          id: string
          name: string
          address: string | null
          city: string | null
          contact_email: string
          contact_person: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          city?: string | null
          contact_email: string
          contact_person?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          city?: string | null
          contact_email?: string
          contact_person?: string | null
          status?: 'active' | 'inactive'
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'hospital_user'
          hospital_id: string | null
          full_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'hospital_user'
          hospital_id?: string | null
          full_name?: string | null
          created_at?: string
        }
        Update: {
          role?: 'admin' | 'hospital_user'
          hospital_id?: string | null
          full_name?: string | null
        }
      }
      patients: {
        Row: {
          id: string
          hospital_id: string
          name: string
          date_of_birth: string | null
          contact: string | null
          enrollment_status: 'enrolled' | 'pending' | 'none'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hospital_id: string
          name: string
          date_of_birth?: string | null
          contact?: string | null
          enrollment_status?: 'enrolled' | 'pending' | 'none'
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          date_of_birth?: string | null
          contact?: string | null
          enrollment_status?: 'enrolled' | 'pending' | 'none'
          updated_at?: string
        }
      }
      temporary_records: {
        Row: {
          id: string
          mrn: string
          hospital_id: string
          placeholder_name: string
          approx_age: number | null
          approx_sex: string | null
          distinguishing_features: string | null
          current_tier: number
          status: 'open' | 'merged'
          admission_time: string
          created_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          mrn?: string
          hospital_id: string
          placeholder_name?: string
          approx_age?: number | null
          approx_sex?: string | null
          distinguishing_features?: string | null
          current_tier?: number
          status?: 'open' | 'merged'
          admission_time?: string
          created_by?: string | null
          updated_at?: string
        }
        Update: {
          placeholder_name?: string
          approx_age?: number | null
          approx_sex?: string | null
          distinguishing_features?: string | null
          current_tier?: number
          status?: 'open' | 'merged'
          updated_at?: string
        }
      }
      biometric_templates: {
        Row: {
          id: string
          patient_id: string
          hospital_id: string
          modality: 'face' | 'fingerprint' | 'iris'
          feature_vector: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          hospital_id: string
          modality: 'face' | 'fingerprint' | 'iris'
          feature_vector: string
          created_at?: string
        }
        Update: never
      }
      str_profiles: {
        Row: {
          id: string
          patient_id: string
          hospital_id: string
          marker_set: string
          enrolled_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          hospital_id: string
          marker_set: string
          enrolled_at?: string
        }
        Update: never
      }
      clinical_notes: {
        Row: {
          id: string
          record_id: string
          record_type: 'temporary' | 'verified'
          hospital_id: string
          note_type: 'vitals' | 'injuries' | 'treatment' | 'general'
          content: string
          author_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          record_id: string
          record_type: 'temporary' | 'verified'
          hospital_id: string
          note_type: 'vitals' | 'injuries' | 'treatment' | 'general'
          content: string
          author_id?: string | null
          created_at?: string
        }
        Update: never
      }
      identification_attempts: {
        Row: {
          id: string
          record_id: string
          hospital_id: string
          tier: number
          actor_id: string | null
          input_ref: string | null
          confidence_score: number | null
          outcome: 'matched' | 'no_match' | 'pending' | 'failed'
          method: string
          notes: string | null
          timestamp: string
        }
        Insert: {
          id?: string
          record_id: string
          hospital_id: string
          tier: number
          actor_id?: string | null
          input_ref?: string | null
          confidence_score?: number | null
          outcome: 'matched' | 'no_match' | 'pending' | 'failed'
          method: string
          notes?: string | null
          timestamp?: string
        }
        Update: never
      }
      merge_events: {
        Row: {
          id: string
          temp_record_id: string
          verified_patient_id: string
          hospital_id: string
          resolving_tier: number
          approved_by: string | null
          confidence_score: number
          timestamp: string
        }
        Insert: {
          id?: string
          temp_record_id: string
          verified_patient_id: string
          hospital_id: string
          resolving_tier: number
          approved_by?: string | null
          confidence_score: number
          timestamp?: string
        }
        Update: never
      }
      audit_log: {
        Row: {
          id: string
          hospital_id: string | null
          event_type: string
          actor_id: string | null
          record_ref: string | null
          payload_summary: Json | null
          timestamp: string
        }
        Insert: {
          id?: string
          hospital_id?: string | null
          event_type: string
          actor_id?: string | null
          record_ref?: string | null
          payload_summary?: Json | null
          timestamp?: string
        }
        Update: never
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

// Convenience row types
export type Hospital = Database['public']['Tables']['hospitals']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Patient = Database['public']['Tables']['patients']['Row']
export type TemporaryRecord = Database['public']['Tables']['temporary_records']['Row']
export type BiometricTemplate = Database['public']['Tables']['biometric_templates']['Row']
export type StrProfile = Database['public']['Tables']['str_profiles']['Row']
export type ClinicalNote = Database['public']['Tables']['clinical_notes']['Row']
export type IdentificationAttempt = Database['public']['Tables']['identification_attempts']['Row']
export type MergeEvent = Database['public']['Tables']['merge_events']['Row']
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row']
