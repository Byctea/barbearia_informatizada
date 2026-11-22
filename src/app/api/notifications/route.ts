import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";

export async function GET() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const db = await getPlatformDb();
  const { results } = await db.prepare(`SELECT id,type,title,message,link,created_at,read_at FROM notifications
    WHERE user_id=? ORDER BY created_at DESC LIMIT 40`).bind(session.user.id).all();
  return NextResponse.json({ notifications: results });
}

export async function PATCH(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
  const db = await getPlatformDb();
  await db.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL")
    .bind(new Date().toISOString(), body.id, session.user.id).run();
  return NextResponse.json({ ok: true });
}
