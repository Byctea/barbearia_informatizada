import { betterAuth } from "better-auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getAuth() {
  const { env } = getCloudflareContext();
  const bindings = env as CloudflareEnv;

  return betterAuth({
    database: bindings.DB,
    baseURL: bindings.BETTER_AUTH_URL,
    secret: bindings.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: {
          type: ["ADMIN", "CLIENT"],
          required: false,
          defaultValue: "CLIENT",
          input: false,
        },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      database: { generateId: "uuid" },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await bindings.DB.prepare(
              `INSERT OR IGNORE INTO users (id, auth_subject, email, display_name)
               VALUES (?, ?, ?, ?)`,
            ).bind(user.id, user.id, user.email, user.name).run();
          },
        },
      },
    },
  });
}
