import { NextResponse } from "next/server";
import { getPlatformDb } from "@/lib/platform-admin";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city")?.trim().slice(0, 100) ?? "";
  const state = params.get("state")?.trim().slice(0, 2).toUpperCase() ?? "";
  if (!city || !state) return NextResponse.json({ barbershops: [] });
  const db = await getPlatformDb();
  const { results } = await db.prepare(
    `SELECT b.name, b.slug, COALESCE(u.city,b.city) AS city, COALESCE(u.state,b.state) AS state
     FROM barbershops b JOIN units u ON u.barbershop_id=b.id AND u.is_active=1
     WHERE b.is_active=1 AND b.slug IS NOT NULL
       AND lower(COALESCE(u.city,b.city,''))=lower(?) AND upper(COALESCE(u.state,b.state,''))=?
     ORDER BY b.name COLLATE NOCASE LIMIT 100`,
  ).bind(city, state).all();
  return NextResponse.json({ barbershops: results });
}
