import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // `react-refresh/only-export-components` only protects Fast Refresh in dev.
    // These files are legitimate exceptions to the "one component per file" rule
    // it enforces: barrel re-export files (`*Pages.tsx`) and shadcn-style component
    // files that export their `cva` variants config alongside the component. Both
    // are standard, correct patterns — not technical debt — so we scope the rule
    // off here instead of refactoring working code to satisfy a dev-only lint rule.
    files: [
      'src/pages/**/*Pages.tsx',
      'src/components/ui/Button.tsx',
      'src/components/comments/CommentComposerFields.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
