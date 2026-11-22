-- Better Auth 1.7.27 reports account.issuer as an unexpected required column
-- for email/password inserts. Keep it nullable for compatibility and preserve
-- any rows already present in the local or remote account table.
CREATE TABLE account_rebuild (
  id TEXT PRIMARY KEY,
  issuer TEXT,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt DATE,
  refreshTokenExpiresAt DATE,
  scope TEXT,
  password TEXT,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL
);

INSERT INTO account_rebuild (
  id, issuer, accountId, providerId, userId, accessToken, refreshToken,
  idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password,
  createdAt, updatedAt
)
SELECT
  id, issuer, accountId, providerId, userId, accessToken, refreshToken,
  idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password,
  createdAt, updatedAt
FROM account;

DROP TABLE account;
ALTER TABLE account_rebuild RENAME TO account;

CREATE INDEX IF NOT EXISTS idx_auth_account_user ON account(userId);
CREATE INDEX IF NOT EXISTS idx_auth_account_provider ON account(providerId, accountId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_account_issuer_account ON account(issuer, accountId);
