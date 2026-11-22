"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Service = { id: string; name: string; description: string | null; duration_minutes: number; price_cents: number };
type BarberOption = { id: string; name: string };
type Slot = { barberId: string; barberName: string; startsAt: string; endsAt: string; time: string };
type Booking = { id: string; starts_at: string; ends_at: string; status: string; payment_status: string; price_cents: number; service_id: string; barber_id: string; service_name: string; barber_name: string };
type ApiResult = { error?: string; message?: string; data?: Service[]; barbers?: BarberOption[]; unit?: { name: string; phone: string | null }; ok?: boolean; id?: string };
const todayBahia = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const price = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", dateStyle: "full", timeStyle: "short" }).format(new Date(value));
const statusNames: Record<string, string> = { REQUESTED: "Aguardando análise", AWAITING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Confirmado", CANCELLED: "Cancelado", DECLINED: "Recusado", EXPIRED: "Expirado", COMPLETED: "Concluído", NO_SHOW: "Não compareceu" };

export function ClientAgenda({ customerName, shopSlug }: { customerName: string; shopSlug?: string }) {
  const shopQuery = shopSlug ? `&shop=${encodeURIComponent(shopSlug)}` : "";
  const shopBody = shopSlug ? { barbershopSlug: shopSlug } : {};
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [unit, setUnit] = useState<{ name: string; phone: string | null } | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [barberFilter, setBarberFilter] = useState("");
  const [date, setDate] = useState(todayBahia());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [appointments, setAppointments] = useState<Booking[]>([]);
  const [reschedule, setReschedule] = useState<Booking | null>(null);
  const [message, setMessage] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const slotRequestSequence = useRef(0);

  const loadServices = useCallback(async () => {
    const response = await fetch(`/api/appointments?view=services${shopQuery}`);
    const result = await response.json() as ApiResult;
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os serviços.");
    setServices(result.data ?? []); setBarbers(result.barbers ?? []); setUnit(result.unit ?? null);
    if (!serviceId && result.data?.length) setServiceId(result.data[0].id);
  }, [serviceId, shopQuery]);
  const loadMine = useCallback(async () => {
    const response = await fetch(`/api/appointments?view=mine${shopQuery}`);
    const result = await response.json() as ApiResult & { data?: Booking[] };
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar seus agendamentos.");
    setAppointments(result.data ?? []);
  }, [shopQuery]);
  const loadSlots = useCallback(async () => {
    const sequence = ++slotRequestSequence.current;
    if (!serviceId || !date) { setSlots([]); setSelected(null); setLoadingSlots(false); return; }
    setLoadingSlots(true); setSelected(null); setSlots([]);
    try {
      const response = await fetch(`/api/appointments?view=availability&date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}${shopQuery}`);
      const result = await response.json() as { data?: Slot[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar horários.");
      if (sequence === slotRequestSequence.current) setSlots(result.data ?? []);
    } catch (error) { if (sequence === slotRequestSequence.current) setMessage(error instanceof Error ? error.message : "Falha ao consultar horários."); }
    finally { if (sequence === slotRequestSequence.current) setLoadingSlots(false); }
  }, [date, serviceId, shopQuery]);
  useEffect(() => { void Promise.all([loadServices(), loadMine()]).catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar.")); }, [loadMine, loadServices]);
  useEffect(() => { void loadSlots(); }, [loadSlots]);

  const createRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) { setMessage("Escolha um horário disponível."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...shopBody, action: "request", serviceId, barberId: selected.barberId, startsAt: selected.startsAt, fullName: name, phone, consent }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível solicitar o horário.");
      setMessage(result.message ?? "Solicitação enviada."); setSelected(null); await Promise.all([loadSlots(), loadMine()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao solicitar." ); }
    finally { setBusy(false); }
  };
  const cancelBooking = async (appointment: Booking) => {
    if (!window.confirm("Deseja cancelar esta solicitação?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...shopBody, action: "cancel", appointmentId: appointment.id }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível cancelar.");
      setMessage("Agendamento cancelado."); await Promise.all([loadMine(), loadSlots()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cancelar."); }
    finally { setBusy(false); }
  };
  const submitReschedule = async () => {
    if (!reschedule || !selected) { setMessage("Escolha um novo horário para continuar."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...shopBody, action: "reschedule", appointmentId: reschedule.id, startsAt: selected.startsAt }) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível solicitar a remarcação.");
      setMessage(result.message ?? "Remarcação solicitada."); setReschedule(null); setSelected(null); await Promise.all([loadMine(), loadSlots()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao remarcar."); }
    finally { setBusy(false); }
  };
  const startReschedule = (booking: Booking) => { setReschedule(booking); setServiceId(booking.service_id); setSelected(null); setMessage("Selecione uma data e horário para a remarcação; o pagamento será transferido para a nova solicitação."); document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" }); };

  const displayedSlots = slots.filter((slot) => reschedule ? slot.barberId === reschedule.barber_id : !barberFilter || slot.barberId === barberFilter);

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8"><header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><div className="flex gap-3"><a href="/dashboard" className="text-[var(--accent)]">← Meu painel</a>{shopSlug && <a href={`/b/${shopSlug}/loja`} className="text-[var(--accent)]">Loja</a>}</div><a href="/" className="font-semibold">Barber Flow</a></header><section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">AGENDE SEU HORÁRIO</p><h1 className="mt-2 text-3xl font-semibold">{unit?.name ?? "Barbearia"}</h1><p className="mt-2 text-sm text-[var(--muted)]">Escolha serviço, data e horário. Sua solicitação será analisada pelo proprietário.</p>
      {message && <p role="status" className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</p>}
      <div id="booking-form" className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><form onSubmit={createRequest} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-semibold">{reschedule ? "Escolha a nova data" : "Novo agendamento"}</h2><label className="mt-4 block text-sm text-[var(--muted)]">Serviço<select disabled={Boolean(reschedule)} value={serviceId} onChange={(event) => setServiceId(event.target.value)} required className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]"><option value="" disabled>Selecione</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min · {price(service.price_cents)}</option>)}</select></label><label className="mt-4 block text-sm text-[var(--muted)]">Data<input type="date" min={todayBahia()} value={date} onChange={(event) => setDate(event.target.value)} required className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label>
        <label className="mt-4 block text-sm text-[var(--muted)]">Barbeiro de preferência<select disabled={Boolean(reschedule)} value={reschedule?.barber_id ?? barberFilter} onChange={(event) => { setBarberFilter(event.target.value); setSelected(null); }} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]"><option value="">Qualquer barbeiro</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select></label>
        <fieldset className="mt-4"><legend className="text-sm text-[var(--muted)]">Horários disponíveis</legend>{loadingSlots ? <p className="mt-2 text-sm text-[var(--muted)]">Consultando horários…</p> : displayedSlots.length === 0 ? <p className="mt-2 rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Não há horários livres nesta data.</p> : <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{displayedSlots.map((slot) => <button type="button" key={`${slot.barberId}-${slot.startsAt}`} onClick={() => setSelected(slot)} className={`rounded-lg border px-3 py-3 text-sm ${selected?.startsAt === slot.startsAt && selected.barberId === slot.barberId ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted)]"}`}><strong>{slot.time}</strong><span className="mt-1 block text-xs">{slot.barberName}</span></button>)}</div>}</fieldset>
        {!reschedule && <><label className="mt-4 block text-sm text-[var(--muted)]">Nome<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><label className="mt-4 block text-sm text-[var(--muted)]">Telefone / WhatsApp<input required type="tel" minLength={8} maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]" /></label><label className="mt-4 flex items-start gap-3 text-sm text-[var(--muted)]"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-[var(--accent)]" /><span>Autorizo o uso dos meus dados para administrar este agendamento, conforme a política de privacidade.</span></label></>}
        <div className="mt-5 flex flex-wrap gap-3">{reschedule ? <><button type="button" disabled={busy || !selected} onClick={() => void submitReschedule()} className="rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">Solicitar remarcação</button><button type="button" onClick={() => { setReschedule(null); setSelected(null); setBarberFilter(""); }} className="rounded-lg border border-[var(--border)] px-4 py-3">Voltar</button></> : <button disabled={busy || !services.length || !selected} className="rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Enviando…" : "Solicitar agendamento"}</button>}</div>
      </form>
      <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-semibold">Como funciona</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[var(--muted)]"><li>Você envia uma solicitação para o horário escolhido.</li><li>O proprietário analisa e entra em contato para orientar o pagamento antecipado.</li><li>Após conferir o pagamento, o proprietário confirma o agendamento.</li><li>Para desistência após pagar, solicite uma remarcação; o pagamento será transferido para o novo pedido.</li></ol>{unit?.phone && <a href={`https://wa.me/55${unit.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--accent)]">Falar com a barbearia pelo WhatsApp</a>}<p className="mt-4 text-xs text-[var(--muted)]">Integração automática de pagamento ainda não está habilitada.</p></aside></div>
      <section className="mt-10"><h2 className="text-2xl font-semibold">Meus agendamentos</h2>{appointments.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">Você ainda não tem solicitações.</p> : <div className="mt-4 space-y-3">{appointments.map((booking) => { const active = ["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(booking.status); const paid = booking.payment_status === "PAID"; return <article key={booking.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{booking.service_name} · {dateTime(booking.starts_at)}</p><p className="mt-1 text-sm text-[var(--muted)]">{booking.barber_name} · {price(booking.price_cents)} · {statusNames[booking.status] ?? booking.status}{paid ? " · Pagamento recebido" : ""}</p></div>{active && <div className="flex gap-2">{booking.status === "CONFIRMED" && <button onClick={() => startReschedule(booking)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Remarcar</button>}{!paid && booking.status !== "CONFIRMED" && <button disabled={busy} onClick={() => void cancelBooking(booking)} className="rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Cancelar</button>}{booking.status !== "CONFIRMED" && paid && <button onClick={() => startReschedule(booking)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Remarcar</button>}</div>}</div></article>; })}</div>}</section>
    </section></main>;
}
