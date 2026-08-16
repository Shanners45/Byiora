import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://d87bddb2785c2bbbe1ebf6d517e46c03@o4511468701351936.ingest.us.sentry.io/4511468703514624"

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    
    // Performance Monitoring (tuned for Free Tier 5M spans)
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.05,
    
    // Security & Data Scrubbing
    sendDefaultPii: false,

    beforeSend(event) {
      // Scrub sensitive authorization headers, internal secrets and session cookies
      if (event.request?.headers) {
        delete event.request.headers["authorization"]
        delete event.request.headers["cookie"]
        delete event.request.headers["set-cookie"]
        delete event.request.headers["x-supabase-key"]
        delete event.request.headers["internal-api-secret"]
      }
      return event
    },
  })
}
