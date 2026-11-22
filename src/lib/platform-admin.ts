import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth";

export async function getPlatformAdmin() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const db = (getCloudflareContext().env as CloudflareEnv).DB;
  const admin = await db.prepare(
    "SELECT user_id FROM platform_admins WHERE user_id = ? AND is_active = 1",
  ).bind(session.user.id).first<{ user_id: string }>();
  return admin ? { db, userId: session.user.id, name: session.user.name } : null;
}

export async function getPlatformDb() {
  return (getCloudflareContext().env as CloudflareEnv).DB;
}
