/**
 * Inscription : la robustesse du mot de passe est exigée, et l'indicateur suit la saisie.
 */

import { test, expect } from '@playwright/test'
import { deleteAccount, newAccount, register, STRONG_PASSWORD } from './helpers.js'

const bar = (page) => page.getByRole('meter', { name: 'Robustesse du mot de passe' })

test('un mot de passe faible est refusé, un fort est accepté', async ({ page, request }) => {
  const account = newAccount('inscription')
  await page.goto('/register')
  await page.getByLabel('Adresse email').fill(account.email)

  // La barre est là dès le départ, vide
  await expect(bar(page)).toHaveAttribute('aria-valuetext', 'Aucun mot de passe saisi')

  // Faible : la barre le dit, et l'inscription est refusée avec l'explication
  await page.locator('#register-password').fill('Bonjour42')
  await page.locator('#register-confirm').fill('Bonjour42')
  await expect(bar(page)).toHaveAttribute('aria-valuetext', 'Très faible')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.locator('#register-password-error')).toContainText('le niveau « Fort » est requis')
  await expect(page).toHaveURL(/\/register/)

  // Fort : la barre monte, l'inscription passe
  await page.locator('#register-password').fill(STRONG_PASSWORD)
  await page.locator('#register-confirm').fill(STRONG_PASSWORD)
  await expect(bar(page)).toHaveAttribute('aria-valuetext', 'Très fort')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page).toHaveURL('/')

  await deleteAccount(request, account)
})

test('un email déjà inscrit est refusé', async ({ page, request }) => {
  const account = newAccount('doublon')
  await register(page, account)
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click()

  await page.goto('/register')
  await page.getByLabel('Adresse email').fill(account.email)
  await page.locator('#register-password').fill(account.password)
  await page.locator('#register-confirm').fill(account.password)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/register/)

  await deleteAccount(request, account)
})
