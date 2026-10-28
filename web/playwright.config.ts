import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3100", trace: "off" },
});
