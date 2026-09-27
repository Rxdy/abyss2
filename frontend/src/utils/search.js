/** Minuscules, sans accents : « Café » et « cafe » se valent. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Une transaction correspond si chaque mot de la recherche apparaît dans son
 * libellé, sa note ou sa catégorie. Les libellés sont chiffrés en base : la
 * recherche ne peut se faire que sur ce que le client a déjà reçu.
 */
export function matchesSearch(transaction, query) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const haystack = normalizeText(
    [transaction.title, transaction.note, transaction.category?.name].filter(Boolean).join(' '),
  )
  return words.every((word) => haystack.includes(word))
}
