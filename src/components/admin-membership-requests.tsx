"use client";

import { useEffect, useState } from "react";

type RequestItem = { id: string; display_name: string; email: string | null; created_at: string };

export function AdminMembershipRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/membership-requests", { cache: "no-store" });
    const data = await response.json() as { requests?: RequestItem[]; error?: string };
    if (response.ok) setRequests(data.requests ?? []);
    else setMessage(data.error || "Não foi possível carregar solicitações.");
  }

  useEffect(() => { void refresh(); }, []);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/membership-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setMessage(data.error || "Não foi possível atualizar o pedido."); return; }
    setMessage(action === "approve" ? "Vínculo de cliente aprovado." : "Solicitação recusada.");
    await refresh();
  }

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Solicitações de vínculo de clientes</h2><p className="mt-1 text-sm text-[var(--muted)]">Aprovar concede acesso de cliente somente à unidade selecionada.</p></div><button onClick={() => void refresh()} className="text-sm text-[var(--accent)]">Atualizar</button></div>{message && <p role="status" className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm">{message}</p>}<div className="mt-4 space-y-3">{requests.length ? requests.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4"><div><p className="font-semibold">{item.display_name}</p><p className="text-sm text-[var(--muted)]">{item.email || "Sem e-mail"} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => void decide(item.id, "approve")} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">Aprovar</button><button disabled={busy} onClick={() => void decide(item.id, "reject")} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Recusar</button></div></article>) : <p className="rounded-lg border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">Nenhuma solicitação pendente.</p>}</div></section>;
}
