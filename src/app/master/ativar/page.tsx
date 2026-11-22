import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MasterActivationForm } from "@/components/master-activation-form";
import { getAuth } from "@/lib/auth";
import { getPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function MasterActivationPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar?callbackURL=%2Fmaster%2Fativar");
  if (await getPlatformAdmin()) redirect("/master");
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-9">
    <Link href="/" className="text-sm text-[var(--accent)] hover:underline">BarberFlow</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Configuração inicial</p>
    <h1 className="mt-2 text-3xl font-semibold">Ativar conta master</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Esta etapa só pode ser concluída uma vez e exige o token configurado no servidor.</p>
    <MasterActivationForm />
  </section></main>;
}
