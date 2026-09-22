-- Récupération de mot de passe : une ligne par lien envoyé par email.
--
-- Le jeton (haute entropie, 32 octets aléatoires, voir utils/mail.ts et routes/auth.ts) ne
-- quitte jamais le serveur : seul son hash SHA-256 est stocké ici, comme un mot de passe.
-- `used_at` marque un lien déjà consommé sans le supprimer (traçabilité) ; l'API refuse de
-- réutiliser un jeton expiré ou déjà utilisé (voir tests/auth.test.ts).

-- Chaque migration s'exécute dans sa propre session : `uuid_generate_v4()` (extension `uuid-ossp`,
-- schéma `public`) n'est résolu sans le qualifier que si le search_path le couvre, comme dans la
-- migration initiale (voir 20260922060000_init).
SET search_path TO dbo, public;

CREATE TABLE dbo.password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at     TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_password_reset_tokens_token_hash ON dbo.password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_user_id ON dbo.password_reset_tokens(user_id);
