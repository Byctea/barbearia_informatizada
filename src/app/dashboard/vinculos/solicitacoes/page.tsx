import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminMembershipRequests } from "@/components/admin-membership-requests";
import { getAuth } from "@/lib/auth";
import { getAdminScope } from "@/lib/admin-scope";

export const dynamic = "force-dynamic";

export default async function AdminMembershipRequestsPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  if (!(await getAdminScope())) return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">Sua conta ainda não está associada a uma unidade administrativa.</main>;
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8"><header className="border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Painel</a></header><section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ADMINISTRAÇÃO</p><h1 className="mt-2 text-3xl font-semibold">Vínculos de clientes</h1><div className="mt-6"><AdminMembershipRequests /></div></section></main>;
}
