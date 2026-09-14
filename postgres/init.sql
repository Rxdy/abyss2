-- ============================================================
-- Abyss2 — Database initialization
-- Schema: dbo (all tables live here)
-- Idempotent : peut être rejoué sur une base existante.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create dbo schema
CREATE SCHEMA IF NOT EXISTS dbo;

-- Set default search path
ALTER DATABASE abyss2_db SET search_path TO dbo, public;
SET search_path TO dbo, public;

-- Auto-update updated_at helper
CREATE OR REPLACE FUNCTION dbo.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Table: dbo.users
-- ============================================================
CREATE TABLE IF NOT EXISTS dbo.users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_hash      VARCHAR(64) UNIQUE NOT NULL,   -- HMAC-SHA256(email, MASTER_SECRET) — blind index
  email_encrypted TEXT        NOT NULL,          -- AES-256-GCM(email) — pour affichage
  password_hash   TEXT        NOT NULL,
  auth_salt       VARCHAR(32) NOT NULL,          -- 16 bytes hex (pour hash password)
  key_salt        VARCHAR(32) NOT NULL,          -- 16 bytes hex (pour dérivation clé)
  key_fragment    VARCHAR(64) NOT NULL,          -- 32 bytes hex (split-key fragment)
  token_version   INTEGER     NOT NULL DEFAULT 0, -- incrémenté → invalide tous les JWT déjà émis
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajout rétroactif (bases créées avant la déconnexion multi-appareils).
ALTER TABLE dbo.users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS trg_users_updated_at ON dbo.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON dbo.users
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_email_hash ON dbo.users(email_hash);

-- ============================================================
-- Table: dbo.categories
-- Le libellé est chiffré ; la couleur reste en clair (rendu).
-- ============================================================
CREATE TABLE IF NOT EXISTS dbo.categories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES dbo.categories(id) ON DELETE SET NULL,
  name_encrypted TEXT        NOT NULL,
  color          VARCHAR(7),
  position       INTEGER,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajout rétroactif si la table existait déjà sans la colonne (bases créées
-- avant l'introduction des sous-catégories).
ALTER TABLE dbo.categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES dbo.categories(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_categories_updated_at ON dbo.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON dbo.categories
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON dbo.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON dbo.categories(parent_id);

-- ============================================================
-- Table: dbo.transactions
-- Libellé et montant chiffrés (AES-256-GCM). Montant en centimes.
-- La date et le type restent en clair : ils servent au filtrage.
-- ============================================================
CREATE TABLE IF NOT EXISTS dbo.transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES dbo.categories(id) ON DELETE SET NULL,
  title_encrypted  TEXT        NOT NULL,
  amount_encrypted TEXT        NOT NULL,
  date             DATE        NOT NULL,
  type             VARCHAR(20) NOT NULL DEFAULT 'expense',
  note             TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON dbo.transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON dbo.transactions
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

-- ============================================================
-- Table: dbo.recurring_transactions
-- Dépense / revenu fixe mensuel — génère des transactions normales
-- (voir backend/src/utils/recurring.ts).
-- ============================================================
CREATE TABLE IF NOT EXISTS dbo.recurring_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  category_id           UUID REFERENCES dbo.categories(id) ON DELETE SET NULL,
  title_encrypted       TEXT        NOT NULL,
  amount_encrypted      TEXT        NOT NULL,
  type                  VARCHAR(20) NOT NULL DEFAULT 'expense',
  day_of_month          INTEGER     NOT NULL,
  note                  TEXT,
  active                BOOLEAN     NOT NULL DEFAULT true,
  start_date            DATE        NOT NULL,
  end_date              DATE,
  last_generated_month  VARCHAR(7),
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_recurring_transactions_updated_at ON dbo.recurring_transactions;
CREATE TRIGGER trg_recurring_transactions_updated_at
  BEFORE UPDATE ON dbo.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_id ON dbo.recurring_transactions(user_id);

-- Lien facultatif transaction ↔ modèle récurrent dont elle est issue.
ALTER TABLE dbo.transactions ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES dbo.recurring_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id      ON dbo.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date    ON dbo.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id  ON dbo.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_id ON dbo.transactions(recurring_id);
