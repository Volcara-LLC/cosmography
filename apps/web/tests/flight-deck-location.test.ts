import assert from "node:assert/strict";
import test from "node:test";

import { createFlightDeckLocationSearch } from "../app/lib/navigation/flight-deck-location";

test("Flight Deck locations are exact, canonical, and discard stale state", () => {
  assert.equal(
    createFlightDeckLocationSearch({
      appearance: "scientific",
      focusSlug: "proxima-centauri",
      travelMode: "voyager",
      releaseId: "rel_landing_atlas_v0_1_0",
    }),
    "appearance=scientific&focus=proxima-centauri&travel=voyager&release=rel_landing_atlas_v0_1_0",
  );
});
