/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  PLATFORM_ADMIN_BOOTSTRAP_TOKEN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}
