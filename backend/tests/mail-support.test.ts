/**
 * Tests — sendSupportEmail : contenu du mail de support
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

const sendMail = vi.fn().mockResolvedValue(undefined)
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }))

const { sendSupportEmail } = await import('../src/utils/mail.js')

const lastMail = () => sendMail.mock.calls.at(-1)![0]

beforeAll(() => {
  process.env.SMTP_HOST = 'smtp.test'
})

const ticket = {
  reference: 'AB-7F3K2Q',
  kind:      'bug' as const,
  subject:   'Bouton <b>cassé</b>',
  message:   '<script>alert(1)</script>\nDeuxième ligne',
  userEmail: 'alice@example.com',
  context:   { Appareil: 'iPhone "15"' },
}

describe('sendSupportEmail', () => {
  it('adresse le mail au support, avec réponse directe à l\'utilisateur', async () => {
    await sendSupportEmail('support@example.com', ticket)

    const mail = lastMail()
    expect(mail.to).toBe('support@example.com')
    expect(mail.replyTo).toBe('alice@example.com')
    expect(mail.subject).toBe('[Abyss][Bug] Bouton <b>cassé</b> (AB-7F3K2Q)')
  })

  it('échappe tout le texte de l\'utilisateur dans la version HTML', async () => {
    await sendSupportEmail('support@example.com', ticket)

    const { html } = lastMail()
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Bouton &lt;b&gt;cassé&lt;/b&gt;')
    expect(html).toContain('iPhone &quot;15&quot;')
  })

  it('libelle une amélioration comme telle', async () => {
    await sendSupportEmail('support@example.com', { ...ticket, kind: 'idea' })

    expect(lastMail().subject).toMatch(/^\[Abyss\]\[Amélioration\]/)
  })
})
