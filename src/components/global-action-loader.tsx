"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function GlobalActionLoader() {
  const [pending, setPending] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setRoutePending(false);
  }, [pathname]);

  useEffect(() => {
    const original = window.fetch;
    let count = 0;
    let routeTimer: number | undefined;
    const wrapped = async (...args: Parameters<typeof window.fetch>) => {
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let track = false;
      try {
        const parsed = new URL(url, window.location.origin);
        track = parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
      } catch { /* Ignore non-URL inputs */ }
      if (track) { count++; setPending(count); }
      let active = true;
      const watchdog = track ? window.setTimeout(() => {
        if (active) { active = false; count = Math.max(0, count - 1); setPending(count); }
      }, 12000) : undefined;
      try { return await original(...args); }
      finally {
        if (track && active) {
          active = false;
          if (watchdog !== undefined) window.clearTimeout(watchdog);
          count = Math.max(0, count - 1);
          setPending(count);
        }
      }
    };
    Object.assign(wrapped, { preconnect: original.preconnect });
    window.fetch = wrapped as typeof window.fetch;
    const clearRoute = () => {
      setRoutePending(false);
      if (routeTimer !== undefined) window.clearTimeout(routeTimer);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return;
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) {
        if (routeTimer !== undefined) window.clearTimeout(routeTimer);
        setRoutePending(true);
        routeTimer = window.setTimeout(clearRoute, 7000);
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", clearRoute);
    window.addEventListener("pagehide", clearRoute);
    return () => {
      window.fetch = original;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", clearRoute);
      window.removeEventListener("pagehide", clearRoute);
      if (routeTimer !== undefined) window.clearTimeout(routeTimer);
    };
  }, []);

  useEffect(() => {
    if (!pending && !routePending) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, [pending, routePending]);

  if (!visible) return null;
  return <div className="action-loader" role="status" aria-live="polite"><div className="action-loader__character" /><span>O barbeiro está preparando tudo...</span></div>;
}
