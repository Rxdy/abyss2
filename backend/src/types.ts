/**
 * Types partagés de l'API.
 */

import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Ce que porte un jeton JWT. `email` et `tv` (version de jeton, voir `authenticate`) sont
 * facultatifs au sens du type : un jeton ancien ou forgé peut ne pas les avoir, et c'est
 * précisément ce que `authenticate` vérifie.
 */
export interface AuthPayload {
  userId: string
  email?: string
  tv?: number
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthPayload
    user: AuthPayload
  }
}

/** Le client Prisma, ou celui d'une transaction interactive (`prisma.$transaction(async (tx) => …)`). */
export type Db = PrismaClient | Prisma.TransactionClient

/** Corps d'erreur de l'API. */
export interface ApiError {
  error: string
  code: string
}

/** Sens d'une transaction ou d'une charge fixe. */
export type TransactionType = 'expense' | 'income'

