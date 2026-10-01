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
          status: "Completed" | "Failed" | "Processing" | "Cancelled" | "Payment Pending" | "Paid" | "Payment Failed" | "Expired" | "Refunded"
          payment_method: string
          transaction_id: string
          user_email: string
          product_category: string | null
          payment_category: string | null
          guest_user_data: any | null
          giftcard_code: string | null
          failure_remarks: string | null
          encrypted_checkout_data: string | null
          bank_txn_id: string | null
          validation_trace_id: string | null
          promo_code: string | null
          discount_amount: number | null
          original_price: number | null
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
          status?: "Completed" | "Failed" | "Processing" | "Cancelled" | "Payment Pending" | "Paid" | "Payment Failed" | "Expired" | "Refunded"
          payment_method: string
          transaction_id: string
          user_email: string
          product_category?: string | null
          payment_category?: string | null
          guest_user_data?: any | null
          giftcard_code?: string | null
          failure_remarks?: string | null
          encrypted_checkout_data?: string | null
          bank_txn_id?: string | null
          validation_trace_id?: string | null
          promo_code?: string | null
          discount_amount?: number | null
          original_price?: number | null
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
          status?: "Completed" | "Failed" | "Processing" | "Cancelled" | "Payment Pending" | "Paid" | "Payment Failed" | "Expired" | "Refunded"
          payment_method?: string
          transaction_id?: string
          user_email?: string
          product_category?: string | null
          payment_category?: string | null
          guest_user_data?: any | null
          giftcard_code?: string | null
          failure_remarks?: string | null
          encrypted_checkout_data?: string | null
          bank_txn_id?: string | null
          validation_trace_id?: string | null
          promo_code?: string | null
          discount_amount?: number | null
          original_price?: number | null
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

      gift_card_inventory: {
        Row: {
          id: string
          product_id: string
          denomination_label: string
          encrypted_code: string
          code_hash: string
          status: "AVAILABLE" | "DELIVERED" | "REVOKED"
          added_by: string | null
          claimed_by_transaction_id: string | null
          claimed_at: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          denomination_label: string
          encrypted_code: string
          code_hash: string
          status?: "AVAILABLE" | "DELIVERED" | "REVOKED"
          added_by?: string | null
          claimed_by_transaction_id?: string | null
          claimed_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          denomination_label?: string
          encrypted_code?: string
          code_hash?: string
          status?: "AVAILABLE" | "DELIVERED" | "REVOKED"
          added_by?: string | null
          claimed_by_transaction_id?: string | null
          claimed_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }

      promo_codes: {
        Row: {
          id: string
          code: string
          description: string | null
          discount_type: "percentage" | "fixed"
          discount_value: number
          max_discount: number | null
          min_order_amount: number
          usage_limit: number | null
          usage_count: number
          per_user_limit: number
          starts_at: string
          expires_at: string | null
          applicable_products: string[] | null
          applicable_categories: string[] | null
          excluded_products: string[] | null
          first_order_only: boolean
          registered_only: boolean
          new_user_only: boolean
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          discount_type: "percentage" | "fixed"
          discount_value: number
          max_discount?: number | null
          min_order_amount?: number
          usage_limit?: number | null
          usage_count?: number
          per_user_limit?: number
          starts_at?: string
          expires_at?: string | null
          applicable_products?: string[] | null
          applicable_categories?: string[] | null
          excluded_products?: string[] | null
          first_order_only?: boolean
          registered_only?: boolean
          new_user_only?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          discount_type?: "percentage" | "fixed"
          discount_value?: number
          max_discount?: number | null
          min_order_amount?: number
          usage_limit?: number | null
          usage_count?: number
          per_user_limit?: number
          starts_at?: string
          expires_at?: string | null
          applicable_products?: string[] | null
          applicable_categories?: string[] | null
          excluded_products?: string[] | null
          first_order_only?: boolean
          registered_only?: boolean
          new_user_only?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      promo_code_usage: {
        Row: {
          id: string
          promo_code_id: string
          code: string
          user_email: string
          user_id: string | null
          transaction_id: string
          product_id: string | null
          original_price: number
          discount_amount: number
          final_price: number
          ip_address: string | null
          device_id: string | null
          used_at: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          code: string
          user_email: string
          user_id?: string | null
          transaction_id: string
          product_id?: string | null
          original_price: number
          discount_amount: number
          final_price: number
          ip_address?: string | null
          device_id?: string | null
          used_at?: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          code?: string
          user_email?: string
          user_id?: string | null
          transaction_id?: string
          product_id?: string | null
          original_price?: number
          discount_amount?: number
          final_price?: number
          ip_address?: string | null
          device_id?: string | null
          used_at?: string
        }
        Relationships: []
      }

      store_announcements: {
        Row: {
          id: string
          title: string
          message: string
          type: "banner" | "modal" | string
          theme: string
          link_url: string | null
          link_text: string | null
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          message: string
          type?: "banner" | "modal" | string
          theme: string
          link_url?: string | null
          link_text?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          message?: string
          type?: "banner" | "modal" | string
          theme?: string
          link_url?: string | null
          link_text?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }

      banned_entities: {
        Row: {
          id: string
          type: "email" | "ip" | "email_domain" | "device_id"
          value: string
          reason: string | null
          banned_by: string | null
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          type: "email" | "ip" | "email_domain" | "device_id"
          value: string
          reason?: string | null
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          type?: "email" | "ip" | "email_domain" | "device_id"
          value?: string
          reason?: string | null
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }

      support_tickets: {
        Row: {
          id: string
          ticket_number: string
          name: string | null
          email: string
          subject: string
          message: string
          status: "open" | "replied" | "resolved" | "closed"
          created_at: string
          replied_at: string | null
          last_reply: string | null
          last_reply_by: string | null
        }
        Insert: {
          id?: string
          ticket_number: string
          name?: string | null
          email: string
          subject: string
          message: string
          status?: "open" | "replied" | "resolved" | "closed"
          created_at?: string
          replied_at?: string | null
          last_reply?: string | null
          last_reply_by?: string | null
        }
        Update: {
          id?: string
          ticket_number?: string
          name?: string | null
          email?: string
          subject?: string
          message?: string
          status?: "open" | "replied" | "resolved" | "closed"
          created_at?: string
          replied_at?: string | null
          last_reply?: string | null
          last_reply_by?: string | null
        }
        Relationships: []
      }

      payment_credentials: {
        Row: {
          id: string
          provider: string
          encrypted_username: string
          encrypted_password: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          provider: string
          encrypted_username: string
          encrypted_password: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          provider?: string
          encrypted_username?: string
          encrypted_password?: string
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
