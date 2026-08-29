import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // El prefijo `_` marca un binding intencionadamente descartado, p.ej. al
      // omitir una clave con destructuring: `const { c: _c, ...rest } = row`.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    // `presentacion/build.js` y los scripts sueltos de `scripts/` son programas
    // de Node en CommonJS que se ejecutan con `node fichero.js`, no módulos de
    // la aplicación. `require()` es ahí la forma correcta de importar, así que
    // la regla pensada para el código TypeScript del bundle no aplica.
    files: ["presentacion/**/*.js", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
