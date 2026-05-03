import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Byiora",
  description: "Read the Byiora Privacy Policy to understand how we collect, use, and protect your personal information.",
}

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
