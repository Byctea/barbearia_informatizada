"use client";

import { useCallback, useEffect, useState } from "react";

type Notification = { id: string; type: string; title: string; message: string; link: string | null; created_at: string; read_at: string | null };
export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (response.ok) { const data = await response.json() as { notifications?: Notification[] }; setItems(data.notifications ?? []); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 30000); return () => window.clearInterval(timer); }, [refresh]);
  const unread = items.filter((item) => !item.read_at);
  if (!items.length) return null;
  return <section aria-label="Notificações" className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <h2 className="font-semibold">Notificações{unread.length > 0 ? ` (${unread.length} novas)` : ""}</h2>
    <ul className="mt-3 space-y-2">{items.slice(0, 8).map((item) => { const destination = item.type === "NEW_SALE" ? "/dashboard/vendas" : item.link; return <li key={item.id} className={`rounded-lg border p-3 text-sm ${item.read_at ? "border-[var(--border)]" : "border-amber-400/40"}`}>
      {destination ? <a href={destination} onClick={() => { if (!item.read_at) void fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) }); }} className="font-medium hover:underline">{item.title}</a> : <strong>{item.title}</strong>}
      <p className="mt-1 text-[var(--muted)]">{item.message}</p><time className="mt-1 block text-xs text-[var(--muted)]">{new Date(item.created_at).toLocaleString("pt-BR")}</time>
    </li>; })}</ul>
  </section>;
}
