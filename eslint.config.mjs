import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
});

export default [
	...compat.extends("eslint:recommended", "prettier", "plugin:@typescript-eslint/recommended"),
	{
		plugins: {
			"@typescript-eslint": typescriptEslint
		},

		languageOptions: {
			globals: {
				...globals.node,
				Bun: false,
				WebSocket: false,
				Client: false,
				MongoClient: false,
				NodeCache: false
			},

			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module"
		},

		rules: {
			camelcase: ["warn", { properties: "always", ignoreDestructuring: true }],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-namespace": "off",
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-console": "off",
			"no-undef": ["warn", { typeof: true }],
			"no-constant-condition": "error",
			// indent: ["error", "tab"], // Disabled because it is handled by prettier
			semi: ["error", "always"],
			quotes: [2, "double"],
			"prefer-const": "error",
			"semi-style": ["error", "last"],
			"no-process-exit": "off",
			"node/no-missing-import": "off",
			"no-var-requires": "off",
			"no-async-promise-executor": "off"
		}
	}
];
