/**
 * server.ts — Point d'entrée de l'API Abyss2
 * La logique applicative est dans app.ts (buildApp factory).
 * Ce fichier ne fait que démarrer le serveur et gérer le shutdown.
 */

import dotenv from 'dotenv'
import { buildApp } from './app.js'

dotenv.config()

const PORT = parseInt(process.env.API_PORT ?? '3000', 10)

let app: Awaited<ReturnType<typeof buildApp>> | undefined

const shutdown = async () => {
  try {
    if (app) {
      await app.prisma.$disconnect()
      await app.close()
    }
  } finally {
    process.exit(0)
  }
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)

const start = async () => {
  app = await buildApp()

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    app.log.info(`✓ API  → http://0.0.0.0:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
