/**
 * Tests d'intégration — récupération de mot de passe
 * (POST /api/auth/forgot-password, POST /api/auth/reset-password)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

const sendPasswordResetEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/utils/mail.js', () => ({ sendPasswordResetEmail }))

import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { hashEmail, hashToken } = await import('../src/utils/crypto.js')

const STRONG_PASSWORD = 'Tirelire_Abyss-99'
const USER_ID = '11111111-1111-1111-1111-111111111111'

let app: any
let mockPrisma: any

beforeEach(async () => {
  sendPasswordResetEmail.mockClear().mockResolvedValue(undefined)
  mockPrisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: {
      create:     vi.fn().mockResolvedValue({ id: 'reset-1' }),
      findUnique: vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
})

afterEach(async () => {
  if (app) await app.close()
})

const forgotPassword = (email: string, ip = '10.0.0.1') =>
  app.inject({ method: 'POST', url: '/api/auth/forgot-password', remoteAddress: ip, payload: { email } })

const resetPassword = (payload: unknown, ip = '10.0.0.1') =>
  app.inject({ method: 'POST', url: '/api/auth/reset-password', remoteAddress: ip, payload })

describe('POST /api/auth/forgot-password', () => {
  it('200 — crée un jeton et envoie l\'email quand le compte existe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })

    const res = await forgotPassword('alice@example.com')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ sent: true })

    expect(mockPrisma.user.findUnique.mock.calls[0][0].where).toEqual({ emailHash: hashEmail('alice@example.com') })
    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledOnce()
    const { data } = mockPrisma.passwordResetToken.create.mock.calls[0][0]
    expect(data.userId).toBe(USER_ID)
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(data.expiresAt.getTime() - Date.now()).toBeCloseTo(60 * 60 * 1000, -3)

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce()
    const [to, url] = sendPasswordResetEmail.mock.calls[0]
    expect(to).toBe('alice@example.com')
    expect(url).toMatch(/^http:\/\/localhost:5174\/reset-password\?token=[0-9a-f]{64}$/)
  })

  it('accepte un email entouré d\'espaces (nettoyé avant validation)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })

    const res = await forgotPassword('  alice@example.com ')

    expect(res.statusCode).toBe(200)
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('alice@example.com', expect.any(String))
  })

  it('200 — même réponse quand le compte n\'existe pas (pas d\'énumération)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await forgotPassword('inconnu@example.com')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ sent: true })
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('le hash stocké correspond bien au jeton envoyé par email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })

    await forgotPassword('alice@example.com')

    const sentUrl = sendPasswordResetEmail.mock.calls[0][1]
    const token   = new URL(sentUrl).searchParams.get('token')!
    const { data } = mockPrisma.passwordResetToken.create.mock.calls[0][0]
    expect(data.tokenHash).toBe(hashToken(token))
  })

  it('200 — même si l\'envoi de l\'email échoue (l\'échec ne doit jamais fuiter au client)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })
    sendPasswordResetEmail.mockRejectedValueOnce(new Error('SMTP down'))

    const res = await forgotPassword('alice@example.com')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ sent: true })
  })

  it('normalise la casse de l\'email avant le lookup', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })

    await forgotPassword('Alice@Example.COM')

    expect(mockPrisma.user.findUnique.mock.calls[0][0].where).toEqual({ emailHash: hashEmail('alice@example.com') })
    expect(sendPasswordResetEmail.mock.calls[0][0]).toBe('alice@example.com')
  })

  it('400 — email invalide', async () => {
    const res = await forgotPassword('pas-un-email')
    expect(res.statusCode).toBe(400)
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password', () => {
  const validToken = () => ({
    id: 'reset-1',
    userId: USER_ID,
    usedAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  })

  it('200 — jeton valide : change le mot de passe, ouvre une session et un jeton CSRF', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validToken())
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, emailEncrypted: (await import('../src/utils/crypto.js')).encryptEmail('alice@example.com') })
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 1 })

    const res = await resetPassword({ token: 'un-jeton-quelconque', newPassword: STRONG_PASSWORD })

    expect(res.statusCode).toBe(200)
    expect(typeof res.json().csrfToken).toBe('string')
    const cookie = res.cookies.find((c: any) => c.name === 'token')
    expect(cookie?.value.split('.')).toHaveLength(3) // un JWT tout neuf

    expect(mockPrisma.user.update.mock.calls[0][0]).toMatchObject({
      where: { id: USER_ID },
      data:  { tokenVersion: { increment: 1 } },
    })
    expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'reset-1' },
      data:  { usedAt: expect.any(Date) },
    })
  })

  it('invalide les autres jetons encore valides du même utilisateur', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validToken())
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, emailEncrypted: (await import('../src/utils/crypto.js')).encryptEmail('alice@example.com') })
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 1 })

    await resetPassword({ token: 'un-jeton-quelconque', newPassword: STRONG_PASSWORD })

    expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, usedAt: null, id: { not: 'reset-1' } },
      data:  { usedAt: expect.any(Date) },
    })
  })

  it('400 INVALID_TOKEN — jeton inconnu', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null)

    const res = await resetPassword({ token: 'inconnu', newPassword: STRONG_PASSWORD })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INVALID_TOKEN')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('400 INVALID_TOKEN — jeton expiré', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      ...validToken(), expiresAt: new Date(Date.now() - 1000),
    })

    const res = await resetPassword({ token: 'expire', newPassword: STRONG_PASSWORD })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INVALID_TOKEN')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('400 INVALID_TOKEN — jeton déjà utilisé', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      ...validToken(), usedAt: new Date(),
    })

    const res = await resetPassword({ token: 'deja-utilise', newPassword: STRONG_PASSWORD })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INVALID_TOKEN')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('400 WEAK_PASSWORD — nouveau mot de passe sous le niveau requis', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validToken())

    const res = await resetPassword({ token: 'un-jeton-quelconque', newPassword: 'Bonjour42' })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('WEAK_PASSWORD')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('400 — champ manquant', async () => {
    const res = await resetPassword({ token: 'x' })
    expect(res.statusCode).toBe(400)
  })
})
