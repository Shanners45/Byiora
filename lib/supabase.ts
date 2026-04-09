import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? ""

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          email: string
          password_hash: string
          name: string
          role: "admin" | "sub_admin" | "order_management"
          status: "active" | "blocked"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          name: string
          role: "admin" | "sub_admin" | "order_management"
          status?: "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          name?: string
          role?: "admin" | "sub_admin" | "order_management"
          status?: "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          logo: string
          category: "topup" | "digital-goods"
          description: string | null
          is_active: boolean
          is_new: boolean
          has_update: boolean
          denominations: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          slug: string
          logo: string
          category: "topup" | "digital-goods"
          description?: string | null
          is_active?: boolean
          is_new?: boolean
          has_update?: boolean
          denominations?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo?: string
          category?: "topup" | "digital-goods"
          description?: string | null
          is_active?: boolean
          is_new?: boolean
          has_update?: boolean
          denominations?: any
          created_at?: string
          updated_at?: string
        }
      }
      payment_settings: {
        Row: {
          id: string
          instructions: string | null
          esewa_qr: string | null
          khalti_qr: string | null
          imepay_qr: string | null
          mobile_banking_qr: string | null
          created_at: string
        }
        Insert: {
          id?: string
          instructions?: string | null
          esewa_qr?: string | null
          khalti_qr?: string | null
          imepay_qr?: string | null
          mobile_banking_qr?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          instructions?: string | null
          esewa_qr?: string | null
          khalti_qr?: string | null
          imepay_qr?: string | null
          mobile_banking_qr?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string | null
          product_id: string | null
          product_name: string
          amount: string
          price: string
          status: "Completed" | "Failed" | "Processing" | "Cancelled"
          payment_method: string
          transaction_id: string
          user_email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          product_name: string
          amount: string
          price: string
          status?: "Completed" | "Failed" | "Processing" | "Cancelled"
          payment_method: string
          transaction_id: string
          user_email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          product_name?: string
          amount?: string
          price?: string
          status?: "Completed" | "Failed" | "Processing" | "Cancelled"
          payment_method?: string
          transaction_id?: string
          user_email?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
