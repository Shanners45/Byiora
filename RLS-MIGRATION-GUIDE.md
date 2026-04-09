# RLS Migration Guide - Byiora

## Overview
This guide outlines the steps to safely enable Row Level Security (RLS) without breaking the Next.js application.

## Prerequisites

### Environment Variables
Add to your `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**IMPORTANT**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS completely. Never expose it to the browser.

---

## Step 1: Apply SQL Policies

Run the SQL script in Supabase SQL Editor:
```sql
-- File: supabase/rls-policies.sql
-- This enables RLS and creates policies for all tables
```

### What the SQL does:
1. **Enables RLS** on all tables
2. **Creates policies** for:
   - Public read access to products, banners, categories
   - Guest checkout (anon INSERT on transactions)
   - Registered user isolation (auth.uid() = user_id)
   - Force RLS even for table owners

---

## Step 2: Update Server Actions to Use Service Role

### Files that MUST use Service Role Client:

#### 1. `app/actions/admin.ts`
**Current**: Uses regular `createClient()`  
**Change to**: `createServiceRoleClient()`

```typescript
"use server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function deleteAdminUserAction(userId: string) {
  const supabase = createServiceRoleClient() // Bypasses RLS
  // ... rest of the code
}
```

#### 2. `app/actions/customisation.ts`
**Current**: Uses regular `createClient()`  
**Change to**: `createServiceRoleClient()`

Functions to update:
- `addBannerAction`
- `updateBannerAction`
- `addCategoryAction`
- `updateCategoryTitleAction`

#### 3. `lib/product-categories.ts`
**Functions requiring Service Role**:
- `deleteProduct()`
- `updateProductStatus()`
- `updateProduct()`

**Note**: Read operations (`getAllProducts`, `getProductById`, etc.) can stay as-is since they use the public anon key and the products table has a public read policy.

#### 4. Admin Dashboard Pages

**`app/admin/dashboard/orders/page.tsx`**:
- `updateTransactionStatus()` - uses Service Role for status updates
- `handleSendGiftcardCode()` - uses Service Role for updating transaction

**`app/admin/dashboard/products/page.tsx`**:
- `confirmDelete()` - uses Service Role for delete
- `toggleProductStatus()` - uses Service Role for update

**`app/admin/dashboard/products/[id]/page.tsx`**:
- Save product operations - use Service Role

**`app/admin/dashboard/products/add/page.tsx`**:
- Add product operations - use Service Role

**`app/admin/dashboard/admin-users/page.tsx`**:
- All admin user operations - use Service Role

#### 5. API Routes

**`app/api/send-order-status/route.ts`**:
- Update transaction status - use Service Role

**`app/api/send-code/route.ts`**:
- Update transaction with giftcard code - use Service Role

---

## Step 3: Ensure Error Handling

### Pattern for ALL database calls:

```typescript
try {
  const { data, error } = await supabase
    .from("table")
    .operation(...)

  if (error) {
    console.error("Database error:", error)
    toast.error(`Operation failed: ${error.message}`)
    return { error: error.message }
  }

  return { success: true, data }
} catch (error: any) {
  console.error("Unexpected error:", error)
  toast.error(`Error: ${error.message || "Unknown error occurred"}`)
  return { error: error.message || "Unknown error" }
}
```

### Files that need error handling audit:

1. `app/admin/dashboard/orders/page.tsx` - ✅ Already has good error handling
2. `app/admin/dashboard/products/page.tsx` - ✅ Already has good error handling
3. `app/admin/dashboard/products/[id]/page.tsx` - Needs audit
4. `app/admin/dashboard/products/add/page.tsx` - Needs audit
5. `app/admin/dashboard/admin-users/page.tsx` - Needs audit
6. `lib/product-categories.ts` - Needs audit
7. `lib/auth-context.tsx` - Needs audit (addTransaction function)

---

## Step 4: Guest Checkout Verification

The transactions table policy allows anon INSERT:
```sql
CREATE POLICY "transactions_anon_insert"
ON transactions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

This is handled in `lib/auth-context.tsx`:
```typescript
const addTransaction = async (...) => {
  // This uses the regular client, which will be anon for guests
  // The RLS policy allows anon INSERT, so this will work
}
```

**No changes needed** - guest checkout will continue to work.

---

## Step 5: Testing Checklist

Before deploying to production:

### Guest Checkout Flow
- [ ] Add product to cart as guest
- [ ] Complete checkout
- [ ] Verify transaction appears in admin

### Registered User Flow
- [ ] Login as user
- [ ] View transaction history (should only see own transactions)
- [ ] Place new order

### Admin Operations (Service Role)
- [ ] Add new product
- [ ] Edit existing product
- [ ] Delete product
- [ ] Update order status
- [ ] Send giftcard code
- [ ] Delete admin user
- [ ] Add/edit banners
- [ ] Add/edit categories

### Error Handling
- [ ] Verify toast notifications appear on errors
- [ ] Check browser console for detailed error messages
- [ ] Test RLS rejection scenarios (should show clear error)

---

## Troubleshooting

### "RLS policy violation" errors
- Check if the operation is using `createClient()` instead of `createServiceRoleClient()`
- Admin operations MUST use Service Role

### "Missing SUPABASE_SERVICE_ROLE_KEY"
- Add the environment variable to `.env.local`
- Restart Next.js dev server

### Guest checkout not working
- Verify the `transactions_anon_insert` policy exists
- Check that `addTransaction` in `auth-context.tsx` doesn't use Service Role (it shouldn't)

### Users can't see their transactions
- Verify `transactions_owner_read` policy
- Check that `auth.uid()` matches the `user_id` column

---

## Rollback Plan

If issues occur, disable RLS:
```sql
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
```

---

## Security Notes

1. **Service Role Key**: Treat like a root password. Never commit to git, never expose to browser.

2. **Admin Verification**: Even with Service Role, always verify the user is an admin before performing admin operations:
   ```typescript
   const { data: adminUser } = await supabase
     .from('admin_users')
     .select('id')
     .eq('id', user.id)
     .single()
   
   if (!adminUser) {
     return { error: "Unauthorized" }
   }
   ```

3. **Guest Data**: Guest transactions have `user_id = null`. The Service Role is used to read these for admin purposes.

4. **Audit Trail**: Consider adding `created_by` and `updated_by` columns to track admin actions.
