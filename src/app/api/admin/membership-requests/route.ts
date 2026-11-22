import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET() {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const { results } = await scope.db.prepare(
    `SELECT r.id, r.user_id, r.barbershop_id, r.unit_id, r.status, r.created_at,
            u.display_name, u.email, r.phone_snapshot FROM customer_membership_requests r
     JOIN users u ON u.id=r.user_id
     WHERE r.barbershop_id=? AND r.status='PENDING' ORDER BY r.created_at LIMIT 100`,
  ).bind(scope.barbershopId).all();
  return NextResponse.json({ requests: results });
}

export async function POST(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown } | null;
  if (typeof body?.id !== "string" || body.id.length > 80 || !["approve", "reject"].includes(String(body?.action))) return fail("Informe uma solicitação e ação válidas.", 400);
  const status = body.action === "approve" ? "APPROVED" : "REJECTED";
  const result = await scope.db.prepare(
    `UPDATE customer_membership_requests SET status=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reviewed_by=?
     WHERE id=? AND barbershop_id=? AND unit_id=? AND status='PENDING'`,
  ).bind(status, scope.userId, body.id, scope.barbershopId, scope.unitId).run();
  if (!result.meta.changes) return fail("Solicitação não encontrada ou já analisada.", 404);
  if (status === "APPROVED") {
    try {
      const requestInfo = await scope.db.prepare(`SELECT r.user_id,r.barbershop_id,r.unit_id,COALESCE(r.phone_snapshot,u.phone) AS phone_snapshot,u.display_name,u.email
        FROM customer_membership_requests r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.barbershop_id=? AND r.unit_id=?`)
        .bind(body.id, scope.barbershopId, scope.unitId).first<{user_id:string;barbershop_id:string;unit_id:string;phone_snapshot:string|null;display_name:string;email:string|null}>();
      if (!requestInfo || !requestInfo.phone_snapshot) throw new Error("membership_request_phone_missing");
      await scope.db.batch([
        scope.db.prepare(`INSERT INTO memberships (id,barbershop_id,unit_id,user_id,role,is_active)
          VALUES (?,?,?,?,'CLIENT',1) ON CONFLICT(barbershop_id,user_id,unit_id) DO UPDATE SET role='CLIENT',is_active=1`)
          .bind(crypto.randomUUID(), requestInfo.barbershop_id, requestInfo.unit_id, requestInfo.user_id),
        scope.db.prepare(`UPDATE customers SET full_name=?,phone=?,email=?,updated_at=?
          WHERE user_id=? AND barbershop_id=? AND unit_id=? AND deleted_at IS NULL`)
          .bind(requestInfo.display_name, requestInfo.phone_snapshot, requestInfo.email, new Date().toISOString(), requestInfo.user_id, requestInfo.barbershop_id, requestInfo.unit_id),
        scope.db.prepare(`INSERT INTO customers (id,barbershop_id,unit_id,user_id,full_name,phone,email,created_at,updated_at)
          SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE user_id=? AND barbershop_id=? AND unit_id=? AND deleted_at IS NULL)`)
          .bind(crypto.randomUUID(), requestInfo.barbershop_id, requestInfo.unit_id, requestInfo.user_id, requestInfo.display_name, requestInfo.phone_snapshot, requestInfo.email, new Date().toISOString(), new Date().toISOString(), requestInfo.user_id, requestInfo.barbershop_id, requestInfo.unit_id),
      ]);
      const approved = await scope.db.prepare(
        "SELECT u.auth_subject FROM customer_membership_requests r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.barbershop_id=? AND r.unit_id=?",
      ).bind(body.id, scope.barbershopId, scope.unitId).first<{ auth_subject: string }>();
      if (approved) {
        await scope.db.prepare("UPDATE user SET role='CLIENT' WHERE id=? AND role<>'ADMIN'").bind(approved.auth_subject).run();
      }
      await scope.db.prepare(`INSERT INTO notifications (id,barbershop_id,unit_id,user_id,type,title,message,link)
        SELECT lower(hex(randomblob(16))),r.barbershop_id,r.unit_id,r.user_id,'MEMBERSHIP_APPROVED','Vínculo aprovado',
          'Seu vínculo com a barbearia foi aprovado. Agora você pode acessar a loja e acompanhar seus agendamentos.','/dashboard'
        FROM customer_membership_requests r WHERE r.id=? AND r.status='APPROVED'`).bind(body.id).run();
    } catch (error) {
      console.error("customer membership approval failed", error);
      await scope.db.prepare("UPDATE customer_membership_requests SET status='PENDING',reviewed_at=NULL,reviewed_by=NULL WHERE id=?").bind(body.id).run();
      return fail("Não foi possível aprovar o vínculo.", 500);
    }
  }
  return NextResponse.json({ ok: true, status });
}
