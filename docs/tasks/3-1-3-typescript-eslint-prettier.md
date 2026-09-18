---
id: '3.1.3'
phase: '3'
epic: '3.1'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
  - BACK
depends_on:
  - '3.1.1'
estimated_hours: '2'
tags:
  - typescript
  - eslint
  - prettier
  - code-quality
---

# Task 3.1.3: TypeScript strict + ESLint flat config + Prettier

## Цель

Настроить TypeScript strict mode, ESLint 9 (flat config), Prettier — для всех пакетов через общий базовый конфиг.

## Контекст

Решения утверждены в phase-card:

- TypeScript strict с первого дня
- ESLint flat config (eslint.config.js), не `.eslintrc.json`
- Prettier для форматирования

Без этого — каждый файл будет в другом стиле, импорты раскиданы, типы не строгие.

## Что должно быть сделано

### TypeScript

1. **Корневой `tsconfig.base.json`:**

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "lib": ["ES2022", "DOM"],
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true,
       "noFallthroughCasesInSwitch": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "verbatimModuleSyntax": true,
       "forceConsistentCasingInFileNames": true,
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true
     },
     "exclude": ["node_modules", "dist", ".turbo", ".nuxt", ".output"]
   }
   ```

2. **В каждом пакете `tsconfig.json` extends base:**

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     },
     "include": ["src/**/*"]
   }
   ```

   Для apps/web (Nuxt) — Nuxt сам генерирует `.nuxt/tsconfig.json`, надо `extends` на него.

3. **Скрипт `typecheck` в каждом пакете:**
   ```json
   "typecheck": "tsc --noEmit"
   ```

### ESLint (flat config)

4. **Установить:**

   ```bash
   pnpm add -Dw eslint typescript-eslint @vue/eslint-config-typescript
   pnpm add -Dw eslint-plugin-vue @nuxt/eslint-config
   pnpm add -Dw eslint-config-prettier eslint-plugin-import
   ```

5. **Корневой `eslint.config.js`:**

   ```js
   import js from '@eslint/js'
   import tseslint from 'typescript-eslint'
   import vue from 'eslint-plugin-vue'
   import importPlugin from 'eslint-plugin-import'
   import prettier from 'eslint-config-prettier'

   export default tseslint.config(
     {
       ignores: [
         '**/node_modules/**',
         '**/dist/**',
         '**/.nuxt/**',
         '**/.output/**',
         '**/.turbo/**',
         'legacy/**',
       ],
     },
     js.configs.recommended,
     ...tseslint.configs.strict,
     ...vue.configs['flat/recommended'],
     {
       rules: {
         '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
         '@typescript-eslint/consistent-type-imports': 'error',
         'import/order': [
           'error',
           {
             groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
             'newlines-between': 'always',
           },
         ],
       },
     },
     prettier, // должен быть последним
   )
   ```

6. **Скрипт `lint` в корне:**
   ```json
   "lint": "eslint .",
   "lint:fix": "eslint . --fix"
   ```

### Prettier

7. **`.prettierrc.json` в корне:**

   ```json
   {
     "semi": false,
     "singleQuote": true,
     "trailingComma": "all",
     "printWidth": 100,
     "tabWidth": 2,
     "useTabs": false,
     "endOfLine": "lf",
     "arrowParens": "always",
     "vueIndentScriptAndStyle": true
   }
   ```

8. **`.prettierignore`:**

   ```
   node_modules
   dist
   .nuxt
   .output
   .turbo
   legacy
   pnpm-lock.yaml
   ```

9. **Скрипты:**
   ```json
   "format": "prettier --write .",
   "format:check": "prettier --check ."
   ```

## Критерии приёмки

- ✅ `pnpm typecheck` проходит во всех пакетах
- ✅ `pnpm lint` проходит без ошибок (на пустых пакетах — тривиально)
- ✅ `pnpm format:check` проходит
- ✅ Любой созданный `.ts` файл получает type-check
- ✅ Vue-файлы (когда появятся в apps/web) тоже проверяются
- ✅ В VSCode/Cursor авто-форматирование работает через расширения ESLint/Prettier
- ✅ После добавления случайного `any: any` в код — ESLint падает

## Подсказки

- **`verbatimModuleSyntax: true`** заставляет писать `import type` для type-only impors — критично для tree-shaking
- **`noUncheckedIndexedAccess: true`** — самое полезное strict-настройка. Делает `array[0]` возвращающим `T | undefined`. Болезненно, но спасает от рантайм-ошибок.
- Если IDE подсвечивает ошибки в файлах node_modules — это `skipLibCheck: true` в base config не подтянулся. Проверь, что extends правильно.
- Для apps/web (Nuxt) — нужно использовать `@nuxt/eslint` модуль, который автоматически генерирует правильный конфиг с Vue.

## Не делать

- ❌ Не добавлять много ESLint правил — start with basic, потом усиливаем
- ❌ Не подключать `eslint-plugin-perfectionist` или `eslint-plugin-unicorn` на старте — overkill
- ❌ Не настраивать pre-commit хук (husky) — Phase 9 или позже
- ❌ Не использовать `npx eslint-init` — у нас уже свой конфиг
