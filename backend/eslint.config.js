// ESLint — règles de correction (pas de style : le formatage n'est pas imposé, voir .editorconfig).
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'coverage'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: { globals: globals.node },
    rules: {
      // Le typage de l'API est complet (voir src/types.ts) : on ne le rouvre pas.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  {
    // Les tests fabriquent des faux Prisma et des requêtes volontairement invalides.
    files: ['tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
