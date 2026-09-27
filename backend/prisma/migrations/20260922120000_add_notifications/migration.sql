-- Notifications : enveloppe dépassée, solde négatif, dépenses non catégorisées (voir todo.md). Pas de colonne
-- « created_at » à protéger par trigger updated_at : une notification n'est jamais modifiée en
-- place au sens du contenu, seuls read/archived changent, et son horodatage de création suffit.

SET search_path TO dbo, public;

CREATE TABLE dbo.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL,
  envelope_id UUID REFERENCES dbo.envelopes(id) ON DELETE SET NULL,
  count       INTEGER,
  read        BOOLEAN NOT NULL DEFAULT false,
  archived    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id      ON dbo.notifications(user_id);
CREATE INDEX idx_notifications_user_id_read ON dbo.notifications(user_id, read);

ALTER TABLE dbo.notifications
  ADD CONSTRAINT chk_notifications_type CHECK (type IN ('envelope_overspend', 'uncategorized_digest', 'negative_balance'));

-- Date du dernier digest « dépenses non catégorisées », portée par l'utilisateur plutôt que déduite
-- de la dernière notification : supprimer le digest ne doit pas en faire recréer un aussitôt (voir
-- utils/notifications.ts).
ALTER TABLE dbo.users ADD COLUMN last_uncategorized_digest_at TIMESTAMP WITH TIME ZONE;

-- Réglages (page Profil) : chaque type peut être coupé. Un type coupé n'est plus généré du tout ;
-- les notifications déjà reçues restent consultables.
ALTER TABLE dbo.users
  ADD COLUMN notify_envelope_overspend   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN notify_negative_balance     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN notify_uncategorized_digest BOOLEAN NOT NULL DEFAULT true;
