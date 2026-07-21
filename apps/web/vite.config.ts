import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareWorkerName = process.env.CLOUDFLARE_WORKER_NAME ?? "cosmography-web";
const cloudflareD1DatabaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME ?? "site-creator-d1";
const cloudflareD1DatabaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? SITE_CREATOR_PLACEHOLDER_DATABASE_ID;
const cloudflareR2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? "site-creator-r2";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: cloudflareWorkerName,
  ...(cloudflareAccountId ? { account_id: cloudflareAccountId } : {}),
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: {
    JUDGE_ACCESS_MODE:
      process.env.JUDGE_ACCESS_MODE === "disabled" ? "disabled" : "shared-code",
    JUDGE_COOKIE_TTL_SECONDS:
      process.env.JUDGE_COOKIE_TTL_SECONDS ?? "1814400",
  },
  assets: {
    binding: "ASSETS",
    run_worker_first: true,
  },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: cloudflareD1DatabaseName,
          database_id: cloudflareD1DatabaseId,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: cloudflareR2BucketName,
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // Three.js is an on-demand renderer dependency rather than eager route JS.
    // Renderer bundle tests enforce tighter initial-load and compressed-engine
    // budgets; this threshold only suppresses Vite's generic raw-size advisory
    // for the pinned lazy Three.js module.
    build: { chunkSizeWarningLimit: 550 },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
