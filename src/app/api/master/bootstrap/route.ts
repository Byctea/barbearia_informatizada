import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(bytes);
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function POST(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na sua conta antes de ativar o painel master.", 401);

  const env = getCloudflareContext().env as CloudflareEnv;
  if (!env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN) return fail("A ativação master ainda não foi configurada no servidor.", 503);
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || body.token.length < 24 || body.token.length > 512) return fail("Token de ativação inválido.", 400);
  if (!equalBytes(await digest(body.token), await digest(env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN))) return fail("Token de ativação inválido.", 403);

  try {
    const result = await env.DB.prepare(
      `INSERT INTO platform_admins (user_id)
       SELECT ? WHERE NOT EXISTS (SELECT 1 FROM platform_admins)`,
    ).bind(session.user.id).run();
    if (!result.meta.changes) return fail("O painel master já foi ativado.", 409);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("master bootstrap failed", error);
    return fail("Não foi possível ativar a conta master.", 409);
  }
}
