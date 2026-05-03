import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms and Conditions | Byiora",
  description: "Read the Byiora Terms and Conditions governing your use of our platform and services.",
}

export default function TermsAndConditionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
