# Schema Overview

<cite>
**Referenced Files in This Document**
- [supabase.ts](file://lib/supabase.ts)
- [client.ts](file://lib/supabase/client.ts)
- [server.ts](file://lib/supabase/server.ts)
- [database-init.ts](file://lib/database-init.ts)
- [auth.ts](file://app/actions/auth.ts)
- [auth-context.tsx](file://lib/auth-context.tsx)
- [product-categories.ts](file://lib/product-categories.ts)
- [admin.ts](file://app/actions/admin.ts)
- [customisation.ts](file://app/actions/customisation.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document provides a comprehensive schema overview for the Byiora e-commerce database built on Supabase and PostgreSQL. It focuses on the main tables used for e-commerce functionality: users, admin_users, products, payment_settings, and transactions. It explains the Supabase TypeScript interface system that enforces type safety across the frontend and backend, outlines naming conventions and field organization patterns, and illustrates how the schema supports instant checkout, guest transactions, and order management.

Byiora is a digital game top-up platform optimized for Nepal, enabling instant delivery of game credits and vouchers with secure processing powered by Supabase, Role-Based Security (RLS), and server-side validations.

**Section sources**
- [README.md:1-18](file://README.md#L1-L18)

## Project Structure
The database schema is defined centrally in a TypeScript interface that mirrors Supabase’s Postgres tables. The Supabase client is created with this interface to enable compile-time and runtime type safety. Application logic interacts with the database through server actions and shared libraries, ensuring consistent typing and predictable data flows.

```mermaid
graph TB
subgraph "Supabase Types"
DTS["lib/supabase.ts<br/>Database interface"]
end
subgraph "Clients"
BClient["lib/supabase/client.ts<br/>createClient()"]
SClient["lib/supabase/server.ts<br/>createClient()"]
end
subgraph "App Logic"
AuthAct["app/actions/auth.ts"]
AuthCtx["lib/auth-context.tsx"]
ProdLib["lib/product-categories.ts"]
AdminAct["app/actions/admin.ts"]
CustomAct["app/actions/customisation.ts"]
end
DTS --> BClient
DTS --> SClient
BClient --> AuthCtx
SClient --> AuthAct
SClient --> AdminAct
SClient --> CustomAct
SClient --> ProdLib
```

**Diagram sources**
- [supabase.ts:10-187](file://lib/supabase.ts#L10-L187)
- [client.ts:1-10](file://lib/supabase/client.ts#L1-L10)
- [server.ts:1-36](file://lib/supabase/server.ts#L1-L36)
- [auth.ts:1-68](file://app/actions/auth.ts#L1-L68)
- [auth-context.tsx:1-374](file://lib/auth-context.tsx#L1-L374)
- [product-categories.ts:1-485](file://lib/product-categories.ts#L1-L485)
- [admin.ts:1-35](file://app/actions/admin.ts#L1-L35)
- [customisation.ts:1-81](file://app/actions/customisation.ts#L1-L81)

**Section sources**
- [supabase.ts:10-187](file://lib/supabase.ts#L10-L187)
- [client.ts:1-10](file://lib/supabase/client.ts#L1-L10)
- [server.ts:1-36](file://lib/supabase/server.ts#L1-L36)

## Core Components
This section documents the five core tables and their roles in the e-commerce system.

- users
  - Purpose: Stores customer profiles for authenticated users.
  - Key fields: id (UUID), email, name, timestamps.
  - Usage: Created during sign-up; referenced by transactions for authenticated buyers.

- admin_users
  - Purpose: Stores administrative staff with roles and statuses.
  - Key fields: id, email, password_hash, name, role, status, timestamps.
  - Usage: Authorization checks for admin actions.

- products
  - Purpose: Defines available digital goods and top-ups with metadata.
  - Key fields: id, name, slug, logo, category ("topup" | "digital-goods"), flags (is_active, is_new, has_update), denominations array, timestamps.
  - Usage: Product catalog retrieval, filtering, updates, and deletions.

- payment_settings
  - Purpose: Centralizes payment instructions and QR assets for Nepali payment methods.
  - Key fields: id, instructions, and optional QR URLs for various providers.
  - Usage: Presentation layer displays payment instructions and QR codes.

- transactions
  - Purpose: Tracks all purchase attempts and outcomes, supporting both guest and authenticated users.
  - Key fields: id, user_id (nullable), product_id (nullable), product_name, amount, price, status enum, payment_method, transaction_id (unique), user_email, timestamps.
  - Usage: Order history, status updates, and PDF generation.

Naming conventions and field organization patterns:
- Table names are pluralized and lowercase (e.g., users, admin_users, products, payment_settings, transactions).
- Enum-like fields use union literal types in TypeScript (e.g., category, status).
- Denominations and FAQs are stored as JSON arrays for flexibility.
- Timestamps follow created_at and updated_at patterns.

**Section sources**
- [supabase.ts:14-35](file://lib/supabase.ts#L14-L35)
- [supabase.ts:36-67](file://lib/supabase.ts#L36-L67)
- [supabase.ts:68-111](file://lib/supabase.ts#L68-L111)
- [supabase.ts:112-140](file://lib/supabase.ts#L112-L140)
- [supabase.ts:141-184](file://lib/supabase.ts#L141-L184)

## Architecture Overview
The architecture leverages Supabase’s TypeScript interface system to maintain type-safe database operations across the frontend and backend. The interface defines Row, Insert, and Update shapes for each table, enabling precise typing for selects, inserts, and updates. Clients are created with this interface for both browser and server environments.

```mermaid
classDiagram
class Database {
+public : PublicSchema
}
class PublicSchema {
+Tables : Tables
}
class Users {
+Row : Users_Row
+Insert : Users_Insert
+Update : Users_Update
}
class AdminUsers {
+Row : AdminUsers_Row
+Insert : AdminUsers_Insert
+Update : AdminUsers_Update
}
class Products {
+Row : Products_Row
+Insert : Products_Insert
+Update : Products_Update
}
class PaymentSettings {
+Row : PaymentSettings_Row
+Insert : PaymentSettings_Insert
+Update : PaymentSettings_Update
}
class Transactions {
+Row : Transactions_Row
+Insert : Transactions_Insert
+Update : Transactions_Update
}
Database --> PublicSchema
PublicSchema --> Users
PublicSchema --> AdminUsers
PublicSchema --> Products
PublicSchema --> PaymentSettings
PublicSchema --> Transactions
```

**Diagram sources**
- [supabase.ts:10-187](file://lib/supabase.ts#L10-L187)

**Section sources**
- [supabase.ts:10-187](file://lib/supabase.ts#L10-L187)

## Detailed Component Analysis

### Entity-Relationship Diagram
The relationships among the core tables underpin the e-commerce flow. Users can place transactions; products define the items being purchased; admin_users manage content and settings; payment_settings provide payment details; and transactions optionally reference products and users.

```mermaid
erDiagram
USERS {
uuid id PK
string email
string name
timestamp created_at
timestamp updated_at
}
ADMIN_USERS {
uuid id PK
string email
string password_hash
string name
enum role
enum status
timestamp created_at
timestamp updated_at
}
PRODUCTS {
uuid id PK
string name
string slug
string logo
enum category
text description
boolean is_active
boolean is_new
boolean has_update
json denominations
timestamp created_at
timestamp updated_at
}
PAYMENT_SETTINGS {
uuid id PK
text instructions
text esewa_qr
text khalti_qr
text imepay_qr
text mobile_banking_qr
timestamp created_at
}
TRANSACTIONS {
uuid id PK
uuid user_id
uuid product_id
string product_name
string amount
string price
enum status
string payment_method
string transaction_id
string user_email
timestamp created_at
timestamp updated_at
}
USERS ||--o{ TRANSACTIONS : "has"
PRODUCTS ||--o{ TRANSACTIONS : "described_by"
```

**Diagram sources**
- [supabase.ts:14-35](file://lib/supabase.ts#L14-L35)
- [supabase.ts:36-67](file://lib/supabase.ts#L36-L67)
- [supabase.ts:68-111](file://lib/supabase.ts#L68-L111)
- [supabase.ts:112-140](file://lib/supabase.ts#L112-L140)
- [supabase.ts:141-184](file://lib/supabase.ts#L141-L184)

### Data Flow: Add Transaction (Guest and Authenticated)
This sequence shows how transactions are inserted, including guest mode handling and optional product_category normalization.

```mermaid
sequenceDiagram
participant UI as "Client UI"
participant Ctx as "AuthContext"
participant Act as "Server Action"
participant SB as "Supabase Client"
participant DB as "PostgreSQL"
UI->>Ctx : addTransaction(payload)
Ctx->>SB : from("transactions").insert([payload]).select().single()
SB->>DB : INSERT INTO transactions
DB-->>SB : new row
SB-->>Ctx : { data, error }
alt product_category column missing
Ctx->>SB : insert([payloadWithoutCategory])
SB->>DB : INSERT INTO transactions
DB-->>SB : new row
SB-->>Ctx : { data, error }
end
Ctx-->>UI : transactionId
```

**Diagram sources**
- [auth-context.tsx:240-323](file://lib/auth-context.tsx#L240-L323)

**Section sources**
- [auth-context.tsx:240-323](file://lib/auth-context.tsx#L240-L323)

### Data Flow: User Registration and Profile Creation
This sequence demonstrates how a new user is registered and their profile is created in the users table.

```mermaid
sequenceDiagram
participant UI as "Client UI"
participant Act as "signupWithPassword"
participant SB as "Supabase Client"
participant DB as "PostgreSQL"
UI->>Act : signup(email, password, name)
Act->>SB : auth.signUp()
SB-->>Act : { user }
Act->>SB : from("users").insert([{ id, email, name }])
SB->>DB : INSERT INTO users
DB-->>SB : OK
Act-->>UI : success
```

**Diagram sources**
- [auth.ts:25-59](file://app/actions/auth.ts#L25-L59)

**Section sources**
- [auth.ts:25-59](file://app/actions/auth.ts#L25-L59)

### Data Flow: Admin User Deletion
This sequence shows deletion of an admin user from the admin_users table.

```mermaid
sequenceDiagram
participant UI as "Admin UI"
participant Act as "deleteAdminUserAction"
participant SB as "Supabase Client"
participant DB as "PostgreSQL"
UI->>Act : delete(userId)
Act->>SB : from("admin_users").delete().eq("id", userId)
SB->>DB : DELETE FROM admin_users
DB-->>SB : OK
Act-->>UI : success
```

**Diagram sources**
- [admin.ts:10-34](file://app/actions/admin.ts#L10-L34)

**Section sources**
- [admin.ts:10-34](file://app/actions/admin.ts#L10-L34)

### Data Flow: Product Catalog Management
This sequence shows how product data is fetched, transformed, and cached.

```mermaid
sequenceDiagram
participant UI as "Components"
participant Lib as "getAllProducts()"
participant SB as "Supabase Client"
participant DB as "PostgreSQL"
UI->>Lib : fetch products
Lib->>SB : from("products").select("*").order("created_at")
SB->>DB : SELECT * FROM products ORDER BY created_at
DB-->>SB : rows
SB-->>Lib : data
Lib->>Lib : transform to Product[]
Lib-->>UI : products
```

**Diagram sources**
- [product-categories.ts:200-264](file://lib/product-categories.ts#L200-L264)

**Section sources**
- [product-categories.ts:200-264](file://lib/product-categories.ts#L200-L264)

### Data Flow: Admin Customization Actions
This sequence shows how admin actions verify admin status and update banners/homepage categories.

```mermaid
sequenceDiagram
participant UI as "Admin UI"
participant Act as "verifyAdmin()"
participant SB as "Supabase Client"
participant DB as "PostgreSQL"
UI->>Act : addBanner(title, link, image, sort)
Act->>SB : auth.getUser()
SB-->>Act : { user }
Act->>SB : from("admin_users").select("id").eq("id", user.id).single()
SB->>DB : SELECT id FROM admin_users WHERE id = user.id
DB-->>SB : adminUser
Act-->>UI : { success, data } or { error }
```

**Diagram sources**
- [customisation.ts:6-13](file://app/actions/customisation.ts#L6-L13)

**Section sources**
- [customisation.ts:6-13](file://app/actions/customisation.ts#L6-L13)

## Dependency Analysis
The following diagram highlights how application logic depends on the Supabase client and the central Database interface.

```mermaid
graph LR
DTS["lib/supabase.ts"] --> BClient["lib/supabase/client.ts"]
DTS --> SClient["lib/supabase/server.ts"]
BClient --> AuthCtx["lib/auth-context.tsx"]
SClient --> AuthAct["app/actions/auth.ts"]
SClient --> AdminAct["app/actions/admin.ts"]
SClient --> CustomAct["app/actions/customisation.ts"]
SClient --> ProdLib["lib/product-categories.ts"]
```

**Diagram sources**
- [supabase.ts:10-187](file://lib/supabase.ts#L10-L187)
- [client.ts:1-10](file://lib/supabase/client.ts#L1-L10)
- [server.ts:1-36](file://lib/supabase/server.ts#L1-L36)
- [auth-context.tsx:1-374](file://lib/auth-context.tsx#L1-L374)
- [auth.ts:1-68](file://app/actions/auth.ts#L1-L68)
- [admin.ts:1-35](file://app/actions/admin.ts#L1-L35)
- [customisation.ts:1-81](file://app/actions/customisation.ts#L1-L81)
- [product-categories.ts:1-485](file://lib/product-categories.ts#L1-L485)

**Section sources**
- [supabase.ts:10-187](file://lib/supabase.ts#L10-L187)
- [client.ts:1-10](file://lib/supabase/client.ts#L1-L10)
- [server.ts:1-36](file://lib/supabase/server.ts#L1-L36)

## Performance Considerations
- Use of enums and union literal types reduces storage overhead and improves query predictability.
- JSON fields (e.g., denominations) offer flexibility but may increase payload sizes; consider indexing strategies if frequently filtered.
- Caching in product retrieval libraries minimizes repeated database calls and improves responsiveness.
- Prefer selective field queries and appropriate ordering to reduce network and compute costs.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Environment variables not configured
  - Symptom: Database status reports missing Supabase configuration.
  - Resolution: Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
  - Section sources
    - [database-init.ts:11-24](file://lib/database-init.ts#L11-L24)

- Tables do not exist
  - Symptom: Connection succeeds but table not found error occurs.
  - Resolution: Run the database setup scripts to create tables.
  - Section sources
    - [database-init.ts:27-87](file://lib/database-init.ts#L27-L87)

- Empty database on first run
  - Symptom: Initialization indicates empty dataset.
  - Resolution: Run the seed script to populate initial data.
  - Section sources
    - [database-init.ts:89-111](file://lib/database-init.ts#L89-L111)

- Transaction insert fails due to schema mismatch
  - Symptom: Insertion error mentioning product_category column.
  - Resolution: Retry insert without product_category; the application handles this fallback.
  - Section sources
    - [auth-context.tsx:282-292](file://lib/auth-context.tsx#L282-L292)

- Admin verification failures
  - Symptom: Unauthorized responses when performing admin actions.
  - Resolution: Confirm admin user exists in admin_users and session is valid.
  - Section sources
    - [customisation.ts:6-13](file://app/actions/customisation.ts#L6-L13)

## Conclusion
Byiora’s database schema is designed around a clear set of tables that support instant digital top-ups and guest checkout while maintaining strong type safety through Supabase’s TypeScript interface system. The schema’s naming conventions and field organization promote clarity and scalability. The client-side and server-side Supabase clients enforce type correctness across the application, ensuring reliable data flows for users, admins, products, payments, and transactions.

[No sources needed since this section summarizes without analyzing specific files]