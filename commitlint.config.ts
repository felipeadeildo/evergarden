import { RuleConfigSeverity, type UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      RuleConfigSeverity.Warning,
      "always",
      [
        "render",
        "anchor",
        "library",
        "comments",
        "sharing",
        "access",
        "mcp",
        "api",
        "ui",
        "auth",
        "db",
        "deps",
      ],
    ],
  },
};

export default config;
