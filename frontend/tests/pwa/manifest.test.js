/**
 * Garde-fou du manifest PWA : les captures d'écran déclarées dans vite.config.js
 * existent, sont de vrais PNG, et leur taille réelle est celle annoncée — sinon
 * Chrome ignore l'image et l'installation enrichie disparaît en silence.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root   = process.cwd()
const config = readFileSync(join(root, 'vite.config.js'), 'utf8')

const screenshots = [...config.matchAll(/\{\s*src:\s*'(screenshots\/[^']+)',\s*sizes:\s*'(\d+)x(\d+)',\s*type:\s*'([^']+)',\s*form_factor:\s*'(\w+)',\s*label:\s*'([^']+)'/g)]
  .map(([, src, width, height, type, formFactor, label]) => ({ src, width: Number(width), height: Number(height), type, formFactor, label }))

/** Largeur et hauteur lues dans l'en-tête IHDR d'un PNG. */
function pngSize(file) {
  const bytes = readFileSync(file)
  const signature = bytes.subarray(0, 8).toString('hex')
  return { signature, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('manifest — captures d\'écran', () => {
  it('en déclare, dans les deux formats', () => {
    expect(screenshots.length).toBeGreaterThanOrEqual(2)
    expect(screenshots.length).toBeLessThanOrEqual(8) // limite de Chrome
    expect(new Set(screenshots.map((s) => s.formFactor))).toEqual(new Set(['narrow', 'wide']))
  })

  it('chaque capture a un libellé (lu par les lecteurs d\'écran)', () => {
    expect(screenshots.every((s) => s.label.length > 5)).toBe(true)
  })

  for (const shot of screenshots) {
    describe(shot.src, () => {
      const file = join(root, 'public', shot.src)

      it('existe dans public/', () => {
        expect(existsSync(file)).toBe(true)
      })

      it('est un PNG de la taille annoncée', () => {
        const { signature, width, height } = pngSize(file)

        expect(signature).toBe('89504e470d0a1a0a')
        expect([width, height]).toEqual([shot.width, shot.height])
      })

      it('respecte les proportions acceptées (ni plus large que 2,3 : 1 dans un sens ni dans l\'autre)', () => {
        const ratio = Math.max(shot.width, shot.height) / Math.min(shot.width, shot.height)

        expect(ratio).toBeLessThanOrEqual(2.3)
      })

      it('a le bon sens : « narrow » en portrait, « wide » en paysage', () => {
        expect(shot.formFactor === 'narrow' ? shot.height > shot.width : shot.width > shot.height).toBe(true)
      })
    })
  }

  it('ne sont pas précachées par le service worker', () => {
    expect(config).toMatch(/globIgnores:\s*\[[^\]]*'screenshots\/\*\*'/)
  })
})

describe('iOS — écrans de démarrage', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8')

  const splashes = [...html.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)" media="([^"]+)"/g)].map(([, href, media]) => {
    const [width, height, ratio] = ['device-width', 'device-height', '-webkit-device-pixel-ratio']
      .map((feature) => Number(media.match(new RegExp(`\\(${feature}: (\\d+)`))?.[1]))
    return { href, media, width, height, ratio }
  })

  it('en déclare pour les iPhone et les iPad, en portrait', () => {
    expect(splashes.length).toBeGreaterThanOrEqual(10)
    expect(splashes.every((s) => s.media.includes('orientation: portrait'))).toBe(true)
    expect(splashes.some((s) => s.width < 500)).toBe(true)   // iPhone
    expect(splashes.some((s) => s.width > 700)).toBe(true)   // iPad
  })

  it('aucune balise en double pour un même appareil', () => {
    const keys = splashes.map((s) => `${s.width}x${s.height}@${s.ratio}`)

    expect(new Set(keys).size).toBe(keys.length)
  })

  for (const splash of splashes) {
    it(`${splash.href} : PNG de ${splash.width * splash.ratio}×${splash.height * splash.ratio} px, comme l'appareil le demande`, () => {
      const file = join(root, 'public', splash.href)

      expect(existsSync(file)).toBe(true)
      const { signature, width, height } = pngSize(file)
      expect(signature).toBe('89504e470d0a1a0a')
      // Une image de mauvaise taille est ignorée par iOS : écran blanc au lancement.
      expect([width, height]).toEqual([splash.width * splash.ratio, splash.height * splash.ratio])
    })
  }

  it('ne sont pas précachées par le service worker', () => {
    expect(config).toMatch(/globIgnores:\s*\[[^\]]*'splash\/\*\*'/)
  })
})
