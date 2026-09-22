/**
 * Tests composant — PwaInstallButton
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PwaInstallButton from '@/components/organisms/PwaInstallButton.vue'
import { listenForInstall, resetPwaInstall } from '@/composables/usePwaInstall.js'

function installEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

let wrapper

beforeEach(() => {
  resetPwaInstall()
  listenForInstall()
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('PwaInstallButton', () => {
  it('ne s\'affiche pas quand l\'installation n\'est pas possible', () => {
    wrapper = mount(PwaInstallButton)

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('apparaît quand le navigateur propose l\'installation', async () => {
    wrapper = mount(PwaInstallButton)
    window.dispatchEvent(installEvent())
    await flushPromises()

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe('Installer l\'application')
  })

  it('ouvre l\'invite native au clic puis se retire', async () => {
    const event = installEvent()
    wrapper = mount(PwaInstallButton)
    window.dispatchEvent(event)
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(event.prompt).toHaveBeenCalledOnce()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('disparaît quand l\'application vient d\'être installée', async () => {
    wrapper = mount(PwaInstallButton)
    window.dispatchEvent(installEvent())
    await flushPromises()

    window.dispatchEvent(new Event('appinstalled'))
    await flushPromises()

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('explique la marche à suivre sur iOS au lieu d\'ouvrir une invite', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    wrapper = mount(PwaInstallButton)

    await wrapper.find('button').trigger('click')

    expect(document.body.textContent).toContain('Sur l\'écran d\'accueil')
  })

  it('ferme les instructions iOS avec « J\'ai compris »', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    wrapper = mount(PwaInstallButton)
    await wrapper.find('button').trigger('click')

    const confirm = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('J\'ai compris'))
    confirm.click()
    await flushPromises()

    expect(document.body.textContent).not.toContain('Sur l\'écran d\'accueil')
  })
})
