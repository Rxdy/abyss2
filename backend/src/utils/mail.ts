/**
 * Envoi d'email — SMTP générique (nodemailer) : récupération de mot de passe et tickets de support.
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

/** Relais de développement (Mailpit) : pas de TLS à exiger, rien ne quitte la machine. */
const LOCAL_SMTP_HOSTS = new Set(['mailpit', 'localhost', '127.0.0.1'])

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  if (!host) throw new Error('SMTP_HOST env var is required to send email')

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    // Sur le port 587 (SMTP_SECURE=false), STARTTLS n'est sinon qu'opportuniste : un intermédiaire
    // qui le retire ferait partir le mail en clair, lien de réinitialisation compris. On l'exige
    // donc avec tout vrai relais ; l'envoi échoue plutôt que de partir sans chiffrement.
    requireTLS: !LOCAL_SMTP_HOSTS.has(host),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  return transporter
}

const FROM = () => process.env.SMTP_FROM ?? 'Abyss <no-reply@abyss.local>'

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
                <img src="cid:abyss2-logo" width="56" height="56" alt="Abyss" style="border-radius:14px;display:inline-block;" />
                <div style="margin-top:8px;font-size:18px;font-weight:700;color:#14142b;letter-spacing:0.02em;">ABYSS</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#14142b;">Réinitialiser votre mot de passe</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b4b63;">
                  Vous avez demandé la réinitialisation du mot de passe de votre compte Abyss.
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
    subject: 'Réinitialisation de votre mot de passe Abyss',
    text:
      'Vous avez demandé la réinitialisation de votre mot de passe Abyss.\n\n'
      + `Cliquez sur ce lien pour en choisir un nouveau (valable 1 heure) :\n${resetUrl}\n\n`
      + 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email : rien ne se passera.',
    html: resetEmailHtml(resetUrl),
    attachments: [{ filename: 'logo.png', path: LOGO_PATH, cid: 'abyss2-logo' }],
  })
}

// ── Support ─────────────────────────────────────────────────────────────────

export type SupportKind = 'bug' | 'idea'

export interface SupportTicket {
  /** Référence courte affichée à l'utilisateur et reprise dans le sujet du mail. */
  reference: string
  kind:      SupportKind
  subject:   string
  message:   string
  /** Adresse du compte : le mail y répond directement (Reply-To). */
  userEmail: string
  /** Appareil, taille d'écran, app installée… : de quoi reproduire un bug. */
  context:   Record<string, string>
}

const SUPPORT_KIND_LABEL: Record<SupportKind, string> = { bug: 'Bug', idea: 'Amélioration' }

/** Le texte vient de l'utilisateur : jamais injecté tel quel dans le HTML du mail. */
const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;')

function supportEmailHtml(ticket: SupportTicket) {
  const label = SUPPORT_KIND_LABEL[ticket.kind]
  const contextRows = Object.entries(ticket.context)
    .map(([key, value]) => `<tr><td style="padding:2px 12px 2px 0;color:#8a8aa3;">${escapeHtml(key)}</td><td style="padding:2px 0;color:#4b4b63;">${escapeHtml(value)}</td></tr>`)
    .join('')
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px 16px;background:#f0f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;">
        <tr><td style="padding:24px 28px 0;">
          <div style="font-size:13px;font-weight:600;color:${ticket.kind === 'bug' ? '#c0392b' : '#2a62c9'};text-transform:uppercase;letter-spacing:0.06em;">${label} · ${escapeHtml(ticket.reference)}</div>
          <h1 style="margin:8px 0 4px;font-size:20px;color:#14142b;">${escapeHtml(ticket.subject)}</h1>
          <div style="font-size:13px;color:#8a8aa3;">De ${escapeHtml(ticket.userEmail)} — répondre à ce mail lui répond directement.</div>
        </td></tr>
        <tr><td style="padding:16px 28px;">
          <div style="font-size:15px;line-height:1.6;color:#14142b;white-space:pre-wrap;">${escapeHtml(ticket.message)}</div>
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:12px;border-top:1px solid #e4e6f0;padding-top:12px;width:100%;">${contextRows}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`
}

/** Ticket de support (bug ou amélioration) envoyé à l'adresse SUPPORT_EMAIL. */
export async function sendSupportEmail(to: string, ticket: SupportTicket) {
  const label = SUPPORT_KIND_LABEL[ticket.kind]
  const context = Object.entries(ticket.context).map(([key, value]) => `${key} : ${value}`).join('\n')
  await getTransporter().sendMail({
    from:    FROM(),
    to,
    replyTo: ticket.userEmail,
    subject: `[Abyss][${label}] ${ticket.subject} (${ticket.reference})`,
    text:    `${label} ${ticket.reference} — de ${ticket.userEmail}\n\n${ticket.subject}\n\n${ticket.message}\n\n---\n${context}`,
    html:    supportEmailHtml(ticket),
  })
}
