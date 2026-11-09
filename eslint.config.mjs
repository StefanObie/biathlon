import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";

import noUncheckedSupabaseError from "./eslint/no-unchecked-supabase-error.mjs";

const eslintConfig = [
  { ignores: [".next/**"] },
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      biathlon: {
        rules: { "no-unchecked-supabase-error": noUncheckedSupabaseError },
      },
    },
    rules: { "biathlon/no-unchecked-supabase-error": "error" },
  },
];

export default eslintConfig;
