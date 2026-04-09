# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [next.config.js](file://next.config.js)
- [tailwind.config.ts](file://tailwind.config.ts)
- [tsconfig.json](file://tsconfig.json)
- [components.json](file://components.json)
- [lib/supabase.ts](file://lib/supabase.ts)
- [lib/database-init.ts](file://lib/database-init.ts)
- [lib/email-service.ts](file://lib/email-service.ts)
- [lib/email-fallback.ts](file://lib/email-fallback.ts)
- [middleware.ts](file://middleware.ts)
- [app/api/send-welcome/route.ts](file://app/api/send-welcome/route.ts)
- [app/api/send-order-placed/route.ts](file://app/api/send-order-placed/route.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [Local Development](#local-development)
6. [Database Initialization](#database-initialization)
7. [Email Service Setup](#email-service-setup)
8. [Verification Checklist](#verification-checklist)
9. [Development Workflow](#development-workflow)
10. [Troubleshooting](#troubleshooting)
11. [Conclusion](#conclusion)

## Introduction
Byiora is a Next.js-based digital game top-up platform for Nepal. It emphasizes instant delivery, secure processing with Supabase and Role-Based Security (RLS), and a modern TypeScript stack. This guide walks you through setting up the development environment, configuring Supabase and email services, initializing the database, and running the local development server.

**Section sources**
- [README.md:1-18](file://README.md#L1-L18)

## Prerequisites
Before you begin, ensure your machine meets the following requirements:
- Node.js LTS recommended by the project’s package manager specification
- pnpm installed and configured
- A Supabase account and project created
- Optional: EmailJS or Resend credentials for email functionality

These tools and services are used throughout the project:
- Next.js runtime and build system
- Supabase client libraries for database and auth
- EmailJS and Resend for transactional emails
- Tailwind CSS for styling

**Section sources**
- [package.json:11-39](file://package.json#L11-L39)
- [package.json:40-48](file://package.json#L40-L48)
- [lib/supabase.ts:1-7](file://lib/supabase.ts#L1-L7)
- [lib/email-service.ts:1-8](file://lib/email-service.ts#L1-L8)
- [app/api/send-welcome/route.ts:1-69](file://app/api/send-welcome/route.ts#L1-L69)

## Installation
Follow these steps to install and prepare the project locally:

1. Install dependencies using pnpm:
   - Run: pnpm install

2. Start the development server:
   - Run: pnpm dev

3. Build for production:
   - Run: pnpm build

4. Start the production server:
   - Run: pnpm start

Notes:
- The project specifies pnpm as the package manager.
- Scripts for dev, build, start, and lint are defined in the package manifest.

**Section sources**
- [package.json:5-10](file://package.json#L5-L10)
- [package.json:49](file://package.json#L49)

## Environment Variables
Configure environment variables for Supabase and optional email services. These variables are consumed by the application at runtime.

Required for Supabase:
- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous or public key

Optional for EmailJS:
- NEXT_PUBLIC_EMAILJS_SERVICE_ID: EmailJS service identifier
- NEXT_PUBLIC_EMAILJS_TEMPLATE_ID: EmailJS template identifier
- NEXT_PUBLIC_EMAILJS_PUBLIC_KEY: EmailJS public key

Optional for Resend:
- RESEND_API_KEY: Resend API key for transactional emails

Where they are used:
- Supabase client initialization reads these variables.
- Email service checks for EmailJS configuration and falls back to a local logging method if not configured.
- Resend-powered API routes require the Resend API key.

**Section sources**
- [lib/supabase.ts:3-7](file://lib/supabase.ts#L3-L7)
- [lib/email-service.ts:5-7](file://lib/email-service.ts#L5-L8)
- [app/api/send-welcome/route.ts:5](file://app/api/send-welcome/route.ts#L5)

## Local Development
To run the application locally:

1. Ensure environment variables are set in your shell or a .env.local file at the project root.
2. Start the development server:
   - pnpm dev
3. Access the site at http://localhost:3000.

Additional notes:
- The middleware integrates with Supabase session management and applies to non-API routes.
- Image remote patterns are dynamically extended from the Supabase URL if present.

**Section sources**
- [middleware.ts:1-11](file://middleware.ts#L1-L11)
- [next.config.js:10-20](file://next.config.js#L10-L20)

## Database Initialization
Byiora relies on Supabase for data storage. The database initialization utilities help verify connectivity, table presence, and data availability.

Key behaviors:
- Configuration check: Verifies presence of Supabase URL and key.
- Connectivity test: Attempts a simple count query against the products table.
- Table existence: Distinguishes between connection errors indicating missing tables versus other failures.
- Data presence: Checks whether seed data exists.
- Operation testing: Provides helpers to test read operations across key tables.

Recommended workflow:
1. Confirm Supabase environment variables are set.
2. Run database status checks to confirm connectivity and table existence.
3. Seed the database with initial data if tables exist but are empty.
4. Use operation tests to validate read access to products, users, and transactions tables.

**Section sources**
- [lib/database-init.ts:11-24](file://lib/database-init.ts#L11-L24)
- [lib/database-init.ts:27-87](file://lib/database-init.ts#L27-L87)
- [lib/database-init.ts:89-111](file://lib/database-init.ts#L89-L111)
- [lib/database-init.ts:114-163](file://lib/database-init.ts#L114-L163)

## Email Service Setup
Byiora supports two email pathways:

1) EmailJS (preferred):
- Configure NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID, and NEXT_PUBLIC_EMAILJS_PUBLIC_KEY.
- The email service attempts to send via EmailJS and logs detailed errors if it fails.

2) Fallback:
- If EmailJS is not configured, the fallback method logs the payload and simulates success after a short delay.
- This allows local development without external email credentials.

Resend-powered API routes:
- Welcome emails and order placement notifications use Resend.
- Requires RESEND_API_KEY.

**Section sources**
- [lib/email-service.ts:5-8](file://lib/email-service.ts#L5-L8)
- [lib/email-service.ts:77-80](file://lib/email-service.ts#L77-L80)
- [lib/email-service.ts:114-125](file://lib/email-service.ts#L114-L125)
- [lib/email-fallback.ts:3-30](file://lib/email-fallback.ts#L3-L30)
- [app/api/send-welcome/route.ts:5](file://app/api/send-welcome/route.ts#L5)

## Verification Checklist
After completing setup, verify your environment:

- Supabase:
  - Confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
  - Run database status checks to ensure connectivity and table existence.
  - Validate read operations for products, users, and transactions tables.

- Email:
  - For EmailJS: Ensure service/template/public keys are set; test sending a welcome email.
  - For fallback: Expect logged payload and simulated success.
  - For Resend: Confirm RESEND_API_KEY; test Resend-powered API routes.

- Application:
  - Start the dev server and navigate to the homepage.
  - Verify middleware session updates and Supabase image remote patterns.

**Section sources**
- [lib/supabase.ts:3-7](file://lib/supabase.ts#L3-L7)
- [lib/database-init.ts:27-87](file://lib/database-init.ts#L27-L87)
- [lib/email-service.ts:32-73](file://lib/email-service.ts#L32-L73)
- [lib/email-service.ts:75-125](file://lib/email-service.ts#L75-L125)
- [app/api/send-welcome/route.ts:7-68](file://app/api/send-welcome/route.ts#L7-L68)
- [middleware.ts:1-11](file://middleware.ts#L1-L11)
- [next.config.js:10-20](file://next.config.js#L10-L20)

## Development Workflow
- Use pnpm scripts for daily tasks:
  - pnpm dev for local development
  - pnpm build for production builds
  - pnpm start for production preview
  - pnpm lint for TypeScript linting

- Styling:
  - Tailwind CSS is configured with a custom theme and animations.
  - shadcn/ui components are integrated via components.json aliases.

- Type safety:
  - TypeScript strict mode is enabled with bundler module resolution.

- Middleware:
  - Session management is handled globally via middleware.

**Section sources**
- [package.json:5-10](file://package.json#L5-L10)
- [tailwind.config.ts:1-113](file://tailwind.config.ts#L1-L113)
- [components.json:1-21](file://components.json#L1-L21)
- [tsconfig.json:1-42](file://tsconfig.json#L1-L42)
- [middleware.ts:1-11](file://middleware.ts#L1-L11)

## Troubleshooting
Common issues and resolutions:

- Supabase not configured:
  - Symptom: Warnings about missing environment variables or inability to connect.
  - Resolution: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.

- Database tables missing:
  - Symptom: Connection succeeds but table not found error.
  - Resolution: Run the database seed scripts to create tables and initial data.

- EmailJS not configured:
  - Symptom: Emails fail to send via EmailJS.
  - Resolution: Set EmailJS variables or rely on fallback logging; configure Resend for production-like behavior.

- Resend API key missing:
  - Symptom: API routes for emails return errors.
  - Resolution: Set RESEND_API_KEY and ensure the routes are reachable.

- Image remote patterns:
  - Symptom: Images from Supabase storage fail to load.
  - Resolution: Ensure NEXT_PUBLIC_SUPABASE_URL is set so dynamic remote patterns are applied.

**Section sources**
- [lib/database-init.ts:15-24](file://lib/database-init.ts#L15-L24)
- [lib/database-init.ts:44-52](file://lib/database-init.ts#L44-L52)
- [lib/email-service.ts:77-80](file://lib/email-service.ts#L77-L80)
- [app/api/send-welcome/route.ts:5](file://app/api/send-welcome/route.ts#L5)
- [next.config.js:10-20](file://next.config.js#L10-L20)

## Conclusion
You now have the essentials to set up and run Byiora locally. Confirm environment variables, initialize the database, configure email services, and verify functionality using the provided checks. For production, ensure Supabase and email provider credentials are securely configured and deploy to Vercel as indicated by the project metadata.

[No sources needed since this section summarizes without analyzing specific files]