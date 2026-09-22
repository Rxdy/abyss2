import { expect } from '@playwright/test'

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3002'

/** Mot de passe qui atteint le niveau « Fort » exigé à l'inscription. */
export const STRONG_PASSWORD = 'Vélo-Bleu_Rapide-4821'

/** Un compte neuf, unique à chaque exécution. */
export function newAccount(label = 'e2e') {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return { email: `${label}-${unique}@example.com`, password: STRONG_PASSWORD }
}

/** Crée le compte par l'interface d'inscription et attend d'être sur l'accueil. */
export async function register(page, { email, password }) {
  await page.goto('/register')
  await page.getByLabel('Adresse email').fill(email)
  await page.locator('#register-password').fill(password)
  await page.locator('#register-confirm').fill(password)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page).toHaveURL('/')
}

/** Supprime le compte par l'API (nettoyage : ne dépend d'aucun écran testé). Silencieux s'il n'existe pas. */
export async function deleteAccount(request, { email, password }) {
  const login = await request.post(`${API_URL}/api/auth/login`, { data: { email, password } })
  if (!login.ok()) return
  const { token } = await login.json()
  await request.delete(`${API_URL}/api/user`, { headers: { Authorization: `Bearer ${token}` }, data: { password } })
}
