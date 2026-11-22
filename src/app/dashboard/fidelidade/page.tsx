import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoyalty } from "@/components/admin-loyalty";
import { getAuth } from "@/lib/auth";
import { getAdminScope } from "@/lib/admin-scope";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const scope = await getAdminScope();
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8"><header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Painel</a><a href="/" className="font-semibold">BARBER <span className="text-[var(--accent)]">BAR</span></a></header><section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ADMINISTRAÇÃO</p><h1 className="mt-2 text-3xl font-semibold">Fidelidade e retorno</h1><p className="mt-2 text-sm text-[var(--muted)]">Configure recompensas, acompanhe os saldos e lembre clientes pelo WhatsApp.</p><nav className="mt-5 flex flex-wrap gap-2">{[["Clientes", "/dashboard/clientes"], ["Fidelidade", "/dashboard/fidelidade"], ["Agenda", "/dashboard/agenda"]].map(([label, href]) => <a key={href} href={href} className={`rounded-full border px-3 py-2 text-sm ${href.endsWith("fidelidade") ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}>{label}</a>)}</nav>{!scope ? <p className="mt-6 rounded-xl border border-red-800 p-5">Sua conta ainda não está associada a uma unidade administrativa.</p> : <div className="mt-6"><AdminLoyalty /></div>}</section></main>;
}
