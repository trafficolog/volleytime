import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/.turbo/**',
      '**/coverage/**',
      'legacy/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // node-скрипты деплоя (Task 9.9.2)
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly',
        AbortSignal: 'readonly',
      },
    },
  },
  // .vue (Task 3.9.6): SFC парсятся vue-eslint-parser + typescript-eslint
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      // Nuxt auto-imports: неопределённые идентификаторы ловит vue-tsc (pnpm typecheck)
      'no-undef': 'off',
    },
  },
  {
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
    },
  },
  prettier,
)
