"use client";

import { useCallback, useEffect, useState } from "react";

type Barber = { id: string; display_name: string; phone?: string | null };
type Hour = { id?: string; barber_id: string; weekday: number; opens_at: string; closes_at: string; is_open: number };
type Booking = { id: string; starts_at: string; ends_at: string; status: string; payment_status: string; price_cents: number; customer_name_snapshot: string; customer_phone_snapshot: string; service_name: string; barber_name: string };
type Block = { id: string; barber_id: string; starts_at: string; ends_at: string; reason: string | null };
type Settings = { slot_interval_minutes: number; cancellation_min_hours: number; max_days_ahead: number; payment_deadline_hours: number; payment_integration_enabled: number; payment_provider: string | null };
type ScheduleData = { barbers: Barber[]; hours: Hour[]; blocks: Block[]; settings: Settings | null };
type ApiResult = { error?: string; ok?: boolean };
const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const todayBahia = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const localInputToIso = (value: string) => new Date(`${value}:00-03:00`).toISOString();
const statusLabels: Record<string, string> = { REQUESTED: "Solicitado", AWAITING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Confirmado", COMPLETED: "Concluído", CANCELLED: "Cancelado", DECLINED: "Recusado", EXPIRED: "Expirado", NO_SHOW: "Não compareceu" };

export function AdminAgenda() {
  const [schedule, setSchedule] = useState<ScheduleData>({ barbers: [], hours: [], blocks: [], settings: null });
  const [hoursForm, setHoursForm] = useState<Record<string, { isOpen: boolean; opensAt: string; closesAt: string }>>({});
  const [appointments, setAppointments] = useState<Booking[]>([]);
  const [rules, setRules] = useState({ slot_interval_minutes: 15, cancellation_min_hours: 24, max_days_ahead: 60, payment_deadline_hours: 24 });
  const [selectedDate, setSelectedDate] = useState(todayBahia());
  const [blockForm, setBlockForm] = useState({ barberId: "", startsAt: "", endsAt: "", reason: "Folga/intervalo" });
  const [method, setMethod] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSchedule = useCallback(async () => {
    const response = await fetch("/api/admin/schedule");
    const data = await response.json() as ScheduleData & ApiResult;
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar a configuração da agenda.");
    setSchedule(data);
    if (data.settings) setRules({ slot_interval_minutes: data.settings.slot_interval_minutes, cancellation_min_hours: data.settings.cancellation_min_hours, max_days_ahead: data.settings.max_days_ahead, payment_deadline_hours: data.settings.payment_deadline_hours });
    const next: Record<string, { isOpen: boolean; opensAt: string; closesAt: string }> = {};
    for (const barber of data.barbers) for (let weekday = 0; weekday < 7; weekday++) {
      const found = data.hours.find((item) => item.barber_id === barber.id && item.weekday === weekday);
      next[`${barber.id}:${weekday}`] = { isOpen: Boolean(found), opensAt: found?.opens_at ?? "09:00", closesAt: found?.closes_at ?? "18:00" };
    }
    setHoursForm(next);
    setBlockForm((current) => ({ ...current, barberId: current.barberId || data.barbers[0]?.id || "" }));
  }, []);
  const loadAppointments = useCallback(async () => {
    if (!selectedDate) return;
    const response = await fetch(`/api/admin/appointments?date=${encodeURIComponent(selectedDate)}`);
    const data = await response.json() as { appointments?: Booking[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os agendamentos.");
    setAppointments(data.appointments ?? []);
  }, [selectedDate]);
  const refresh = useCallback(async () => {
    try { await Promise.all([loadSchedule(), loadAppointments()]); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao atualizar."); }
  }, [loadAppointments, loadSchedule]);
  useEffect(() => { void refresh(); }, [refresh]);

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const hours = Object.entries(hoursForm).map(([key, value]) => { const [barberId, weekday] = key.split(":"); return { barberId, weekday: Number(weekday), isOpen: value.isOpen, opensAt: value.opensAt, closesAt: value.closesAt }; });
      const response = await fetch("/api/admin/schedule", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { slot_interval_minutes: schedule.settings?.slot_interval_minutes ?? 15, cancellation_min_hours: schedule.settings?.cancellation_min_hours ?? 24, max_days_ahead: schedule.settings?.max_days_ahead ?? 60 }, hours }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setMessage("Horários da semana salvos."); await loadSchedule();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar horários."); }
    finally { setBusy(false); }
  };
  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const settings = rules;
      const hours = Object.entries(hoursForm).map(([key, value]) => { const [barberId, weekday] = key.split(":"); return { barberId, weekday: Number(weekday), isOpen: value.isOpen, opensAt: value.opensAt, closesAt: value.closesAt }; });
      const response = await fetch("/api/admin/schedule", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings, hours }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setMessage("Regras de agendamento salvas."); await loadSchedule();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar regras."); }
    finally { setBusy(false); }
  };
  const addBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ barberId: blockForm.barberId, startsAt: localInputToIso(blockForm.startsAt), endsAt: localInputToIso(blockForm.endsAt), reason: blockForm.reason }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar o bloqueio.");
      setMessage("Bloqueio de agenda criado."); setBlockForm((current) => ({ ...current, startsAt: "", endsAt: "" })); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao bloquear horário."); }
    finally { setBusy(false); }
  };
  const removeBlock = async (id: string) => {
    try { const response = await fetch(`/api/admin/schedule?id=${encodeURIComponent(id)}`, { method: "DELETE" }); const data = await response.json() as ApiResult; if (!response.ok) throw new Error(data.error ?? "Falha ao remover bloqueio."); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao remover bloqueio."); }
  };
  const appointmentAction = async (appointment: Booking, action: string) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/appointments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: appointment.id, action, method: method[appointment.id] ?? "PIX" }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar.");
      setMessage(action === "approve" ? "Solicitação aprovada; o cliente deve efetuar o pagamento antes da confirmação." : action === "confirm-payment" ? "Pagamento marcado como conferido e horário confirmado." : action === "decline" ? "Solicitação recusada." : "Agendamento cancelado.");
      await loadAppointments();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao atualizar agendamento."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-8">
    {message && <p role="status" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</p>}
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-semibold">Agenda do dia</h2><label className="mt-4 block max-w-xs text-sm text-[var(--muted)]">Data<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label>
      <div className="mt-5 space-y-3">{appointments.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">Nenhum agendamento neste dia.</p> : appointments.map((item) => <article key={item.id} className="rounded-xl border border-[var(--border)] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{timeLabel(item.starts_at)} — {item.customer_name_snapshot}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.service_name} · {item.barber_name} · {money(item.price_cents)}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.customer_phone_snapshot} · {statusLabels[item.status] ?? item.status}{item.payment_status === "PAID" ? " · Pago" : item.payment_status === "PENDING" ? " · Pagamento pendente" : ""}</p></div>
        <div className="flex flex-wrap items-center gap-2">{item.status === "REQUESTED" && <><button disabled={busy} onClick={() => void appointmentAction(item, "approve")} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">Aprovar</button><button disabled={busy} onClick={() => void appointmentAction(item, "decline")} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Recusar</button></>}{item.status === "AWAITING_PAYMENT" && <><select aria-label="Forma de pagamento conferida" value={method[item.id] ?? "PIX"} onChange={(event) => setMethod({ ...method, [item.id]: event.target.value })} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"><option value="PIX">Pix</option><option value="CASH">Dinheiro</option><option value="DEBIT_CARD">Débito</option><option value="CREDIT_CARD">Crédito</option></select><button disabled={busy} onClick={() => void appointmentAction(item, "confirm-payment")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50">Conferir pagamento</button></>}{["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(item.status) && <button disabled={busy} onClick={() => void appointmentAction(item, "cancel")} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50">Cancelar</button>}</div></div></article>)}</div>
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-semibold">Horários semanais</h2>{schedule.barbers.length === 0 ? <p className="mt-3 text-sm text-amber-200">Não há barbeiro ativo cadastrado nesta unidade. Cadastre o barbeiro antes de configurar a agenda.</p> : schedule.barbers.map((barber) => <form key={barber.id} onSubmit={saveSchedule} className="mt-5"><h3 className="font-semibold">{barber.display_name}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{weekdays.map((day, weekday) => { const key = `${barber.id}:${weekday}`; const value = hoursForm[key] ?? { isOpen: false, opensAt: "09:00", closesAt: "18:00" }; return <div key={key} className="rounded-lg border border-[var(--border)] p-3"><label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={value.isOpen} onChange={(event) => setHoursForm({ ...hoursForm, [key]: { ...value, isOpen: event.target.checked } })} className="accent-[var(--accent)]" />{day}</label>{value.isOpen && <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs text-[var(--muted)]">Abre<input type="time" value={value.opensAt} onChange={(event) => setHoursForm({ ...hoursForm, [key]: { ...value, opensAt: event.target.value } })} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] p-2 text-sm text-[var(--foreground)]" /></label><label className="text-xs text-[var(--muted)]">Fecha<input type="time" value={value.closesAt} onChange={(event) => setHoursForm({ ...hoursForm, [key]: { ...value, closesAt: event.target.value } })} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] p-2 text-sm text-[var(--foreground)]" /></label></div>}</div>; })}</div><button disabled={busy} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">Salvar horários</button></form>)}
      <p className="mt-4 text-xs text-[var(--muted)]">O intervalo dentro do expediente será gerado automaticamente. Use bloqueios para pausas, folgas e exceções de data.</p>
    </section>

    <section className="grid gap-6 lg:grid-cols-2"><form onSubmit={saveSettings} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Regras de agendamento</h2><label className="mt-4 block text-sm text-[var(--muted)]">Intervalo entre horários disponíveis<input name="slot_interval_minutes" type="number" min={5} max={120} value={rules.slot_interval_minutes} onChange={(event) => setRules({ ...rules, slot_interval_minutes: Number(event.target.value) })} required className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><label className="mt-3 block text-sm text-[var(--muted)]">Antecedência mínima para cancelar/remarcar (horas)<input name="cancellation_min_hours" type="number" min={0} max={720} value={rules.cancellation_min_hours} onChange={(event) => setRules({ ...rules, cancellation_min_hours: Number(event.target.value) })} required className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><label className="mt-3 block text-sm text-[var(--muted)]">Agendamentos disponíveis até (dias)<input name="max_days_ahead" type="number" min={1} max={365} value={rules.max_days_ahead} onChange={(event) => setRules({ ...rules, max_days_ahead: Number(event.target.value) })} required className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><p className="mt-3 text-xs text-[var(--muted)]">Confirmação manual ativa. O pagamento é conferido pelo proprietário; integração online ainda não está habilitada.</p><button disabled={busy} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">Salvar regras</button></form>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">Bloquear horário</h2><form onSubmit={addBlock} className="mt-4 space-y-3"><label className="block text-sm text-[var(--muted)]">Barbeiro<select required value={blockForm.barberId} onChange={(event) => setBlockForm({ ...blockForm, barberId: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]">{schedule.barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.display_name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm text-[var(--muted)]">Início<input required type="datetime-local" value={blockForm.startsAt} onChange={(event) => setBlockForm({ ...blockForm, startsAt: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><label className="text-sm text-[var(--muted)]">Fim<input required type="datetime-local" value={blockForm.endsAt} onChange={(event) => setBlockForm({ ...blockForm, endsAt: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label></div><label className="block text-sm text-[var(--muted)]">Motivo<input maxLength={200} value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><button disabled={busy || !schedule.barbers.length} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">Adicionar bloqueio</button></form><ul className="mt-5 space-y-2">{schedule.blocks.map((block) => <li key={block.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3 text-sm"><span>{timeLabel(block.starts_at)}–{timeLabel(block.ends_at)} · {block.reason ?? "Bloqueio"}</span><button onClick={() => void removeBlock(block.id)} className="text-red-300">Remover</button></li>)}</ul></div></section>
  </div>;
}
