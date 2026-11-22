import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ClientStore } from "@/components/client-store";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";
export const dynamic="force-dynamic";
export default async function StorePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const db=await getPlatformDb();const shop=await db.prepare("SELECT id FROM barbershops WHERE slug=? AND is_active=1").bind(slug).first();if(!shop)notFound();const auth=await getAuth();const session=await auth.api.getSession({headers:await headers()});if(!session)redirect(`/b/${slug}/entrar`);if(session.user.role!=="CLIENT")redirect("/dashboard");return <ClientStore customerName={session.user.name} shopSlug={slug}/>;}
