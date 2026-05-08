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
        Relationships: []
      }
      admin_users: {
        Row: {
          id: string
          email: string
          password_hash: string | null
          name: string
          role: "admin" | "sub_admin" | "order_management"
          status: "active" | "blocked"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash?: string | null
          name: string
          role: "admin" | "sub_admin" | "order_management"
          status?: "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string | null
          name?: string
          role?: "admin" | "sub_admin" | "order_management"
          status?: "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          logo: string
          category: "topup" | "digital-goods" | "games" | "direct-login"
          description: string | null
          is_active: boolean
          is_new: boolean | null
          has_update: boolean | null
          denominations: any
          denom_icon_url: string | null
          ribbon_text: string | null
          faqs: any | null
          checkout_fields: any | null
          uid_instructions: string | null
          uid_guide_image: string | null
          servers: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          slug: string
          logo: string
          category: "topup" | "digital-goods" | "games" | "direct-login"
          description?: string | null
          is_active?: boolean
          is_new?: boolean
          has_update?: boolean
          denominations?: any
          denom_icon_url?: string | null
          ribbon_text?: string | null
          faqs?: any | null
          checkout_fields?: any | null
          uid_instructions?: string | null
          uid_guide_image?: string | null
          servers?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo?: string
          category?: "topup" | "digital-goods" | "games" | "direct-login"
          description?: string | null
          is_active?: boolean
          is_new?: boolean
          has_update?: boolean
          denominations?: any
          denom_icon_url?: string | null
          ribbon_text?: string | null
          faqs?: any | null
          checkout_fields?: any | null
          uid_instructions?: string | null
          uid_guide_image?: string | null
          servers?: any | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }

      payment_methods: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          qr_url: string | null
          instructions: string | null
          is_enabled: boolean
          sort_order: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          qr_url?: string | null
          instructions?: string | null
          is_enabled?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          qr_url?: string | null
          instructions?: string | null
          is_enabled?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
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
          product_category: string | null
          guest_user_data: any | null
          giftcard_code: string | null
          failure_remarks: string | null
          encrypted_checkout_data: string | null
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
          product_category?: string | null
          guest_user_data?: any | null
          giftcard_code?: string | null
          failure_remarks?: string | null
          encrypted_checkout_data?: string | null
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
          product_category?: string | null
          guest_user_data?: any | null
          giftcard_code?: string | null
          failure_remarks?: string | null
          encrypted_checkout_data?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      banners: {
        Row: {
          id: string
          title: string | null
          image_url: string | null
          link_url: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title?: string | null
          image_url?: string | null
          link_url?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string | null
          image_url?: string | null
          link_url?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }

      homepage_categories: {
        Row: {
          id: string
          title: string
          sort_order: number
          product_ids: string[] | null
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          sort_order?: number
          product_ids?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          sort_order?: number
          product_ids?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }

      notifications: {
        Row: {
          id: string
          title: string
          message: string
          type: "info" | "success" | "warning" | "error"
          user_id: string | null
          is_read: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          message: string
          type: "info" | "success" | "warning" | "error"
          user_id?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          message?: string
          type?: "info" | "success" | "warning" | "error"
          user_id?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
