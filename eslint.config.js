import baseConfig from "@acdh-oeaw/eslint-config";
import vueConfig from "@acdh-oeaw/eslint-config-vue";
import gitignore from "eslint-config-flat-gitignore";

const config = [
  gitignore(),
  ...baseConfig,
  ...vueConfig,
  {
    rules: {
    },
  },
];

export default config;
