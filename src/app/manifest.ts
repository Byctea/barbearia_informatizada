import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barber Bar",
    short_name: "Barber Bar",
    description: "Gestão e agendamento da barbearia",
    start_url: "/",
    display: "standalone",
    background_color: "#10100f",
    theme_color: "#10100f",
    lang: "pt-BR",
  };
}
