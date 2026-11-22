import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminScope } from "@/lib/admin-scope";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });
const localDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export async function GET(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const url = new URL(request.url);
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  if ((rawFrom && !dateSchema.safeParse(rawFrom).success) || (rawTo && !dateSchema.safeParse(rawTo).success)) return fail("Informe datas válidas para o relatório.", 400);
  const today = localDate(new Date());
  const from = rawFrom ?? `${today.slice(0, 7)}-01`;
  const lastDay = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const to = rawTo ?? (rawFrom ? today : `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`);
  if (from > to) return fail("A data inicial precisa ser anterior ou igual à data final.", 400);
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 3660 * 86_400_000) return fail("O período máximo permitido é de 10 anos.", 400);
  const groupByMonth = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 62 * 86_400_000;
  const tenant = [scope.barbershopId, scope.unitId, from, to] as const;
  try {
    const [totals, trend, customers, services, products, productsByMargin, weekdays, hours, returns] = await Promise.all([
      scope.db.prepare(`SELECT COALESCE(SUM(CASE WHEN entry_type='INCOME' AND category='SERVICE' THEN amount_cents ELSE 0 END),0) AS service_revenue_cents,COALESCE(SUM(CASE WHEN entry_type='INCOME' AND category='PRODUCT' THEN amount_cents ELSE 0 END),0) AS product_revenue_cents,COALESCE(SUM(CASE WHEN entry_type='EXPENSE' THEN amount_cents ELSE 0 END),0) AS expenses_cents,COUNT(CASE WHEN entry_type='INCOME' THEN 1 END) AS ticket_count FROM finance_entries WHERE barbershop_id=? AND unit_id=? AND occurred_on>=? AND occurred_on<=? AND status='CONFIRMED'`).bind(...tenant).first<Record<string, number>>(),
      scope.db.prepare(`SELECT CASE WHEN ?=1 THEN substr(occurred_on,1,7) ELSE occurred_on END AS period,COALESCE(SUM(CASE WHEN entry_type='INCOME' THEN amount_cents ELSE 0 END),0) AS revenue_cents,COALESCE(SUM(CASE WHEN entry_type='EXPENSE' THEN amount_cents ELSE 0 END),0) AS expenses_cents FROM finance_entries WHERE barbershop_id=? AND unit_id=? AND occurred_on>=? AND occurred_on<=? AND status='CONFIRMED' GROUP BY period ORDER BY period`).bind(groupByMonth ? 1 : 0, ...tenant).all<Record<string, string | number>>(),
      scope.db.prepare(`SELECT c.id,c.full_name,COUNT(DISTINCT v.id) AS visit_count,COALESCE(SUM(vs.price_cents),0) AS service_spend_cents,MAX(date(v.occurred_at,'-3 hours')) AS last_visit FROM visits v JOIN customers c ON c.id=v.customer_id AND c.unit_id=v.unit_id LEFT JOIN visit_services vs ON vs.visit_id=v.id AND vs.unit_id=v.unit_id WHERE v.barbershop_id=? AND v.unit_id=? AND date(v.occurred_at,'-3 hours')>=? AND date(v.occurred_at,'-3 hours')<=? GROUP BY c.id ORDER BY visit_count DESC,service_spend_cents DESC LIMIT 10`).bind(...tenant).all<Record<string, unknown>>(),
      scope.db.prepare(`SELECT vs.service_name_snapshot AS name,COUNT(DISTINCT v.id) AS visit_count,COALESCE(SUM(vs.price_cents),0) AS revenue_cents,COALESCE(SUM(vs.cost_cents),0) AS estimated_cost_cents FROM visit_services vs JOIN visits v ON v.id=vs.visit_id AND v.unit_id=vs.unit_id WHERE v.barbershop_id=? AND v.unit_id=? AND date(v.occurred_at,'-3 hours')>=? AND date(v.occurred_at,'-3 hours')<=? GROUP BY vs.service_id,vs.service_name_snapshot ORDER BY visit_count DESC,revenue_cents DESC LIMIT 10`).bind(...tenant).all<Record<string, unknown>>(),
      scope.db.prepare(`SELECT si.product_name_snapshot AS name,SUM(si.quantity) AS quantity_sold,COALESCE(SUM(si.quantity*si.unit_price_cents),0) AS revenue_cents,COALESCE(SUM(si.quantity*si.unit_cost_cents),0) AS cost_cents,COALESCE(SUM(si.quantity*(si.unit_price_cents-si.unit_cost_cents)),0) AS margin_cents FROM sale_items si JOIN sales s ON s.id=si.sale_id AND s.unit_id=si.unit_id WHERE s.barbershop_id=? AND s.unit_id=? AND s.status='COMPLETED' AND date(s.sold_at,'-3 hours')>=? AND date(s.sold_at,'-3 hours')<=? GROUP BY si.product_id,si.product_name_snapshot ORDER BY quantity_sold DESC,revenue_cents DESC LIMIT 10`).bind(...tenant).all<Record<string, unknown>>(),
      scope.db.prepare(`SELECT si.product_name_snapshot AS name,SUM(si.quantity) AS quantity_sold,COALESCE(SUM(si.quantity*si.unit_price_cents),0) AS revenue_cents,COALESCE(SUM(si.quantity*(si.unit_price_cents-si.unit_cost_cents)),0) AS margin_cents FROM sale_items si JOIN sales s ON s.id=si.sale_id AND s.unit_id=si.unit_id WHERE s.barbershop_id=? AND s.unit_id=? AND s.status='COMPLETED' AND date(s.sold_at,'-3 hours')>=? AND date(s.sold_at,'-3 hours')<=? GROUP BY si.product_id,si.product_name_snapshot ORDER BY margin_cents DESC,revenue_cents DESC LIMIT 10`).bind(...tenant).all<Record<string, unknown>>(),
      scope.db.prepare(`SELECT CAST(strftime('%w',date(occurred_at,'-3 hours')) AS INTEGER) AS weekday,COUNT(*) AS total FROM visits WHERE barbershop_id=? AND unit_id=? AND date(occurred_at,'-3 hours')>=? AND date(occurred_at,'-3 hours')<=? GROUP BY weekday ORDER BY total DESC`).bind(...tenant).all<Record<string, number>>(),
      scope.db.prepare(`SELECT CAST(strftime('%H',datetime(occurred_at,'-3 hours')) AS INTEGER) AS hour,COUNT(*) AS total FROM visits WHERE barbershop_id=? AND unit_id=? AND date(occurred_at,'-3 hours')>=? AND date(occurred_at,'-3 hours')<=? GROUP BY hour ORDER BY total DESC,hour LIMIT 8`).bind(...tenant).all<Record<string, number>>(),
      scope.db.prepare(`WITH period_customers AS (SELECT customer_id,MIN(occurred_at) AS first_visit FROM visits WHERE barbershop_id=? AND unit_id=? AND customer_id IS NOT NULL AND date(occurred_at,'-3 hours')>=? AND date(occurred_at,'-3 hours')<=? GROUP BY customer_id) SELECT COUNT(*) AS attended_customers,COUNT(CASE WHEN EXISTS (SELECT 1 FROM visits previous WHERE previous.customer_id=period_customers.customer_id AND previous.unit_id=? AND previous.occurred_at<period_customers.first_visit) THEN 1 END) AS returning_customers FROM period_customers`).bind(...tenant, scope.unitId).first<{ attended_customers: number; returning_customers: number }>(),
    ]);
    const serviceRevenue = totals?.service_revenue_cents ?? 0;
    const productRevenue = totals?.product_revenue_cents ?? 0;
    const revenue = serviceRevenue + productRevenue;
    const expenses = totals?.expenses_cents ?? 0;
    const returning = returns?.returning_customers ?? 0;
    const attended = returns?.attended_customers ?? 0;
    return NextResponse.json({
      period: { from, to, grouping: groupByMonth ? "month" : "day" },
      totals: { service_revenue_cents: serviceRevenue, product_revenue_cents: productRevenue, revenue_cents: revenue, expenses_cents: expenses, net_cents: revenue - expenses, average_ticket_cents: totals?.ticket_count ? Math.round(revenue / totals.ticket_count) : 0 },
      trend: trend.results,
      customers: customers.results,
      services: services.results,
      products: products.results,
      products_by_margin: productsByMargin.results,
      busiest_weekday: weekdays.results[0] ?? null,
      busiest_hours: hours.results,
      return_rate: { attended_customers: attended, returning_customers: returning, percent: attended ? Math.round(returning * 1000 / attended) / 10 : 0 },
    });
  } catch (error) {
    console.error("admin reports error", error);
    return fail("Não foi possível montar os relatórios.", 500);
  }
}
