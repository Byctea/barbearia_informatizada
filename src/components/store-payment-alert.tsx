"use client";

import { useCallback, useEffect, useState } from "react";

type Order = { status: string; payment_status: string; total_cents: number };
type Result = { orders?: Order[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function StorePaymentAlert() {
  const [pending, setPending] = useState<Order[]>([]);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/store-orders", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as Result;
    setPending((data.orders ?? []).filter((order) => order.payment_status === "PENDING" && order.status !== "CANCELLED"));
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  if (!pending.length) return null;
  const total = pending.reduce((sum, order) => sum + order.total_cents, 0);
  return <a href="/dashboard/pedidos" role="status" className="mb-5 block rounded-xl border border-amber-400/50 bg-amber-950/35 p-4 text-amber-100">
    <strong>{pending.length} pagamento(s) de produto aguardando baixa · {money(total)}</strong>
    <span className="mt-1 block text-sm text-amber-100/80">Abra os pedidos e marque como recebido para atualizar o cliente e o financeiro.</span>
  </a>;
}
