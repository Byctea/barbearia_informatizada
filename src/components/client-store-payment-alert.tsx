"use client";

import { useCallback, useEffect, useState } from "react";

type Shop = { name: string; slug: string };
type Order = { status: string; payment_status: string; total_cents: number };
type Result = { orders?: Order[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function ClientStorePaymentAlert({ shops }: { shops: Shop[] }) {
  const [pending, setPending] = useState<{ shop: Shop; count: number; total: number }[]>([]);
  const refresh = useCallback(async () => {
    const results = await Promise.all(shops.map(async (shop) => {
      const response = await fetch(`/api/store-orders?shop=${encodeURIComponent(shop.slug)}`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json() as Result;
      const orders = (data.orders ?? []).filter((order) => order.payment_status === "PENDING" && order.status !== "CANCELLED");
      return orders.length ? { shop, count: orders.length, total: orders.reduce((sum, order) => sum + order.total_cents, 0) } : null;
    }));
    setPending(results.filter((item): item is { shop: Shop; count: number; total: number } => item !== null));
  }, [shops]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  if (!pending.length) return null;
  const totalCount = pending.reduce((sum, shop) => sum + shop.count, 0);
  const total = pending.reduce((sum, shop) => sum + shop.total, 0);
  return <aside className="mt-5 rounded-xl border border-amber-400/45 bg-amber-950/30 p-4" role="status">
    <strong className="text-amber-100">Você tem {totalCount} compra(s) aguardando pagamento · {money(total)}</strong>
    <p className="mt-1 text-sm text-amber-100/80">A pendência será removida quando a barbearia confirmar o recebimento.</p>
    <div className="mt-3 flex flex-wrap gap-2">{pending.map(({ shop, count, total: shopTotal }) => <a key={shop.slug} className="rounded-lg border border-amber-200/30 px-3 py-2 text-sm text-amber-100" href={`/b/${shop.slug}/loja`}>Abrir {shop.name} · {count} pendente(s) · {money(shopTotal)}</a>)}</div>
  </aside>;
}
