import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Local development reads the single .env in the repo root. Hosted builds use platform variables.
if (existsSync("../.env")) process.loadEnvFile("../.env");

const config: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
  },
};

export default config;
