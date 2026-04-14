import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Simple HTML sanitization function
function sanitizeHtml(input: string): string {
  if (!input) return ""
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sanitizedName = sanitizeHtml(name)
    const sanitizedEmail = sanitizeHtml(email)
    const sanitizedSubject = sanitizeHtml(subject || "New Support Request")
    const sanitizedMessage = sanitizeHtml(message)

    const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #6B3FA0; border-bottom: 2px solid #6B3FA0; padding-bottom: 10px;">New Contact Request</h2>
  <div style="margin-top: 20px;">
    <p><strong>Name:</strong> ${sanitizedName}</p>
    <p><strong>Email Address:</strong> ${sanitizedEmail}</p>
    <p><strong>Subject:</strong> ${sanitizedSubject}</p>
  </div>
  <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #F59E0B; border-radius: 4px;">
    <h3 style="margin-top: 0; color: #4b5563; font-size: 14px; text-transform: uppercase;">Message:</h3>
    <p style="white-space: pre-wrap; margin-bottom: 0;">${sanitizedMessage}</p>
  </div>
  <p style="margin-top: 30px; font-size: 12px; color: #9ca3af;">This email was sent from the Byiora Contact Form.</p>
</div>
    `

    const data = await resend.emails.send({
      from: 'Byiora Support Form <contact@byiora.store>',
      replyTo: sanitizedEmail,
      to: ['support@byiora.store'],
      subject: `Contact Form: ${sanitizedSubject}`,
      html: htmlContent,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending contact email:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
