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
    html:
      '<p>Vous avez demandé la réinitialisation de votre mot de passe Abyss2.</p>'
      + `<p><a href="${resetUrl}">Choisir un nouveau mot de passe</a> (lien valable 1 heure)</p>`
      + '<p>Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email : rien ne se passera.</p>',
  })
}
