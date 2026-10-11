/**
 * Garde-fou « pas de transaction avant le mois de création du compte » (voir
 * earliestTransactionDate), partagé par les transactions et les charges fixes.
 */

import type { PrismaClient } from '@prisma/client'
import { earliestTransactionDate } from './date.js'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Date la plus ancienne autorisée pour ce compte, ou null s'il est introuvable. */
export async function earliestDateFor(prisma: PrismaClient, userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
  return user?.createdAt ? earliestTransactionDate(user.createdAt) : null
}

/** Corps de la réponse 400 quand une date tombe avant le mois de création du compte. */
export function dateBeforeAccountError(earliest: string) {
  const [year, month] = earliest.split('-').map(Number)
  return {
    error: `Date trop ancienne : votre compte démarre le 1er ${MONTHS[month - 1]} ${year}.`,
    code:  'DATE_BEFORE_ACCOUNT',
  }
}
