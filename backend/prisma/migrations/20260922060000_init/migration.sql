-- Abyss2 — schéma initial.
--
-- Baseline générée à partir de l'état de `postgres/init.sql` au moment de l'adoption de
-- `prisma migrate` (les retraits/ajouts rétroactifs qu'il accumulait — token_version,
-- parent_id, budget_encrypted, recurring_id, retrait des colonnes de sel — sont ici
-- directement dans les CREATE TABLE : cette migration part d'une base vide, elle n'a pas
-- à rester rejouable sur d'anciennes structures comme devait l'être init.sql.
--
-- Les CHECK, triggers et extensions ne sont pas exprimables dans schema.prisma : ils vivent
-- uniquement ici (voir tests/db/constraints.test.ts et tests/db/triggers.test.ts).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS dbo;

-- Scope de cette session de migration seulement — les requêtes de l'application qualifient
-- toujours leurs tables via Prisma (datasource schemas = ["dbo"]), aucun réglage persistant
-- n'est nécessaire au niveau de la base.
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
CREATE TABLE dbo.users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_hash      VARCHAR(64) UNIQUE NOT NULL,             -- HMAC-SHA256(email, MASTER_SECRET) — blind index
  email_encrypted TEXT        NOT NULL,                    -- AES-256-GCM(email) — pour affichage
  password_hash   TEXT        NOT NULL,
  token_version   INTEGER     NOT NULL DEFAULT 0,           -- incrémenté → invalide tous les JWT déjà émis
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON dbo.users
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX idx_users_email_hash ON dbo.users(email_hash);

-- ============================================================
-- Table: dbo.categories
-- Le libellé et le budget sont chiffrés ; la couleur reste en clair (rendu).
-- ============================================================
CREATE TABLE dbo.categories (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  parent_id        UUID REFERENCES dbo.categories(id) ON DELETE SET NULL,
  name_encrypted   TEXT        NOT NULL,
  color            VARCHAR(7),
  position         INTEGER,
  budget_encrypted TEXT,                                    -- plafond mensuel en centimes, chiffré — NULL : pas de budget
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON dbo.categories
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX idx_categories_user_id ON dbo.categories(user_id);
CREATE INDEX idx_categories_parent_id ON dbo.categories(parent_id);

-- ============================================================
-- Table: dbo.recurring_transactions
-- Dépense / revenu fixe mensuel — génère des transactions normales
-- (voir backend/src/utils/recurring.ts). Créée avant dbo.transactions,
-- que son id référence (recurring_id).
-- ============================================================
CREATE TABLE dbo.recurring_transactions (
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
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_recurring_transactions_updated_at
  BEFORE UPDATE ON dbo.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX idx_recurring_transactions_user_id ON dbo.recurring_transactions(user_id);

-- ============================================================
-- Table: dbo.transactions
-- Libellé et montant chiffrés (AES-256-GCM). Montant en centimes.
-- La date et le type restent en clair : ils servent au filtrage.
-- ============================================================
CREATE TABLE dbo.transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES dbo.categories(id) ON DELETE SET NULL,
  recurring_id     UUID REFERENCES dbo.recurring_transactions(id) ON DELETE SET NULL,
  title_encrypted  TEXT        NOT NULL,
  amount_encrypted TEXT        NOT NULL,
  date             DATE        NOT NULL,
  type             VARCHAR(20) NOT NULL DEFAULT 'expense',
  note             TEXT,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON dbo.transactions
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX idx_transactions_user_id      ON dbo.transactions(user_id);
CREATE INDEX idx_transactions_user_date    ON dbo.transactions(user_id, date);
CREATE INDEX idx_transactions_category_id  ON dbo.transactions(category_id);
CREATE INDEX idx_transactions_recurring_id ON dbo.transactions(recurring_id);

-- Une échéance de charge fixe n'existe qu'une fois : (charge, date) est unique. Garde-fou contre la
-- double génération quand deux requêtes lancent le rattrapage en même temps (voir utils/recurring.ts).
-- Les transactions saisies à la main (recurring_id NULL) ne sont pas concernées : les NULL sont
-- toujours distincts.
CREATE UNIQUE INDEX uq_transactions_recurring_date ON dbo.transactions(recurring_id, date);

-- ============================================================
-- Intégrité : contraintes CHECK
-- Reprennent les validations de l'API — une donnée invalide ne doit pas pouvoir
-- entrer par un autre chemin (script, psql, futur service).
-- ============================================================
ALTER TABLE dbo.users
  ADD CONSTRAINT chk_users_token_version CHECK (token_version >= 0);

ALTER TABLE dbo.categories
  ADD CONSTRAINT chk_categories_color CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT chk_categories_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id);

ALTER TABLE dbo.transactions
  ADD CONSTRAINT chk_transactions_type CHECK (type IN ('expense', 'income'));

ALTER TABLE dbo.recurring_transactions
  ADD CONSTRAINT chk_recurring_type CHECK (type IN ('expense', 'income')),
  ADD CONSTRAINT chk_recurring_day_of_month CHECK (day_of_month BETWEEN 1 AND 31),
  ADD CONSTRAINT chk_recurring_dates CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT chk_recurring_last_month CHECK (last_generated_month IS NULL OR last_generated_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
