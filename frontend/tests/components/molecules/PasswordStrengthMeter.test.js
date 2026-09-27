/**
 * Tests composant — PasswordStrengthMeter
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordStrengthMeter from '@/components/molecules/PasswordStrengthMeter.vue'
import { STRENGTH_LEVELS } from '@/utils/passwordStrength.js'

const mountMeter = (password = '') => mount(PasswordStrengthMeter, { props: { password } })
const meter = (w) => w.find('[role="meter"]')
const lit = (w) => w.findAll('.meter__segment--on').length

describe('PasswordStrengthMeter — barre', () => {
  it('a un segment par niveau, tous éteints avant la saisie', () => {
    const w = mountMeter()

    expect(w.findAll('.meter__segment')).toHaveLength(STRENGTH_LEVELS.length)
    expect(lit(w)).toBe(0)
    expect(meter(w).attributes('aria-valuenow')).toBe('0')
    expect(meter(w).attributes('aria-valuetext')).toBe('Aucun mot de passe saisi')
  })

  it.each([
    ['Bonjour42', 1],             // Très faible
    ['Zx9!Qw8@', 3],              // Moyen
    ['Zx9!Qw8@Er', 4],            // Fort
    ['Vélo-Bleu_Rapide-4821', 5], // Très fort
  ])('%s allume %i segment(s)', (password, segments) => {
    expect(lit(mountMeter(password))).toBe(segments)
  })

  it('les segments allumés prennent la couleur du niveau courant', () => {
    const w = mountMeter('Zx9!Qw8@')

    expect(w.findAll('.meter__segment--on').every((s) => s.classes().includes('meter__segment--2'))).toBe(true)
  })

  it('expose le niveau aux lecteurs d\'écran (échelle 0 à 100)', () => {
    const w = mountMeter('Vélo-Bleu_Rapide-4821')

    expect(meter(w).attributes('aria-valuemin')).toBe('0')
    expect(meter(w).attributes('aria-valuemax')).toBe('100')
    expect(meter(w).attributes('aria-valuenow')).toBe('100')
    expect(meter(w).attributes('aria-valuetext')).toBe('Très fort')
  })
})

describe('PasswordStrengthMeter — libellé au survol', () => {
  it('le libellé du niveau atteint est dans une infobulle réservée au survol', () => {
    const tip = mountMeter('Zx9!Qw8@').find('.meter__tip')

    expect(tip.text()).toBe('Moyen')
    expect(tip.attributes('aria-hidden')).toBe('true')
  })

  it('l\'infobulle est dans la barre : le survol de la barre suffit à la révéler', () => {
    expect(mountMeter('Zx9!Qw8@').find('.meter__bar .meter__tip').exists()).toBe(true)
  })

  it('aucune infobulle avant la saisie', () => {
    expect(mountMeter().find('.meter__tip').exists()).toBe(false)
  })

  it('le libellé suit le niveau', () => {
    expect(mountMeter('Bonjour42').find('.meter__tip').text()).toBe('Très faible')
    expect(mountMeter('Zx9!Qw8@Er').find('.meter__tip').text()).toBe('Fort')
    expect(mountMeter('Vélo-Bleu_Rapide-4821').find('.meter__tip').text()).toBe('Très fort')
  })

  it('aucun libellé affiché à côté de la barre', () => {
    const w = mountMeter('Zx9!Qw8@')

    expect(w.find('.meter__label').exists()).toBe(false)
    expect(w.find('.meter__row').exists()).toBe(false)
  })
})

describe('PasswordStrengthMeter — texte', () => {
  it('ne montre ni légende, ni niveau requis, ni pourcentage, ni bits', () => {
    for (const password of ['', 'Bonjour42', 'Zx9!Qw8@', 'Zx9!Qw8@Er', 'Vélo-Bleu_Rapide-4821']) {
      // Texte visible : la zone aria-live, réservée aux lecteurs d'écran, est exclue.
      const w = mountMeter(password)
      const text = [w.find('.meter__bar'), ...w.findAll('p')].map((el) => el.text()).join(' ')

      expect(text, password).not.toMatch(/%|bits|requis|minimum/i)
      expect(text, password).not.toContain('Entropie')
    }
  })

  it('affiche un conseil tant que le niveau n\'est pas atteint', () => {
    expect(mountMeter('Zx9!Qw8@').text()).toContain('Ajoutez encore environ 2 caractères')
  })

  it('plus de conseil une fois le niveau atteint', () => {
    expect(mountMeter('Zx9!Qw8@Er').text()).not.toContain('Ajoutez')
  })

  it('annonce le niveau dans une zone live discrète', () => {
    expect(mountMeter('Zx9!Qw8@Er').find('[aria-live="polite"]').text()).toBe('Robustesse : Fort, niveau requis atteint')
    expect(mountMeter('Zx9!Qw8@').find('[aria-live="polite"]').text()).toBe('Robustesse : Moyen')
  })
})
