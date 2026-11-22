"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function GlobalActionLoader() {
  const [pending, setPending] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setRoutePending(false); }, [pathname]);

  useEffect(() => {
    const original = window.fetch;
    let count = 0;
    const wrapped = async (...args: Parameters<typeof window.fetch>) => {
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const track = url.startsWith("/") || url.startsWith(window.location.origin);
      if (track) { count++; setPending(count); }
      try { return await original(...args); }
      finally { if (track) { count = Math.max(0, count - 1); setPending(count); } }
    };
    Object.assign(wrapped, { preconnect: original.preconnect });
    window.fetch = wrapped as typeof window.fetch;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return;
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) setRoutePending(true);
    };
    document.addEventListener("click", onClick, true);
    return () => { window.fetch = original; document.removeEventListener("click", onClick, true); };
  }, []);

  useEffect(() => {
    if (!pending && !routePending) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, [pending, routePending]);

  if (!visible) return null;
  return <div className="action-loader" role="status" aria-live="polite"><div className="action-loader__character" /><span>O barbeiro está preparando tudo...</span></div>;
}
