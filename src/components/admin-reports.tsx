"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomerPurchaseReport } from "@/components/customer-purchase-report";

type Totals = { service_revenue_cents: number; product_revenue_cents: number; revenue_cents: number; expenses_cents: number; net_cents: number; average_ticket_cents: number };
type Trend = { period: string; revenue_cents: number; expenses_cents: number };
type RankedCustomer = { id: string; full_name: string; visit_count: number; service_spend_cents: number; last_visit: string };
type RankedService = { name: string; visit_count: number; revenue_cents: number; estimated_cost_cents: number };
type RankedProduct = { name: string; quantity_sold: number; revenue_cents: number; cost_cents: number; margin_cents: number };
type Report = { period: { from: string; to: string; grouping: "day" | "month" }; totals: Totals; trend: Trend[]; customers: RankedCustomer[]; services: RankedService[]; products: RankedProduct[]; products_by_margin: RankedProduct[]; busiest_weekday: { weekday: number; total: number } | null; busiest_hours: { hour: number; total: number }[]; return_rate: { attended_customers: number; returning_customers: number; percent: number }; error?: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const dateMonthStart = (value: string) => `${value.slice(0, 7)}-01`;
const dateMonthEnd = (value: string) => `${value.slice(0, 7)}-${String(new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const dateLabel = (value: string, grouping: "day" | "month") => grouping === "month" ? new Date(`${value}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }) : new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const pct = (value: number, maximum: number) => maximum > 0 ? Math.max(value > 0 ? 2 : 0, Math.round(value * 100 / maximum)) : 0;

export function AdminReports() {
  const now = today();
  const [from, setFrom] = useState(dateMonthStart(now));
  const [to, setTo] = useState(dateMonthEnd(now));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const result = await response.json() as Report;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os relatórios.");
      setReport(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar relatórios."); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const applyPreset = (preset: "today" | "week" | "month" | "year") => {
    const current = today();
    if (preset === "today") { setFrom(current); setTo(current); return; }
    if (preset === "month") { setFrom(dateMonthStart(current)); setTo(dateMonthEnd(current)); return; }
    if (preset === "year") { setFrom(`${current.slice(0, 4)}-01-01`); setTo(current); return; }
    const date = new Date(`${current}T12:00:00Z`);
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7));
    setFrom(date.toISOString().slice(0, 10)); setTo(current);
  };

  const totals = report?.totals;
  const maxTrend = Math.max(1, ...(report?.trend ?? []).flatMap((item) => [item.revenue_cents, item.expenses_cents]));
  const busiestHour = report?.busiest_hours[0];
  const barbershopWeekday = report?.busiest_weekday;
  const summary = [
    ["Receita total", money(totals?.revenue_cents ?? 0), "Serviços + produtos", "text-emerald-200"],
    ["Serviços", money(totals?.service_revenue_cents ?? 0), "Atendimentos concluídos", ""],
    ["Produtos", money(totals?.product_revenue_cents ?? 0), "Vendas registradas", ""],
    ["Custos e despesas", money(totals?.expenses_cents ?? 0), "Saídas confirmadas no financeiro", "text-amber-200"],
    ["Lucro líquido", money(totals?.net_cents ?? 0), "Receita menos custos e despesas", (totals?.net_cents ?? 0) < 0 ? "text-red-300" : "text-emerald-200"],
    ["Ticket médio", money(totals?.average_ticket_cents ?? 0), "Média por lançamento de receita", ""],
  ] as const;

  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm">{error}</p>}
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Período analisado</h2><div className="mt-3 flex flex-wrap gap-2">{[["Hoje", "today"], ["Esta semana", "week"], ["Este mês", "month"], ["Este ano", "year"]].map(([label, value]) => <button key={value} onClick={() => applyPreset(value as "today" | "week" | "month" | "year")} className="rounded-full border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--accent)]">{label}</button>)}</div><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm">De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--background)] p-2" /></label><label className="text-sm">Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--background)] p-2" /></label><button onClick={() => void load()} disabled={loading} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">{loading ? "Atualizando…" : "Atualizar"}</button></div><p className="mt-2 text-xs text-[var(--muted)]">Valores em reais; datas e horários no fuso America/Bahia. {report?.period.grouping === "month" ? "A evolução está agrupada por mês." : "A evolução está agrupada por dia."}</p></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{summary.map(([label, value, detail, style]) => <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--muted)]">{label}</p><strong className={`mt-2 block text-2xl ${style}`}>{value}</strong><p className="mt-1 text-xs text-[var(--muted)]">{detail}</p></article>)}</section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-semibold">Receita × despesas</h2><p className="mt-1 text-sm text-[var(--muted)]">Somente lançamentos confirmados.</p></div><div className="flex gap-3 text-xs"><span className="text-emerald-200">■ Receita</span><span className="text-amber-200">■ Despesas</span></div></div>{report?.trend.length ? <div className="mt-5 flex h-52 items-end gap-1 overflow-x-auto border-b border-[var(--border)] pb-1">{report.trend.map((item) => <div key={item.period} title={`${dateLabel(item.period, report.period.grouping)}: receita ${money(item.revenue_cents)}, despesas ${money(item.expenses_cents)}`} className="flex h-full min-w-8 flex-1 flex-col justify-end"><div className="flex h-full items-end justify-center gap-0.5"><span className="w-2/5 rounded-t bg-emerald-500/80" style={{ height: `${pct(item.revenue_cents, maxTrend)}%` }} /><span className="w-2/5 rounded-t bg-amber-500/80" style={{ height: `${pct(item.expenses_cents, maxTrend)}%` }} /></div><span className="mt-1 truncate text-center text-[9px] text-[var(--muted)]">{dateLabel(item.period, report.period.grouping)}</span></div>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Sem movimentação financeira no período selecionado.</p>}</section>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Serviços mais realizados</h2><div className="mt-4 space-y-3">{report?.services.length ? report.services.map((item) => <article key={item.name} className="rounded-lg border border-[var(--border)] p-3"><div className="flex justify-between gap-2"><strong>{item.name}</strong><span className="text-sm">{item.visit_count} vez(es)</span></div><div className="mt-2 h-1.5 rounded bg-[var(--background)]"><div className="h-1.5 rounded bg-[var(--accent)]" style={{ width: `${pct(Number(item.visit_count), Math.max(1, ...report.services.map((row) => Number(row.visit_count))))}%` }} /></div><p className="mt-2 text-xs text-[var(--muted)]">Receita {money(Number(item.revenue_cents))} · custo estimado {money(Number(item.estimated_cost_cents))} · margem bruta {money(Number(item.revenue_cents) - Number(item.estimated_cost_cents))}</p></article>) : <p className="text-sm text-[var(--muted)]">Sem atendimentos no período.</p>}</div></div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Produtos mais vendidos</h2><div className="mt-4 space-y-3">{report?.products.length ? report.products.map((item) => <article key={item.name} className="rounded-lg border border-[var(--border)] p-3"><div className="flex justify-between gap-2"><strong>{item.name}</strong><span className="text-sm">{item.quantity_sold} un.</span></div><div className="mt-2 h-1.5 rounded bg-[var(--background)]"><div className="h-1.5 rounded bg-[var(--accent)]" style={{ width: `${pct(Number(item.quantity_sold), Math.max(1, ...report.products.map((row) => Number(row.quantity_sold))))}%` }} /></div><p className="mt-2 text-xs text-[var(--muted)]">Receita {money(Number(item.revenue_cents))} · margem bruta {money(Number(item.margin_cents))}</p></article>) : <p className="text-sm text-[var(--muted)]">Sem vendas no período.</p>}</div><div className="mt-5 border-t border-[var(--border)] pt-4"><h3 className="font-medium">Produtos de maior margem</h3><ol className="mt-2 space-y-2">{report?.products_by_margin.length ? report.products_by_margin.map((item, index) => <li key={item.name} className="flex justify-between gap-3 rounded-lg border border-[var(--border)] p-3 text-sm"><span>{index + 1}. {item.name} · {item.quantity_sold} un.</span><strong>{money(Number(item.margin_cents))}</strong></li>) : <li className="text-sm text-[var(--muted)]">Sem vendas no período.</li>}</ol></div></div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Clientes que mais cortam</h2><ol className="mt-4 space-y-2">{report?.customers.length ? report.customers.map((customer, index) => <li key={customer.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"><div><strong>{index + 1}. {customer.full_name}</strong><p className="text-xs text-[var(--muted)]">Último corte: {new Date(`${customer.last_visit}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p></div><span className="text-right text-sm">{customer.visit_count} corte(s)<br />{money(Number(customer.service_spend_cents))}</span></li>) : <li className="text-sm text-[var(--muted)]">Sem clientes atendidos no período.</li>}</ol></div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Retorno e movimento</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-[var(--border)] p-3"><p className="text-sm text-[var(--muted)]">Taxa de retorno</p><strong className="mt-1 block text-2xl">{report?.return_rate.percent ?? 0}%</strong><p className="text-xs text-[var(--muted)]">{report?.return_rate.returning_customers ?? 0} de {report?.return_rate.attended_customers ?? 0} clientes já tinham vindo antes do período.</p></div><div className="rounded-lg border border-[var(--border)] p-3"><p className="text-sm text-[var(--muted)]">Dia mais movimentado</p><strong className="mt-1 block text-xl">{barbershopWeekday ? weekdayNames[barbershopWeekday.weekday] : "—"}</strong><p className="text-xs text-[var(--muted)]">{barbershopWeekday?.total ?? 0} atendimento(s)</p></div></div><h3 className="mt-5 font-medium">Horários de maior movimento</h3>{report?.busiest_hours.length ? <div className="mt-2 space-y-2">{report.busiest_hours.slice(0, 5).map((item) => <div key={item.hour} className="flex items-center gap-3 text-sm"><span className="w-14">{String(item.hour).padStart(2, "0")}:00</span><div className="h-2 flex-1 rounded bg-[var(--background)]"><div className="h-2 rounded bg-[var(--accent)]" style={{ width: `${pct(item.total, Math.max(1, ...report.busiest_hours.map((row) => row.total)))}%` }} /></div><span className="w-16 text-right text-[var(--muted)]">{item.total}</span></div>)}<p className="text-xs text-[var(--muted)]">Faixa de maior movimento: {busiestHour ? `${String(busiestHour.hour).padStart(2, "0")}:00` : "—"}–{busiestHour ? `${String(busiestHour.hour + 1).padStart(2, "0")}:00` : "—"}</p></div> : <p className="mt-2 text-sm text-[var(--muted)]">Sem atendimentos no período.</p>}</div>
    </section>
    <CustomerPurchaseReport />
  </div>;
}
