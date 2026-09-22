/**
 * Envoi d'email — SMTP générique (nodemailer), pour la récupération de mot de passe.
 *
 * Pas de fournisseur tiers (API type Resend/SendGrid) : n'importe quel relais SMTP fait l'affaire
 * (Mailpit en développement — voir docker-compose.yml, un vrai relais en production). Le transport
 * est construit à la demande et mis en cache : la première tentative d'envoi échoue clairement si
 * `SMTP_HOST` manque, plutôt que de faire échouer le démarrage de l'API pour une fonctionnalité
 * annexe (voir `buildApp()` dans app.ts, qui ne dépend jamais de ce module).
 */

import nodemailer, { type Transporter } from 'nodemailer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/** `backend/assets/logo.png` — copie de l'icône PWA, montée en dev (docker-compose.yml) et
 * incluse dans l'image en production (COPY . . du Dockerfile). */
const LOGO_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'logo.png')

let transporter: Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  if (!host) throw new Error('SMTP_HOST env var is required to send email')

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  return transporter
}

const FROM = () => process.env.SMTP_FROM ?? 'Abyss2 <no-reply@abyss2.local>'

/**
 * Email HTML : styles inline (les clients mail ignorent les feuilles de style externes). Le logo
 * est joint en pièce jointe et référencé par `cid:` plutôt qu'en URL distante (pas d'hébergement
 * public) ou en data URI (bloquée par certains clients, ex. Outlook) — `cid:` est la méthode la
 * plus fiable pour une image intégrée dans un email.
 */
function resetEmailHtml(resetUrl: string) {
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:32px 16px;background:#f0f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(20,20,43,0.08);">
            <tr>
              <td style="padding:32px 32px 8px;text-align:center;">
                <img src="cid:abyss2-logo" width="56" height="56" alt="Abyss2" style="border-radius:14px;display:inline-block;" />
                <div style="margin-top:8px;font-size:18px;font-weight:700;color:#14142b;letter-spacing:0.02em;">ABYSS2</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#14142b;">Réinitialiser votre mot de passe</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b4b63;">
                  Vous avez demandé la réinitialisation du mot de passe de votre compte Abyss2.
                  Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;text-align:center;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#2a62c9;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:9999px;">
                  Choisir un nouveau mot de passe
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8aa3;">
                  Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste valide et rien ne se passera.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Lien de réinitialisation de mot de passe — un seul usage, expire (voir routes/auth.ts). */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await getTransporter().sendMail({
    from:    FROM(),
    to,
    subject: 'Réinitialisation de votre mot de passe Abyss2',
    text:
      'Vous avez demandé la réinitialisation de votre mot de passe Abyss2.\n\n'
      + `Cliquez sur ce lien pour en choisir un nouveau (valable 1 heure) :\n${resetUrl}\n\n`
      + 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email : rien ne se passera.',
    html: resetEmailHtml(resetUrl),
    attachments: [{ filename: 'logo.png', path: LOGO_PATH, cid: 'abyss2-logo' }],
  })
}
