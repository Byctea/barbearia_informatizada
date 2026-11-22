import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "BarberFlow | Gestão de barbearias",
  description: "Agenda, clientes e gestão da sua barbearia em um só lugar.",
  applicationName: "BarberFlow",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BarberFlow" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#10100f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<ServiceWorkerRegister /></body></html>;
}
