/**
 * Le parcours d'un nouvel utilisateur, de l'inscription aux statistiques.
 */

import { test, expect } from '@playwright/test'
import { deleteAccount, newAccount, register } from './helpers.js'

let account

test.beforeEach(() => { account = newAccount('parcours') })
test.afterEach(async ({ request }) => { await deleteAccount(request, account) })

test('inscription → ajout d\'une transaction → statistiques', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

  // ── Inscription ────────────────────────────────────────────────────────
  await register(page, account)
  await expect(page.getByText('Solde')).toBeVisible()
  await expect(page.getByText('Aucune transaction — commencez par en ajouter une.')).toBeVisible()

  // ── Ajout d'une dépense, en modale ─────────────────────────────────────
  await expect(page.getByRole('dialog')).toHaveCount(0) // au repos : aucun formulaire à l'écran
  await page.getByRole('button', { name: 'Ajouter une transaction' }).click()

  const dialog = page.getByRole('dialog', { name: 'Nouvelle transaction' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Libellé').fill('Courses E2E')
  await dialog.getByLabel('Montant (€)').fill('42,50')
  await dialog.getByLabel('Catégorie').selectOption({ label: 'Alimentation' })
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click()

  await expect(page.getByRole('status').getByText('Transaction ajoutée.')).toBeVisible()
  await expect(dialog).toHaveCount(0)

  // ── L'accueil reflète la dépense ───────────────────────────────────────
  await expect(page.locator('.balance__amount')).toContainText('-42,50')
  await expect(page.getByRole('button', { name: /Courses E2E/ })).toBeVisible()

  // ── Un budget sur la catégorie fait apparaître une jauge ───────────────
  await page.goto('/profile/categories')
  await page.getByRole('button', { name: 'Modifier Alimentation' }).click()
  const edit = page.getByRole('dialog', { name: 'Modifier la catégorie' })
  await edit.getByLabel(/Budget mensuel/).fill('100')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status').getByText('Catégorie modifiée.')).toBeVisible()

  await page.goto('/')
  const gauge = page.getByRole('meter', { name: 'Budget Alimentation' })
  await expect(gauge).toBeVisible()
  await expect(gauge).toHaveAttribute('aria-valuetext', /42,50.*sur 100,00.*il reste 57,50/)

  // ── Statistiques ───────────────────────────────────────────────────────
  await page.goto('/stats')
  await expect(page.getByText('Total dépenses')).toBeVisible()
  await expect(page.locator('.stats__total')).toContainText('42,50')
  await expect(page.locator('.breakdown')).toContainText('Alimentation')

  expect(errors, 'aucune erreur dans la console du navigateur').toEqual([])
})

test('déconnexion puis reconnexion', async ({ page }) => {
  await register(page, account)

  await page.getByRole('button', { name: 'Se déconnecter' }).first().click()
  await expect(page).toHaveURL(/\/login/)

  // Mauvais mot de passe : refusé, on reste sur la page
  await page.getByLabel('Adresse email').fill(account.email)
  await page.locator('input[type="password"]').fill('pas-le-bon-mot-de-passe')
  await page.getByRole('button', { name: /Se connecter/ }).click()
  await expect(page.getByRole('alert')).toContainText('Email ou mot de passe incorrect')
  await expect(page).toHaveURL(/\/login/)

  // Le bon : retour à l'accueil
  await page.locator('input[type="password"]').fill(account.password)
  await page.getByRole('button', { name: /Se connecter/ }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Solde')).toBeVisible()
})

test('les pages protégées renvoient vers la connexion', async ({ page }) => {
  for (const path of ['/', '/transactions', '/stats', '/profile']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login/)
  }
})
