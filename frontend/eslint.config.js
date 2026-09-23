// ESLint — règles de correction (pas de style : le formatage n'est pas imposé, voir .editorconfig).
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'

export default [
  { ignores: ['node_modules', 'dist', 'dev-dist', 'coverage', 'public'] },

  js.configs.recommended,
  // « essential » : les règles qui évitent des bugs (clés de v-for, variables inutilisées, mutation de props…),
  // pas celles qui règlent la mise en page.
  ...pluginVue.configs['flat/essential'],

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Les pages et composants portent déjà des noms composés ; on n'impose pas la règle au cas par cas.
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    // Configuration et scripts d'outillage : Node, pas navigateur.
    files: ['vite.config.js', 'eslint.config.js', 'scripts/**'],
    languageOptions: { globals: { ...globals.node }, sourceType: 'commonjs' },
  },
  { files: ['vite.config.js', 'eslint.config.js'], languageOptions: { sourceType: 'module' } },

  {
    files: ['tests/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]
