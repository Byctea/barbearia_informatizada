import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ClientAgenda } from "@/components/client-agenda";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function TenantBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getPlatformDb();
  const shop = await db.prepare("SELECT name FROM barbershops WHERE slug=? AND is_active=1")
    .bind(slug).first<{ name: string }>();
  if (!shop) notFound();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/b/${slug}/entrar`);
  if (session.user.role !== "CLIENT") redirect("/dashboard");
  return <ClientAgenda customerName={session.user.name} shopSlug={slug} />;
}
