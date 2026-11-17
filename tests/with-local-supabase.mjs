// Runs a test file with the LOCAL Supabase address and keys taken from {"_tag":"Error","error":{"code":"UnknownSubcommand","message":"Unknown subcommand "status\" for "supabase"

  Did you mean this?
    status"}}.
// Usage: node tests/with-local-supabase.mjs tests/security.integration.ts
import { execSync, spawnSync } from "node:child_process";

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split(/?
/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const result = spawnSync("npx", ["tsx", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, TEST_SUPABASE_URL: env.API_URL, TEST_SUPABASE_ANON_KEY: env.ANON_KEY, TEST_SUPABASE_SERVICE_KEY: env.SERVICE_ROLE_KEY },
});
process.exit(result.status ?? 1);
