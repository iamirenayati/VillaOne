import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Vendored, version-pinned browser libraries are linted by their publisher.
    "public/vendor/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // VillaOne intentionally initializes API-backed client state in effects.
      // These React Compiler advisory rules reject that established pattern even
      // though the application is not compiled with the React Compiler.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/immutability": "off",
      // Several branded navigation elements intentionally use full document
      // navigation so authentication state is re-read at the application shell.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
