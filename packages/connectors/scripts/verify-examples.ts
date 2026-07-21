import {
  assertManifestIntegrity,
  deterministicExampleManifests,
  stableStringify,
} from "../src/index";

for (const manifest of deterministicExampleManifests) {
  assertManifestIntegrity(manifest);
  const first = stableStringify(manifest);
  const second = stableStringify(JSON.parse(first));
  if (first !== second) {
    throw new Error(`${manifest.manifestId} is not canonically stable`);
  }
}

process.stdout.write(
  `Verified ${deterministicExampleManifests.length} deterministic frozen manifests.\n`,
);
