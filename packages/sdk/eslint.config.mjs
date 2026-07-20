import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  { files: ["**/*.{js,mjs,cjs,ts,tsx}"], languageOptions: { globals: globals.node } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
