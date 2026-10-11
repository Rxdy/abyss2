/**
 * Tests — transport SMTP : chiffrement exigé avec un vrai relais
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const createTransport = vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('nodemailer', () => ({ default: { createTransport } }))

const ticket = {
  reference: 'AB-7F3K2Q', kind: 'bug' as const, subject: 'Sujet', message: 'Message assez long',
  userEmail: 'alice@example.com', context: {},
}

/** Le transport est mis en cache par module : un import neuf par cas. */
async function transportOptions(host: string) {
  vi.resetModules()
  createTransport.mockClear()
  process.env.SMTP_HOST = host
  const { sendSupportEmail } = await import('../src/utils/mail.js')
  await sendSupportEmail('support@example.com', ticket)
  return (createTransport.mock.calls[0] as unknown as [Record<string, unknown>])[0]
}

beforeEach(() => {
  process.env.SMTP_SECURE = 'false'
})

describe('transport SMTP', () => {
  it('exige STARTTLS avec un vrai relais (Gmail, port 587)', async () => {
    expect((await transportOptions('smtp.gmail.com')).requireTLS).toBe(true)
  })

  it.each(['mailpit', 'localhost', '127.0.0.1'])('ne l\'exige pas avec le relais de développement %s', async (host) => {
    expect((await transportOptions(host)).requireTLS).toBe(false)
  })
})
