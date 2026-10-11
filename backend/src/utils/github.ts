/**
 * Issues GitHub créées par le support : un bug ou une amélioration signalé dans l'app arrive
 * directement dans le suivi du projet.
 *
 * Le dépôt est PUBLIC : l'issue ne contient jamais l'email ni l'identifiant du compte, et le texte
 * de l'utilisateur est mis dans un bloc de code — une @mention, une image (pixel de suivi) ou du
 * HTML qu'il aurait écrit n'est donc pas interprété par GitHub.
 *
 * Optionnel : sans SUPPORT_GITHUB_TOKEN (jeton à grain fin, droit « Issues : lecture et écriture »
 * sur le seul dépôt) ni SUPPORT_GITHUB_REPO, aucune issue n'est créée et le mail suffit.
 */

const API = 'https://api.github.com'

export interface CreatedIssue {
  number: number
  url:    string
}

export function githubIssuesConfigured() {
  return Boolean(process.env.SUPPORT_GITHUB_TOKEN && process.env.SUPPORT_GITHUB_REPO)
}

export async function createGithubIssue(issue: { title: string; body: string; labels: string[] }): Promise<CreatedIssue> {
  const response = await fetch(`${API}/repos/${process.env.SUPPORT_GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization:          `Bearer ${process.env.SUPPORT_GITHUB_TOKEN}`,
      Accept:                 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type':         'application/json',
      'User-Agent':           'abyss-support',
    },
    body:   JSON.stringify(issue),
    // GitHub lent ou injoignable : on n'y suspend pas l'envoi du ticket indéfiniment.
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    throw new Error(`GitHub a refusé l'issue (${response.status}) : ${(await response.text()).slice(0, 200)}`)
  }
  const created = await response.json() as { number: number; html_url: string }
  return { number: created.number, url: created.html_url }
}

/** Neutralise un texte libre pour un bloc de code Markdown : il ne peut pas en sortir. */
export function codeBlock(text: string) {
  return '```text\n' + text.replaceAll('```', 'ʼʼʼ') + '\n```'
}

/** Valeur courte dans une cellule de tableau, en code : ni mention, ni lien, ni rupture du tableau. */
export function codeCell(text: string) {
  return '`' + text.replaceAll('`', 'ʼ').replaceAll('|', '¦').replace(/\s+/g, ' ') + '`'
}
