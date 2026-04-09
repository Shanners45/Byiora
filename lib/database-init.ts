import { supabase } from "./supabase"

export interface DatabaseStatus {
  isConnected: boolean
  tablesExist: boolean
  hasData: boolean
  error?: string
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn("Supabase environment variables not configured:", {
      hasUrl: !!url,
      hasKey: !!key,
    })
    return false
  }

  return true
}

// Check database connectivity and table existence
export async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  if (!isSupabaseConfigured()) {
    return {
      isConnected: false,
      tablesExist: false,
      hasData: false,
      error: "Supabase not configured - missing environment variables",
    }
  }

  try {
    // Test basic connectivity
    const { data: connectionTest, error: connectionError } = await supabase
      .from("products")
      .select("count", { count: "exact", head: true })

    if (connectionError) {
      // Check if it's a table not found error
      if (connectionError.code === "42P01" || connectionError.message.includes("does not exist")) {
        return {
          isConnected: true,
          tablesExist: false,
          hasData: false,
          error: "Database tables do not exist - please run the setup scripts",
        }
      }

      return {
        isConnected: false,
        tablesExist: false,
        hasData: false,
        error: `Database connection failed: ${connectionError.message}`,
      }
    }

    // Check if we have data
    const { data: products, error: dataError } = await supabase.from("products").select("id").limit(1)

    if (dataError) {
      return {
        isConnected: true,
        tablesExist: true,
        hasData: false,
        error: `Error checking data: ${dataError.message}`,
      }
    }

    return {
      isConnected: true,
      tablesExist: true,
      hasData: products && products.length > 0,
    }
  } catch (error) {
    return {
      isConnected: false,
      tablesExist: false,
      hasData: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

// Initialize database with seed data if needed
export async function initializeDatabase(): Promise<boolean> {
  try {
    const status = await checkDatabaseStatus()

    if (!status.isConnected || !status.tablesExist) {
      console.error("Cannot initialize database:", status.error)
      return false
    }

    if (status.hasData) {
      console.log("Database already has data, skipping initialization")
      return true
    }

    console.log("Database is empty, this is expected on first run")
    console.log("Please run the seed script to populate initial data")
    return true
  } catch (error) {
    console.error("Error initializing database:", error)
    return false
  }
}

// Test all database operations
export async function testDatabaseOperations(): Promise<{
  success: boolean
  results: Record<string, boolean>
  errors: string[]
}> {
  const results: Record<string, boolean> = {}
  const errors: string[] = []

  try {
    // Test 1: Read products
    try {
      const { data, error } = await supabase.from("products").select("*").limit(1)
      results.readProducts = !error
      if (error) errors.push(`Read products: ${error.message}`)
    } catch (e) {
      results.readProducts = false
      errors.push(`Read products: ${e instanceof Error ? e.message : "Unknown error"}`)
    }

    // Test 2: Read users table structure
    try {
      const { data, error } = await supabase.from("users").select("*").limit(0)
      results.usersTable = !error
      if (error) errors.push(`Users table: ${error.message}`)
    } catch (e) {
      results.usersTable = false
      errors.push(`Users table: ${e instanceof Error ? e.message : "Unknown error"}`)
    }

    // Test 3: Read transactions table structure
    try {
      const { data, error } = await supabase.from("transactions").select("*").limit(0)
      results.transactionsTable = !error
      if (error) errors.push(`Transactions table: ${error.message}`)
    } catch (e) {
      results.transactionsTable = false
      errors.push(`Transactions table: ${e instanceof Error ? e.message : "Unknown error"}`)
    }

    const success = Object.values(results).every((result) => result === true)

    return { success, results, errors }
  } catch (error) {
    return {
      success: false,
      results,
      errors: [...errors, `General error: ${error instanceof Error ? error.message : "Unknown error"}`],
    }
  }
}
