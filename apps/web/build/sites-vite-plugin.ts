import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function alignD1MigrationDirectory(workerConfigPath: string) {
  if (!(await exists(workerConfigPath))) return;

  const workerConfig = JSON.parse(await readFile(workerConfigPath, "utf8")) as {
    d1_databases?: Array<{ migrations_dir?: string }>;
  };
  let changed = false;
  for (const database of workerConfig.d1_databases ?? []) {
    if (database.migrations_dir !== "../.openai/drizzle") {
      database.migrations_dir = "../.openai/drizzle";
      changed = true;
    }
  }
  if (changed) {
    await writeFile(workerConfigPath, JSON.stringify(workerConfig));
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    enforce: "post",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
        await alignD1MigrationDirectory(
          resolve(root, "dist", "server", "wrangler.json"),
        );
      }
    },
  };
}
