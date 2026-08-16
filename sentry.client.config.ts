import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://d87bddb2785c2bbbe1ebf6d517e46c03@o4511468701351936.ingest.us.sentry.io/4511468703514624"

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    
    // Tracing / Performance (tuned for Free Tier 5M spans)
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.05,
    
    // Session Replay (Free Tier includes 50 replays/month — reserve 100% of quota strictly for error events)
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    // Security & Privacy Controls
    sendDefaultPii: false,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
        maskAllInputs: true,
        networkDetailAllowUrls: [
          typeof window !== "undefined" ? window.location.origin : "https://byiora.com.np",
          "https://admin.byiora.com.np",
        ],
      }),
    ],

    // Noise filtering
    beforeSend(event, hint) {
      const error = hint.originalException
      const errorMessage = typeof error === "string" ? error : error instanceof Error ? error.message : ""

      // Filter non-actionable browser, extension, and network abort noise
      if (
        errorMessage.includes("ResizeObserver loop") ||
        errorMessage.includes("ResizeObserver loop completed with undelivered notifications") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError when attempting to fetch resource") ||
        errorMessage.includes("AbortError: The user aborted a request") ||
        errorMessage.includes("chrome-extension://") ||
        errorMessage.includes("moz-extension://") ||
        errorMessage.includes("safari-extension://")
      ) {
        return null
      }

      return event
    },
  })
}
