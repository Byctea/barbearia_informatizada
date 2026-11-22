import { redirect } from "next/navigation";

export default function LegacyOperationsPage() {
  redirect("/dashboard/atendimentos");
}
