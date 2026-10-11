/**
 * Tests — client des issues GitHub du support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { codeBlock, codeCell, createGithubIssue, githubIssuesConfigured } from '../src/utils/github.js'

beforeEach(() => {
  process.env.SUPPORT_GITHUB_TOKEN = 'github_pat_test'
  process.env.SUPPORT_GITHUB_REPO  = 'Rxdy/abyss2'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createGithubIssue', () => {
  it('crée l\'issue sur le dépôt configuré, avec le jeton, et renvoie son numéro et son lien', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ number: 42, html_url: 'https://github.com/Rxdy/abyss2/issues/42' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const issue = await createGithubIssue({ title: '[Bug] Barre du bas', body: 'corps', labels: ['bug'] })

    expect(issue).toEqual({ number: 42, url: 'https://github.com/Rxdy/abyss2/issues/42' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/Rxdy/abyss2/issues')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer github_pat_test')
    expect(JSON.parse(options.body)).toEqual({ title: '[Bug] Barre du bas', body: 'corps', labels: ['bug'] })
  })

  it('échoue clairement quand GitHub refuse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Bad credentials' }))

    await expect(createGithubIssue({ title: 't', body: 'b', labels: [] })).rejects.toThrow(/401.*Bad credentials/)
  })
})

describe('githubIssuesConfigured', () => {
  it('demande le jeton et le dépôt', () => {
    expect(githubIssuesConfigured()).toBe(true)
    process.env.SUPPORT_GITHUB_TOKEN = ''
    expect(githubIssuesConfigured()).toBe(false)
  })
})

describe('neutralisation du texte de l\'utilisateur', () => {
  it('codeBlock : impossible de sortir du bloc de code', () => {
    const block = codeBlock('avant\n```\n@rudy <img src=x>\n```')

    expect(block.startsWith('```text\n')).toBe(true)
    expect(block.match(/```/g)).toHaveLength(2) // l'ouverture et la fermeture, rien d'autre
  })

  it('codeCell : une valeur sur une ligne, sans casser le tableau', () => {
    expect(codeCell('a | b`c\nd')).toBe('`a ¦ bʼc d`')
  })
})
