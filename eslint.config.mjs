import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const eslintConfig = [
  { ignores: [".next/**"] },
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
];

export default eslintConfig;
