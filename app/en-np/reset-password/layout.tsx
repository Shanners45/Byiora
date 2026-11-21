import type { Metadata } from "next"

// Token-bearing account page: never index it.
export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
