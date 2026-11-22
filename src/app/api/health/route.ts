import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", app: "barber-bar", timestamp: new Date().toISOString() });
}
