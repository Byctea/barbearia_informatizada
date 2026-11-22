import { z } from "zod";

const optionalString = (max: number) => z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(max).nullable().optional(),
);

const optionalEmail = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().email("Informe um e-mail válido.").max(254).nullable().optional(),
);

const optionalInteger = (min: number, max: number) => z.preprocess(
  (value) => value === "" || value === null ? null : Number(value),
  z.number().int().min(min).max(max).nullable().optional(),
);

const nonnegativeCents = z.preprocess((value) => Number(value), z.number().int().min(0).max(100_000_000));

export const resourceNames = ["customers", "services", "products", "barbers"] as const;
export type AdminResource = (typeof resourceNames)[number];

export const resourceSchemas = {
  customers: z.object({
    full_name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
    phone: z.string().trim().min(8, "Informe um telefone válido.").max(24),
    email: optionalEmail,
    birth_date: optionalString(10),
    notes: optionalString(1000),
    haircut_preference: optionalString(500),
    preferred_return_days: optionalInteger(1, 365),
    is_loyalty_member: z.preprocess((value) => value === true || value === "true" || value === 1, z.boolean()).default(false),
    consent_status: z.enum(["UNKNOWN", "GRANTED", "REVOKED"]).default("UNKNOWN"),
  }),
  services: z.object({
    name: z.string().trim().min(2, "Informe o nome do serviço.").max(100),
    description: optionalString(500),
    duration_minutes: z.preprocess((value) => Number(value), z.number().int().min(5).max(600)),
    price_cents: nonnegativeCents,
    estimated_cost_cents: nonnegativeCents,
  }),
  products: z.object({
    name: z.string().trim().min(2, "Informe o nome do produto.").max(120),
    category: z.string().trim().min(2, "Informe a categoria.").max(80),
    image_url: z.preprocess((value) => value === "" ? null : value, z.string().trim().max(350000).refine((value) => value.startsWith("https://") || value.startsWith("data:image/webp;base64,") || value.startsWith("data:image/png;base64,") || value.startsWith("data:image/jpeg;base64,"), "Escolha uma imagem válida.").nullable().optional()),
    cost_cents: nonnegativeCents,
    sale_price_cents: nonnegativeCents,
    stock_quantity: z.preprocess((value) => Number(value), z.number().int().min(0).max(1_000_000)),
    minimum_stock: z.preprocess((value) => Number(value), z.number().int().min(0).max(1_000_000)),
    is_for_sale: z.preprocess((value) => value === true || value === "true" || value === 1, z.boolean()).default(false),
  }),
  barbers: z.object({
    display_name: z.string().trim().min(2, "Informe o nome do profissional.").max(120),
    phone: optionalString(24),
    barber_type: z.enum(["EMPLOYEE", "PARTNER"]).default("EMPLOYEE"),
  }),
} satisfies Record<AdminResource, z.ZodType>;

export const resourceConfig: Record<AdminResource, {
  table: string;
  select: string;
  insertColumns: string[];
  updateColumns: string[];
  activeFilter: string;
  deletedAt?: boolean;
}> = {
  customers: {
    table: "customers",
    select: "id, full_name, phone, email, birth_date, notes, haircut_preference, preferred_return_days, is_loyalty_member, consent_status, created_at",
    insertColumns: ["id", "barbershop_id", "unit_id", "full_name", "phone", "email", "birth_date", "notes", "haircut_preference", "preferred_return_days", "is_loyalty_member", "consent_status", "consent_at", "created_at", "updated_at"],
    updateColumns: ["full_name", "phone", "email", "birth_date", "notes", "haircut_preference", "preferred_return_days", "is_loyalty_member", "consent_status", "consent_at", "updated_at"],
    activeFilter: "deleted_at IS NULL",
    deletedAt: true,
  },
  services: {
    table: "services",
    select: "id, name, description, duration_minutes, price_cents, estimated_cost_cents, is_active, created_at",
    insertColumns: ["id", "barbershop_id", "unit_id", "name", "description", "duration_minutes", "price_cents", "estimated_cost_cents", "is_active", "created_at"],
    updateColumns: ["name", "description", "duration_minutes", "price_cents", "estimated_cost_cents"],
    activeFilter: "is_active = 1",
  },
  products: {
    table: "products",
    select: "id, name, category, image_url, cost_cents, sale_price_cents, stock_quantity, minimum_stock, is_for_sale, is_active, created_at",
    insertColumns: ["id", "barbershop_id", "unit_id", "name", "category", "image_url", "cost_cents", "sale_price_cents", "stock_quantity", "minimum_stock", "is_for_sale", "is_active", "created_at", "updated_at"],
    updateColumns: ["name", "category", "image_url", "cost_cents", "sale_price_cents", "stock_quantity", "minimum_stock", "is_for_sale", "updated_at"],
    activeFilter: "is_active = 1",
  },
  barbers: {
    table: "barbers",
    select: "id, display_name, phone, barber_type, is_active, created_at",
    insertColumns: ["id", "barbershop_id", "unit_id", "display_name", "phone", "barber_type", "is_active", "created_at"],
    updateColumns: ["display_name", "phone", "barber_type"],
    activeFilter: "is_active = 1",
  },
};

export function isAdminResource(value: string): value is AdminResource {
  return (resourceNames as readonly string[]).includes(value);
}

export function makeResourceValues(resource: AdminResource, parsed: Record<string, unknown>, now: string) {
  if (resource === "customers") {
    return {
      ...parsed,
      consent_at: parsed.consent_status === "GRANTED" || parsed.consent_status === "REVOKED" ? now : null,
      updated_at: now,
    };
  }
  if (resource === "products") return { ...parsed, updated_at: now };
  return parsed;
}
