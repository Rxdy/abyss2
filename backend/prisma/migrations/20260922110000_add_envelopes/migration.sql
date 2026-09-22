-- Enveloppes budgétaires : regroupent plusieurs catégories sous un même plafond mensuel,
-- alimenté par les revenus du mois (voir todo.md, calcul côté client dans utils/budget.js).
-- Le montant alloué est chiffré comme les autres montants (budget_encrypted de dbo.categories).

SET search_path TO dbo, public;

CREATE TABLE dbo.envelopes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  name_encrypted   TEXT NOT NULL,
  budget_encrypted TEXT NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_envelopes_updated_at
  BEFORE UPDATE ON dbo.envelopes
  FOR EACH ROW EXECUTE FUNCTION dbo.set_updated_at();

CREATE INDEX idx_envelopes_user_id ON dbo.envelopes(user_id);

-- Une catégorie peut appartenir à au plus une enveloppe ; la supprimer détache ses
-- catégories (envelope_id → NULL) sans jamais les supprimer, comme parent_id.
ALTER TABLE dbo.categories
  ADD COLUMN envelope_id UUID REFERENCES dbo.envelopes(id) ON DELETE SET NULL;

CREATE INDEX idx_categories_envelope_id ON dbo.categories(envelope_id);
