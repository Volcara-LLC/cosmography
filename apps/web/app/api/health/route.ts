import { NextResponse } from "next/server";
import { atlasRelease } from "@/app/data/atlas";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "cosmography-web",
      releaseId: atlasRelease.id,
      schemaVersion: "0.1.0",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        ETag: `W/"${atlasRelease.id}-health"`,
      },
    },
  );
}
