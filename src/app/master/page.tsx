import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { MasterDashboard } from "@/components/master-dashboard";

export const dynamic = "force-dynamic";

export default async function MasterPage() {
  const master = await getPlatformAdmin();
  if (!master) redirect("/dashboard");
  return <MasterDashboard name={master.name} />;
}
