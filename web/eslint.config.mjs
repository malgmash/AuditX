import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Money is integer cents. Fractional literals and float parsing are banned in the money path.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "VariableDeclarator[id.name=/(Cents|Cent)$/] > Literal[raw=/[.]/]",
          message: "Money is integer cents. Do not assign a fractional literal to a cents value.",
        },
        {
          selector: "Property[key.name=/(Cents|Cent)$/] > Literal[raw=/[.]/]",
          message: "Money is integer cents. Do not use a fractional literal for a cents field.",
        },
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "Do not parse money with parseFloat. Use dollarsToCents from @/lib/money.",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
