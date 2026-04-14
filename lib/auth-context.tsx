"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { loginWithPassword, signupWithPassword, logoutUser } from "@/app/actions/auth"
import { addTransactionAction } from "@/app/actions/transactions"

interface User {
  id: string
  email: string
  name: string
}

interface Transaction {
  id: string
  product: string
  amount: string
  price: string
  status: "Completed" | "Failed" | "Processing" | "Cancelled"
  paymentMethod: string
  date: string
  transactionId: string
  email: string
  isGuest?: boolean
  guestData?: any
  giftcard_code?: string
  failure_remarks?: string
}

interface AuthContextType {
  user: User | null
  transactions: Transaction[]
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
  updateProfile: (name: string) => Promise<boolean>
  addTransaction: (
    transaction: Omit<Transaction, "id" | "date" | "transactionId"> & {
      productId?: string
      guestData?: any
    },
  ) => Promise<string>
  updateTransactionStatus: (transactionId: string, status: Transaction["status"]) => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          try {
            // Verify user still exists in Supabase and get latest data
            const { data: existingUser, error } = await supabase
              .from("users")
              .select("*")
              .eq("id", session.user.id)
              .single()

            if (existingUser && !error) {
              const updatedUser = {
                id: existingUser.id,
                email: existingUser.email,
                name: existingUser.name,
              }
              setUser(updatedUser)
              await loadTransactions(existingUser.id)
            }
          } catch (error) {
            console.error("Error confirming user record:", error)
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const loadTransactions = async (userId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading transactions:", error)
        return
      }

      const formattedTransactions = data.map((transaction: any) => ({
        id: transaction.id,
        product: transaction.product_name,
        amount: transaction.amount,
        price: transaction.price,
        status: transaction.status,
        paymentMethod: transaction.payment_method,
        date: transaction.created_at,
        transactionId: transaction.transaction_id,
        email: transaction.user_email,
        isGuest: false,
        giftcard_code: transaction.giftcard_code,
        failure_remarks: transaction.failure_remarks,
      }))

      setTransactions(formattedTransactions)
    } catch (error) {
      console.error("Error loading transactions:", error)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await loginWithPassword(email, password, "/")
      if (result.error || !result.data?.user) {
        toast.error(result.error || "Invalid credentials")
        return false
      }
      
      const supabase = createClient()
      const { data: existingUser, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", result.data.user.id)
        .single();
        
      if (userError || !existingUser) {
        toast.error("No account found with this email.");
        return false;
      }
      
      const userData: User = {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
      };
      
      setUser(userData);
      await loadTransactions(userData.id);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
      return false;
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      const result = await signupWithPassword(email, password, name)

      if (result.error) {
        toast.error(result.error || "Failed to create account. Please try again.");
        return false;
      }

      // After signup, we do login
      return await login(email, password)
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Failed to create account. Please try again.");
      return false;
    }
  };

  const updateProfile = async (name: string): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = createClient()
      const { error } = await supabase.from("users").update({ name: name.trim() }).eq("id", user.id)

      if (error) {
        console.error("Error updating profile:", error)
        return false
      }

      const updatedUser = { ...user, name: name.trim() }
      setUser(updatedUser)
      return true
    } catch (error) {
      console.error("Update profile error:", error)
      return false
    }
  }

  const logout = async () => {
    setUser(null)
    setTransactions([])
    await logoutUser("/")
  }


  const addTransaction = async (
    transactionData: Omit<Transaction, "id" | "date" | "transactionId"> & {
      productId?: string
      productCategory?: string
      guestData?: any
    },
  ): Promise<string> => {
    try {
      // Use Server Action with Service Role to bypass RLS
      const result = await addTransactionAction({
        ...transactionData,
        userId: user?.id || null,
      })

      if (!result.success || result.error) {
        throw new Error(result.error || "Failed to add transaction")
      }

      const data = result.data

      // Only update local state for logged-in users
      if (user && data) {
        const newTransaction: Transaction = {
          id: data.id,
          product: data.product_name,
          amount: data.amount,
          price: data.price,
          status: data.status,
          paymentMethod: data.payment_method,
          date: data.created_at,
          transactionId: data.transaction_id,
          email: data.user_email,
          isGuest: !data.user_id,
          guestData: data.guest_user_data,
          failure_remarks: data.failure_remarks,
        }
        setTransactions((prev) => [newTransaction, ...prev])
      }

      return result.transactionId!
    } catch (error) {
      console.error("Add transaction error:", error)
      throw error
    }
  }

  const updateTransactionStatus = async (transactionId: string, status: Transaction["status"]): Promise<void> => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("transactions").update({ status }).eq("transaction_id", transactionId)

      if (error) {
        console.error("Error updating transaction status:", error)
        throw new Error("Failed to update transaction status")
      }

      setTransactions((prev) =>
        prev.map((transaction) =>
          transaction.transactionId === transactionId ? { ...transaction, status } : transaction,
        ),
      )
    } catch (error) {
      console.error("Update transaction status error:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        transactions,
        isLoggedIn: !!user,
        login,
        signup,
        logout,
        updateProfile,
        addTransaction,
        updateTransactionStatus,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
