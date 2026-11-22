import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { GlobalActionLoader } from "@/components/global-action-loader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barber Flow | Gestão de barbearias",
  description: "Agenda, clientes e gestão da sua barbearia em um só lugar.",
  applicationName: "Barber Flow",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Barber Flow" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#10100f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<GlobalActionLoader /><ServiceWorkerRegister /></body></html>;
}
