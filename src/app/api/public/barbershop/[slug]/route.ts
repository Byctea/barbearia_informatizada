import { NextResponse } from "next/server";
import { getPlatformDb } from "@/lib/platform-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getPlatformDb();
  const barbershop = await db.prepare(
    "SELECT name, slug FROM barbershops WHERE slug=? AND is_active=1",
  ).bind(slug).first<{ name: string; slug: string }>();
  if (!barbershop) return NextResponse.json({ error: "Barbearia não encontrada." }, { status: 404 });
  return NextResponse.json({ barbershop });
}
