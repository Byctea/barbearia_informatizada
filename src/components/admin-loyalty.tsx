"use client";

import { useCallback, useEffect, useState } from "react";

type Program = { id: string; name: string; program_type: "VISITS" | "POINTS"; visits_required: number | null; points_per_currency_unit: number | null; points_required: number | null; reward_description: string };
type Customer = { id: string; full_name: string; phone: string; preferred_return_days: number | null; is_loyalty_member: number; last_visit: string | null; total_visits: number; visits_balance: number; points_balance: number; days_since_last_visit: number | null; ideal_return_days: number; status: "ON_TIME" | "LATE" | "INACTIVE" };
type Result = { program: Program | null; customers: Customer[]; error?: string };
const fresh = () => ({ programType: "VISITS" as "VISITS" | "POINTS", visitsRequired: "10", pointsPerCurrencyUnit: "1", pointsRequired: "100", rewardDescription: "1 recompensa grátis" });
const statusText = { ON_TIME: "Em dia", LATE: "Atrasado", INACTIVE: "Inativo" };
const statusStyle = { ON_TIME: "text-emerald-200", LATE: "text-amber-200", INACTIVE: "text-[var(--muted)]" };

export function AdminLoyalty() {
  const [program, setProgram] = useState<Program | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(fresh);
  const [intervals, setIntervals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/loyalty", { cache: "no-store" });
    const result = await response.json() as Result;
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar a fidelidade.");
    setProgram(result.program);
    setCustomers(result.customers ?? []);
    setIntervals(Object.fromEntries((result.customers ?? []).map((customer) => [customer.id, String(customer.preferred_return_days ?? 30)])));
    if (result.program) setForm({ programType: result.program.program_type, visitsRequired: String(result.program.visits_required ?? 10), pointsPerCurrencyUnit: String(result.program.points_per_currency_unit ?? 1), pointsRequired: String(result.program.points_required ?? 100), rewardDescription: result.program.reward_description });
  }, []);
  useEffect(() => { void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Falha ao carregar.")); }, [refresh]);
  const request = async (url: string, method: string, body: unknown, success: string) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as Result;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a operação.");
      setMessage(success);
      try { await refresh(); } catch { setMessage(`${success} A tela não atualizou; atualize a página para conferir.`); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na operação."); }
    finally { setBusy(false); }
  };
  const saveProgram = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void request("/api/admin/loyalty", "POST", { action: "configure", programType: form.programType, visitsRequired: form.programType === "VISITS" ? Number(form.visitsRequired) : null, pointsPerCurrencyUnit: form.programType === "POINTS" ? Number(form.pointsPerCurrencyUnit) : null, pointsRequired: form.programType === "POINTS" ? Number(form.pointsRequired) : null, rewardDescription: form.rewardDescription }, "Regra de fidelidade salva.");
  };
  const toggleMember = (customer: Customer) => void request("/api/admin/loyalty", "PATCH", { customerId: customer.id, isMember: !customer.is_loyalty_member, preferredReturnDays: customer.preferred_return_days ?? 30 }, customer.is_loyalty_member ? "Cliente removido do programa." : "Cliente incluído no programa.");
  const saveInterval = (customer: Customer) => void request("/api/admin/loyalty", "PATCH", { customerId: customer.id, isMember: Boolean(customer.is_loyalty_member), preferredReturnDays: Number(intervals[customer.id]) }, "Intervalo ideal de retorno atualizado.");
  const canRedeem = (customer: Customer) => Boolean(program && customer.is_loyalty_member && (program.program_type === "VISITS" ? customer.visits_balance >= (program.visits_required ?? Infinity) : customer.points_balance >= (program.points_required ?? Infinity)));
  const whatsapp = (customer: Customer) => {
    const phone = customer.phone.replace(/\D/g, "");
    const text = `Olá, ${customer.full_name}! Sentimos sua falta na barbearia. Já faz ${customer.days_since_last_visit ?? "um tempo"} dia(s) desde seu último atendimento. Quer agendar um horário?`;
    return `https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}?text=${encodeURIComponent(text)}`;
  };

  return <div className="space-y-6">
    {message && <p role="status" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</p>}
    <form onSubmit={saveProgram} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div><h2 className="text-xl font-semibold">Regra do programa</h2><p className="mt-1 text-sm text-[var(--muted)]">Os créditos são gerados automaticamente ao concluir um atendimento ou registrar uma venda para cliente participante.</p></div>
      <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={form.programType === "VISITS"} onChange={() => setForm({ ...form, programType: "VISITS" })} />Cortes/atendimentos</label><label className="flex items-center gap-2"><input type="radio" checked={form.programType === "POINTS"} onChange={() => setForm({ ...form, programType: "POINTS" })} />Pontos por valor</label></div>
      <div className="grid gap-3 sm:grid-cols-2">{form.programType === "VISITS" ? <label className="text-sm">Atendimentos para liberar recompensa<input required type="number" min="2" max="100" value={form.visitsRequired} onChange={(event) => setForm({ ...form, visitsRequired: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label> : <><label className="text-sm">Pontos por R$ 1 gasto<input required type="number" min="1" max="1000" value={form.pointsPerCurrencyUnit} onChange={(event) => setForm({ ...form, pointsPerCurrencyUnit: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label><label className="text-sm">Pontos para liberar recompensa<input required type="number" min="1" max="1000000" value={form.pointsRequired} onChange={(event) => setForm({ ...form, pointsRequired: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label></>}<label className="text-sm sm:col-span-2">Recompensa<input required minLength={2} maxLength={160} value={form.rewardDescription} onChange={(event) => setForm({ ...form, rewardDescription: event.target.value })} placeholder="Ex.: 1 corte grátis" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label></div>
      {program && <p className="text-xs text-[var(--muted)]">Para preservar os saldos, o tipo do programa não pode ser alterado depois que existirem créditos ou resgates.</p>}
      <button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">Salvar regra</button>
    </form>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-semibold">Retorno e fidelidade dos clientes</h2><p className="mt-1 text-sm text-[var(--muted)]">Sem intervalo definido, o painel usa 30 dias. Clientes sem atendimentos ou há 90 dias sem retornar aparecem como inativos.</p></div><button onClick={() => void refresh()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Atualizar</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{(["ON_TIME", "LATE", "INACTIVE"] as const).map((status) => <div key={status} className="rounded-xl border border-[var(--border)] p-3"><span className={`text-sm ${statusStyle[status]}`}>{statusText[status]}</span><strong className="mt-1 block text-2xl">{customers.filter((customer) => customer.status === status).length}</strong></div>)}</div>
      <div className="mt-4 space-y-3">{customers.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Cadastre clientes para acompanhar retorno e fidelidade.</p> : customers.map((customer) => <article key={customer.id} className="rounded-xl border border-[var(--border)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong>{customer.full_name}</strong><span className={`text-xs ${statusStyle[customer.status]}`}>{statusText[customer.status]}</span><span className="text-xs text-[var(--muted)]">{customer.days_since_last_visit === null ? "Sem atendimento registrado" : `${customer.days_since_last_visit} dia(s) desde o último corte`}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{customer.total_visits} atendimento(s) no histórico{customer.last_visit ? ` · último em ${new Date(`${customer.last_visit}T12:00:00-03:00`).toLocaleDateString("pt-BR")}` : ""}</p><p className="mt-1 text-sm">{program?.program_type === "POINTS" ? `${customer.points_balance} ponto(s)` : `${customer.visits_balance} atendimento(s) acumulado(s)`}{program ? ` · recompensa: ${program.reward_description}` : " · configure um programa para iniciar os créditos"}</p></div><div className="flex flex-wrap gap-2">{customer.status !== "ON_TIME" && <a target="_blank" rel="noreferrer" href={whatsapp(customer)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200">Lembrar pelo WhatsApp</a>}{program && <button disabled={busy || !canRedeem(customer)} onClick={() => void request("/api/admin/loyalty", "POST", { action: "redeem", customerId: customer.id }, "Recompensa resgatada; saldo atualizado.")} className="rounded-lg border border-[var(--accent)] px-3 py-2 text-xs text-[var(--accent)] disabled:opacity-40">Resgatar recompensa</button>}</div></div><div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-3"><label className="text-xs">Intervalo ideal (dias)<input type="number" min="1" max="365" value={intervals[customer.id] ?? "30"} onChange={(event) => setIntervals({ ...intervals, [customer.id]: event.target.value })} className="mt-1 block w-32 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2" /></label><button disabled={busy} onClick={() => saveInterval(customer)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50">Salvar intervalo</button><button disabled={busy || !program} onClick={() => toggleMember(customer)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50">{customer.is_loyalty_member ? "Remover da fidelidade" : "Ativar fidelidade"}</button></div></article>)}</div>
    </section>
  </div>;
}
