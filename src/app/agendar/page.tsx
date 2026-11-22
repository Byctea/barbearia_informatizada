import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ClientAgenda } from "@/components/client-agenda";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ClientBookingPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar?callbackURL=%2Fagendar");
  if (session.user.role !== "CLIENT") redirect("/dashboard");
  return <ClientAgenda customerName={session.user.name} />;
}
