import type { Metadata } from "next"

// Private, per-customer page: keep it out of search results and don't inherit the homepage canonical.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
