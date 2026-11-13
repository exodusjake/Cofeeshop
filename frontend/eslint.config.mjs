import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Client pages load data in effects and CMS section content is intentionally free-form JSON.
      "react-hooks/set-state-in-effect": "off",
      // Server pages wrap the *data fetch* in try/catch and return an ErrorState; JSX construction there cannot throw.
      "react-hooks/error-boundaries": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": ["warn", { allowTernary: true, allowShortCircuit: true }],
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
