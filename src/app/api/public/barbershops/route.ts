import { NextResponse } from "next/server";
import { getPlatformDb } from "@/lib/platform-admin";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city")?.trim().slice(0, 100) ?? "";
  const state = params.get("state")?.trim().slice(0, 2).toUpperCase() ?? "";
  const name = params.get("name")?.trim().slice(0, 100) ?? "";
  if (!city && !name) return NextResponse.json({ barbershops: [] });
  const db = await getPlatformDb();
  const filters: string[] = ["b.is_active=1", "b.slug IS NOT NULL"];
  const values: string[] = [];
  if (city) {
    filters.push("lower(COALESCE(u.city,b.city,''))=lower(?)");
    values.push(city);
  }
  if (state) {
    filters.push("upper(COALESCE(u.state,b.state,''))=?");
    values.push(state);
  }
  if (name) {
    filters.push("lower(b.name) LIKE lower(?) ESCAPE '\\'");
    values.push(`%${name.replace(/[\\%_]/g, "\\$&")}%`);
  }
  const { results } = await db.prepare(
    `SELECT b.name, b.slug, COALESCE(u.city,b.city) AS city, COALESCE(u.state,b.state) AS state
     FROM barbershops b JOIN units u ON u.barbershop_id=b.id AND u.is_active=1
     WHERE ${filters.join(" AND ")}
     GROUP BY b.id ORDER BY b.name COLLATE NOCASE LIMIT 100`,
  ).bind(...values).all();
  return NextResponse.json({ barbershops: results });
}
