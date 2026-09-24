import { NextResponse } from "next/server"

export const dynamic = "force-static"

export async function GET() {
  return new NextResponse("d1e6cf9fdbca402cbe2a01a9d2d331aa", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
