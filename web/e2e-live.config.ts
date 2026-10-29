import { defineConfig } from "@playwright/test";

// Walks the deployed site end to end. Usage: BASE_URL=https://aftersong.vercel.app npx playwright test -c e2e-live.config.ts
export default defineConfig({
  testDir: "./e2e-live",
  timeout: 180000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "https://aftersong.vercel.app", trace: "off", viewport: { width: 1440, height: 900 } },
});
