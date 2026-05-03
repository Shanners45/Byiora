import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us | Byiora",
  description: "Get in touch with Byiora for support, inquiries, and assistance with game top-ups and gift cards.",
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
