-- SaaS platform layer: platform operators, named tenants, and one-time admin invitations.
ALTER TABLE barbershops ADD COLUMN slug TEXT;
ALTER TABLE barbershops ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1));
CREATE UNIQUE INDEX idx_barbershops_slug ON barbershops(slug) WHERE slug IS NOT NULL;

CREATE TABLE platform_admins (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE tenant_admin_invitations (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES user(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by TEXT REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE
);
CREATE INDEX idx_tenant_invitations_shop ON tenant_admin_invitations(barbershop_id, created_at DESC);
