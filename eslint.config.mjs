import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

// Flat config for ESLint 9. We deliberately avoid FlatCompat + the legacy
// "eslint-config-next" extends, which crashes on ESLint 9 ("Converting circular
// structure to JSON"). Instead we wire the Next plugin's rule sets directly and
// use the typescript-eslint parser. Kept lightweight so it runs cleanly in CI.
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "src/generated/**",
      "scripts/**",
      "prisma/seed.ts",
      "**/*.test.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // We intentionally use plain <img> for generated images / data URLs where
      // next/image's optimizer is unnecessary (images are unoptimized).
      "@next/next/no-img-element": "off",
    },
  },
);
