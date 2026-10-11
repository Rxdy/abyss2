/**
 * Tests composant — SupportForm (Profil → Support)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SupportForm from '@/components/organisms/SupportForm.vue'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../../stores/_helpers.js'

beforeEach(() => {
  vi.unstubAllGlobals()
})

async function fill(w, subject, message) {
  await w.find('#support-subject').setValue(subject)
  await w.find('#support-message').setValue(message)
  await w.find('form').trigger('submit')
  await flushPromises()
}

describe('SupportForm', () => {
  it('envoie un bug avec l\'appareil et l\'écran, puis affiche la référence', async () => {
    const fetchMock = mockApi(() => ({ status: 201, body: { reference: 'AB-7F3K2Q' } }))
    const w = mount(SupportForm)

    await fill(w, '  La navbar flotte ', 'Une bande vide reste sous la barre du bas.')

    const [call] = calls(fetchMock)
    expect(call.method).toBe('POST')
    expect(call.path).toBe('/api/support')
    expect(call.body).toMatchObject({ kind: 'bug', subject: 'La navbar flotte', message: 'Une bande vide reste sous la barre du bas.' })
    expect(Object.keys(call.body.context)).toEqual(['Appareil', 'Écran', 'App installée', 'Thème'])
    expect(w.text()).toContain('AB-7F3K2Q')
    expect(useToastStore().items[0].message).toContain('envoyé')
  })

  it('envoie une amélioration sans informations sur l\'appareil', async () => {
    const fetchMock = mockApi(() => ({ status: 201, body: { reference: 'AB-2222QQ' } }))
    const w = mount(SupportForm, { props: { kind: 'idea' } })

    await fill(w, 'Export PDF', 'Pouvoir exporter les statistiques en PDF.')

    const [call] = calls(fetchMock)
    expect(call.body.kind).toBe('idea')
    expect(call.body).not.toHaveProperty('context')
  })

  it('change de type au clic, avec des libellés adaptés', async () => {
    const w = mount(SupportForm)
    expect(w.text()).toContain('Ce qui ne marche pas')

    await w.findAll('[aria-pressed]')[1].trigger('click')

    expect(w.text()).toContain('Votre idée en une phrase')
  })

  it('valide avant d\'appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ status: 201, body: {} }))
    const w = mount(SupportForm)

    await fill(w, 'ab', 'court')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('3 caractères minimum')
    expect(w.text()).toContain('10 caractères minimum')
  })

  it('affiche l\'erreur de l\'API et garde le texte saisi', async () => {
    mockApi(() => ({ ok: false, status: 502, body: { error: 'Le message n\'a pas pu être envoyé. Réessayez dans quelques minutes.' } }))
    const w = mount(SupportForm)

    await fill(w, 'La navbar flotte', 'Une bande vide reste sous la barre du bas.')

    expect(w.text()).toContain('n\'a pas pu être envoyé')
    expect(w.find('#support-subject').element.value).toBe('La navbar flotte')
  })

  it('permet d\'envoyer un autre message après un envoi', async () => {
    mockApi(() => ({ status: 201, body: { reference: 'AB-7F3K2Q' } }))
    const w = mount(SupportForm)
    await fill(w, 'La navbar flotte', 'Une bande vide reste sous la barre du bas.')

    await w.findAll('button').find((b) => b.text().includes('autre message')).trigger('click')

    expect(w.find('#support-subject').element.value).toBe('')
  })
})
