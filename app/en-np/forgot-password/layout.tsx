import type { Metadata } from "next"

// Account utility page: no search value, keep it out of the index.
export const metadata: Metadata = {
  title: "Forgot Password",
  robots: { index: false, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
