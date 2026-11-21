import type { Metadata } from "next"
import { AuthPage } from "./auth-page"

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Byiora account to track orders and get faster checkout for game top-ups and gift cards in Nepal.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.byiora.com.np/en-np/sign-up" },
}

export default function SignUpPage() {
  return <AuthPage mode="signup" />
}
