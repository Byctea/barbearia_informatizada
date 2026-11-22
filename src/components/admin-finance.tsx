"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; entry_type: "INCOME" | "EXPENSE"; category: string; description: string; amount_cents: number; occurred_on: string; payment_method: string | null; recurrence_group_id: string | null; status: "PENDING" | "CONFIRMED" | "CANCELLED"; notes: string | null; sale_id: string | null; visit_id: string | null; stock_movement_id: string | null };
type Payload = { entries: Entry[]; totals: { income_cents: number; expense_cents: number; pending_count: number }; hasMore?: boolean; error?: string; created?: number };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const categories: [string, string][] = [["RENT", "Aluguel"], ["ENERGY", "Energia"], ["WATER", "Água"], ["INTERNET", "Internet"], ["EQUIPMENT", "Equipamentos"], ["OTHER", "Outros"]];
const methods: [string, string][] = [["PIX", "Pix"], ["CASH", "Dinheiro"], ["DEBIT_CARD", "Cartão de débito"], ["CREDIT_CARD", "Cartão de crédito"], ["OTHER", "Outro"]];
const categoryName: Record<string, string> = { SERVICE: "Serviços", PRODUCT: "Produtos", SUPPLIES: "Compra de produtos", ...Object.fromEntries(categories) };
const methodName: Record<string, string> = Object.fromEntries(methods);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const monthEnd = (date: string) => `${date.slice(0, 7)}-${new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()}`;

export function AdminFinance() {
  const current = today();
  const [from, setFrom] = useState(monthStart(current));
  const [to, setTo] = useState(monthEnd(current));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ category: "RENT", description: "", amount: "", occurredOn: current, paymentMethod: "PIX", notes: "", monthly: false });

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/finance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
    const result = await response.json() as Payload;
    if (!response.ok) throw new Error(result.error ?? "Falha ao carregar financeiro.");
    setEntries(result.entries ?? []);
    setIncome(result.totals?.income_cents ?? 0);
    setExpenses(result.totals?.expense_cents ?? 0);
    setPendingCount(result.totals?.pending_count ?? 0);
    setHasMore(result.hasMore ?? false);
  }, [from, to]);
  useEffect(() => { void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Falha ao carregar.")); }, [refresh]);

  const submitExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: form.category, description: form.description, amountCents: Math.round(Number(form.amount.replace(",", ".")) * 100), occurredOn: form.occurredOn, paymentMethod: form.paymentMethod, notes: form.notes, monthly: form.monthly }) });
      const result = await response.json() as Payload;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setMessage(form.monthly ? "Série mensal registrada. Ocorrências futuras ficam pendentes até a confirmação do pagamento." : form.occurredOn > today() ? "Despesa futura registrada como pendente." : "Despesa registrada.");
      setForm((old) => ({ ...old, description: "", amount: "", notes: "", monthly: false }));
      try { await refresh(); } catch { setMessage("Despesa salva. A lista não atualizou; atualize a página para conferir."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao registrar despesa."); }
    finally { setBusy(false); }
  };

  const updatePending = async (entry: Entry, status: "CONFIRMED" | "CANCELLED") => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/finance", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entry.id, status }) });
      const result = await response.json() as Payload;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar.");
      setMessage(status === "CONFIRMED" ? "Despesa confirmada e incluída no fluxo de caixa." : "Despesa futura cancelada.");
      try { await refresh(); } catch { setMessage("Lançamento atualizado. A lista não atualizou; atualize a página para conferir."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao atualizar."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    {message && <p role="status" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</p>}
    <section className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--muted)]">Receitas confirmadas</p><strong className="mt-2 block text-2xl">{money(income)}</strong></article>
      <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--muted)]">Despesas confirmadas</p><strong className="mt-2 block text-2xl">{money(expenses)}</strong></article>
      <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm text-[var(--muted)]">Saldo do período</p><strong className={`mt-2 block text-2xl ${income - expenses < 0 ? "text-red-300" : "text-emerald-200"}`}>{money(income - expenses)}</strong><p className="mt-1 text-xs text-[var(--muted)]">{pendingCount} lançamento(s) futuro(s) pendente(s)</p></article>
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-xl font-semibold">Período do fluxo de caixa</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm">De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--background)] p-2" /></label><label className="text-sm">Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--background)] p-2" /></label><button type="button" onClick={() => { const now = today(); setFrom(monthStart(now)); setTo(monthEnd(now)); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Mês atual</button></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={submitExpense} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-semibold">Registrar despesa</h2>
        <label className="block text-sm">Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm">Descrição<input required minLength={2} maxLength={120} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex.: aluguel da unidade" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Valor (R$)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label><label className="text-sm">Data<input required type="date" value={form.occurredOn} onChange={(event) => setForm({ ...form, occurredOn: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label></div>
        <label className="block text-sm">Forma de pagamento<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">{methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm">Observações (opcional)<input maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.monthly} onChange={(event) => setForm({ ...form, monthly: event.target.checked })} className="mt-1" /><span>Repetir mensalmente por 12 meses. As ocorrências futuras ficam pendentes e só entram no saldo quando forem confirmadas.</span></label>
        <button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">Registrar despesa</button>
      </form>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Lançamentos do período</h2><p className="mt-1 text-sm text-[var(--muted)]">Receitas de serviços, vendas e compras são registradas automaticamente. Despesas ligadas a esses registros são protegidas contra alteração aqui.</p>{hasMore && <p className="mt-3 rounded-lg border border-amber-700/50 p-3 text-sm text-amber-100">Exibindo os 500 lançamentos mais recentes. Os totais acima consideram todos os lançamentos do período.</p>}<div className="mt-4 space-y-2">{entries.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Nenhum lançamento neste período.</p> : entries.map((entry) => <article key={entry.id} className="rounded-xl border border-[var(--border)] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{entry.description}</p><p className="text-xs text-[var(--muted)]">{new Date(`${entry.occurred_on}T12:00:00-03:00`).toLocaleDateString("pt-BR")} · {categoryName[entry.category] ?? entry.category}{entry.payment_method ? ` · ${methodName[entry.payment_method] ?? entry.payment_method}` : ""}</p></div><strong className={entry.entry_type === "INCOME" ? "text-emerald-200" : "text-amber-200"}>{entry.entry_type === "INCOME" ? "+" : "−"}{money(entry.amount_cents)}</strong></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className={`text-xs ${entry.status === "CONFIRMED" ? "text-emerald-200" : entry.status === "PENDING" ? "text-amber-200" : "text-[var(--muted)]"}`}>{entry.status === "CONFIRMED" ? "Confirmado" : entry.status === "PENDING" ? "Pendente" : "Cancelado"}{entry.recurrence_group_id ? " · recorrência mensal" : ""}</span>{entry.status === "PENDING" && <div className="flex gap-2"><button disabled={busy} onClick={() => void updatePending(entry, "CONFIRMED")} className="rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 disabled:opacity-50">Confirmar pagamento</button><button disabled={busy} onClick={() => void updatePending(entry, "CANCELLED")} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50">Cancelar</button></div>}</div>{entry.notes && <p className="mt-1 text-xs text-[var(--muted)]">{entry.notes}</p>}</article>)}</div></section>
    </section>
  </div>;
}
