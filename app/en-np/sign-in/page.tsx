import type { Metadata } from "next"
import { AuthPage } from "../sign-up/auth-page"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Byiora account to see your orders and gift card codes.",
  alternates: { canonical: "https://www.byiora.com.np/en-np/sign-in" },
}

export default function SignInPage() {
  return <AuthPage mode="signin" />
}
