// Runs a test file with the LOCAL Supabase address and keys taken from `npx supabase status`.
// Usage: node tests/with-local-supabase.mjs tests/security.integration.ts
import { execSync, spawnSync } from "node:child_process";

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
if (!env.API_URL) {
  console.error("Local Supabase is not running. Start it with: npx supabase start");
  process.exit(2);
}
const result = spawnSync("npx", ["tsx", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, TEST_SUPABASE_URL: env.API_URL, TEST_SUPABASE_ANON_KEY: env.ANON_KEY, TEST_SUPABASE_SERVICE_KEY: env.SERVICE_ROLE_KEY },
});
process.exit(result.status ?? 1);
