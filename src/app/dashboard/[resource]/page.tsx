import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRecords } from "@/components/admin-records";
import { getAuth } from "@/lib/auth";
import { getAdminScope } from "@/lib/admin-scope";
import type { AdminResource } from "@/lib/admin-records";

export const dynamic = "force-dynamic";
const pages: Record<string, { resource: AdminResource; title: string }> = {
  clientes: { resource: "customers", title: "Clientes" },
  servicos: { resource: "services", title: "Serviços" },
  produtos: { resource: "products", title: "Produtos" },
};

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: slug } = await params;
  const page = pages[slug];
  if (!page) redirect("/dashboard");
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const scope = await getAdminScope();
  return <AdminRecords resource={page.resource} title={page.title} hasMembership={Boolean(scope)} />;
}
