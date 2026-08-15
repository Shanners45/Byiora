import { NextResponse } from 'next/server'

// Disabled: Code delivery is handled securely via server actions and webhooks.
export async function POST() {
  return NextResponse.json({ error: "Endpoint deprecated" }, { status: 404 })
}
