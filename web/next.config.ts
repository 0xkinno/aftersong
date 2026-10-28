import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Local development reads the single .env in the repo root. Hosted builds use platform variables.
if (existsSync("../.env")) process.loadEnvFile("../.env");

const config: NextConfig = {
  reactStrictMode: true,
};

export default config;
