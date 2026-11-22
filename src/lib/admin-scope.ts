import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth";

export type AdminScope = {
  db: D1Database;
  userId: string;
  barbershopId: string;
  unitId: string;
};

export async function getAdminScope(): Promise<AdminScope | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "ADMIN") return null;

  const { env } = getCloudflareContext();
  const db = (env as CloudflareEnv).DB;
  const membership = await db.prepare(
    `SELECT m.barbershop_id AS barbershopId, m.unit_id AS unitId
     FROM memberships m
     INNER JOIN users u ON u.id = m.user_id
     WHERE u.auth_subject = ?
       AND m.role = 'ADMIN'
       AND m.is_active = 1
       AND m.unit_id IS NOT NULL
     ORDER BY m.created_at ASC
     LIMIT 1`,
  ).bind(session.user.id).first<{ barbershopId: string; unitId: string }>();

  if (!membership) return null;
  return { db, userId: session.user.id, ...membership };
}
