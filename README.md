# Cosmography Build Week judging guide

Cosmography is an evidence-aware, cross-scale atlas prototype that connects an observer-centered view of the observable universe to galaxies, star systems, worlds, missions, and bounded recorded surface viewpoints. It is a working prototype of the navigation and scientific-disclosure architecture, not a completed map of the universe and not a completed Mars Street View network.

## What currently works

The submitted version provides an interactive WebGL atlas with seven scientific domains, exact-release search and deep links, source and evidence panels, a Seven Scales tour from the observable universe to Jezero Crater, an illustrative Solar System scene with a direct Mars handoff, an imagery-backed Mars globe, three discrete JPL-published Jezero panorama stations, actual Perseverance landing footage, a Voyager 1 evidence journey, an Earth exploration network, structured no-canvas content, and responsive/accessibility foundations.

The Mars stations are separate recorded presentation nodes. They do not provide solved rover poses, continuous movement, complete spherical coverage, or a complete street-level network. Solar System placement is illustrative rather than current ephemerides. Broader catalogs, AI chat, live external data, production accounts, and full mission-route traversal remain incomplete or planned.

## Judge access

Open `https://cosmography.ai` and enter the shared judging code supplied privately in the Devpost testing instructions. No email address, Cloudflare account, Cosmography account, GitHub account, or ChatGPT login is required.

The code is validated only by the Cloudflare Worker. A successful entry creates a signed Secure, HttpOnly, SameSite cookie. The code and signing key are Cloudflare secrets and are not present in this repository, browser JavaScript, URLs, or logs. Repeated failures are limited through D1. If the secrets or D1 binding are unavailable, the site fails closed with a neutral unavailable page.

## Recommended six-step demonstration

1. Open the universal view and select **Seven Scales tour** for the strongest first impression.
2. Advance through **Laniakea Supercluster**, **Local Group**, **Milky Way Galaxy**, and **Solar System** to show one connected cross-scale journey.
3. Continue to **Mars** and **Jezero Crater**, then enter the recorded surface view and switch among the three discrete panorama stations and the actual landing-footage tab.
4. Return to the main atlas, open **Missions**, and select **Voyager 1** to show the best mission narrative and its explicit telemetry/ephemeris boundary.
5. Open **Evidence** or **Sources** on a selected destination to show scientific citations, truth labels, known gaps, and provenance.
6. Open **Vision** to distinguish the constructed prototype from the long-term product goal.

Use a current desktop version of Chrome or Edge with WebGL enabled. Allow a few seconds for the first lazy 3D renderer load. Do not rely on continuous Mars driving, physical real-time Solar System positions, live telemetry, AI chat, or complete object/mission catalogs.

## Local run

Requirements are Node.js 22.13 or newer and npm.

```powershell
cd apps/web
npm install
$env:JUDGE_ACCESS_MODE="disabled"
npm run dev
```

Open `http://127.0.0.1:4174/`.

For a production build:

```powershell
cd apps/web
npm install
npm run build
```

The output is `apps/web/dist`, with browser assets in `dist/client` and the Worker entry/configuration in `dist/server`.

## Verification

```powershell
cd apps/web
npm run lint
npm test
node scripts/judge-browser-smoke.mjs

cd ../../packages/scientific-model
npm run check
cd ../relativity
npm run check
cd ../connectors
npm run check
```

The browser smoke test builds an isolated local Worker with generated test-only values, applies migrations to an ephemeral D1 database, launches installed Chrome, checks the access screen, neutral rejection, successful signed-cookie access, protected application assets, the atlas, and the Voyager route, then removes its temporary browser profile.

## Cloudflare judging configuration

The Worker must retain these bindings:

1. D1 binding `DB`, including all migrations through `0005_judge_access_rate_limit.sql`.
2. R2 binding `COSMOGRAPHY_MEDIA`.
3. Static asset binding `ASSETS` with `run_worker_first` enabled so the access gate covers every application route and asset.
4. Plain variable `JUDGE_ACCESS_MODE=shared-code`.
5. Plain variable `JUDGE_COOKIE_TTL_SECONDS=1814400` for a 21-day judging session, adjusted only if the judging window requires it.
6. Protected secret `JUDGE_ACCESS_CODE`.
7. Protected secret `JUDGE_COOKIE_SECRET`.

Enter both secret values in Cloudflare's Worker secret manager or with `wrangler secret put`. Do not place either value in a command argument, source file, environment example, issue, Devpost public description, or Git history. The existing identity secret names are not required for the read-only judging path; they are needed only if personal account features are deliberately enabled.

The recommended contest resources are Worker `cosmography-judging`, D1 database `cosmography-judging-db`, R2 bucket `cosmography-media`, and the custom domain `cosmography.ai`. The apex domain should be attached as a Cloudflare Workers Custom Domain after the verified build, migration, and secrets are ready. Do not create a second email or Cloudflare Access login in front of the shared-code gate.

After those resources exist, prepare the exact Worker package with non-secret build variables:

```powershell
cd apps/web
$env:CLOUDFLARE_ACCOUNT_ID="<the Cloudflare account ID>"
$env:CLOUDFLARE_WORKER_NAME="cosmography-judging"
$env:CLOUDFLARE_D1_DATABASE_NAME="cosmography-judging-db"
$env:CLOUDFLARE_D1_DATABASE_ID="<the D1 ID returned by Cloudflare>"
$env:CLOUDFLARE_R2_BUCKET_NAME="cosmography-media"
npm run build
```

The generated `dist/server/wrangler.json` must show Worker `cosmography-judging`, D1 binding `DB` with the real database ID, R2 binding `COSMOGRAPHY_MEDIA`, asset binding `ASSETS`, and `run_worker_first: true` before any remote command. Apply the packaged migrations and deploy only after the owner approves the final external actions:

```powershell
npx wrangler d1 migrations apply cosmography-judging-db --remote --config dist/server/wrangler.json
npx wrangler secret put JUDGE_ACCESS_CODE --config dist/server/wrangler.json
npx wrangler secret put JUDGE_COOKIE_SECRET --config dist/server/wrangler.json
npx wrangler deploy --config dist/server/wrangler.json
```

Each `wrangler secret put` command prompts securely in the terminal. Never add the value after the command or paste it into project files. Verify the generated `workers.dev` URL first, then attach `cosmography.ai` as the Worker custom domain in the Cloudflare dashboard. Because `cosmography.ai` is an apex hostname in the same Cloudflare account, use the Custom Domains flow and allow Cloudflare to create the proxied DNS record and certificate; do not add an independent tunnel.

## Recovery and rollback

The private development repository and its draft pull request remain authoritative. Before any deployment, record the immutable submission commit and create a judging tag such as `build-week-2026-judging-v1`. Roll back by redeploying the previous saved Worker version or the preceding immutable judging tag. Disabling the contest gate after judging requires only setting `JUDGE_ACCESS_MODE=disabled` in a deliberate later deployment; the application does not need to be rewritten.

No open-source license has been selected. Absence of a license means the code is available for judging inspection but no general reuse permission is granted yet.
