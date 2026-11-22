import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function sendTransactionalEmail(to: string, subject: string, html: string) {
  const env = getCloudflareContext().env as CloudflareEnv;
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { sent: false as const, reason: "not_configured" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("transactional email provider error", response.status, detail.slice(0, 500));
    return { sent: false as const, reason: "provider_error" as const };
  }
  return { sent: true as const };
}

export const invitationEmail = (name: string, url: string, shop: string) =>
  `<p>Olá, ${escapeHtml(name)}.</p><p>Você foi convidado(a) para acessar ${escapeHtml(shop)} no Barber Flow.</p><p><a href="${escapeHtml(url)}">Criar cadastro e acessar</a></p><p>Se não solicitou este convite, ignore esta mensagem.</p>`;

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
