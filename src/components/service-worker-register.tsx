"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch((error: unknown) => {
      console.error("Não foi possível ativar o modo instalável.", error);
    });
  }, []);

  return null;
}
