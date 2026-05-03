import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Refund Policy | Byiora",
  description: "Read the Byiora Refund Policy to learn about our cancellation and refund guidelines for game top-ups and gift cards.",
}

export default function RefundPolicyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
