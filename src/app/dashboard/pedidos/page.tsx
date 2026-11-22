import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StoreOrders } from "@/components/store-orders";
import { getAuth } from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function StoreOrdersPage(){const auth=await getAuth();const session=await auth.api.getSession({headers:await headers()});if(!session)redirect("/entrar");if(session.user.role!=="ADMIN")redirect("/dashboard");return <StoreOrders/>;}
