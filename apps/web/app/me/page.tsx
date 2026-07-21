import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { SpacecraftHangar } from "@/app/components/account/SpacecraftHangar";
import { DirectoryHeader } from "@/app/components/navigation/DirectoryHeader";

export const metadata: Metadata = {
  title: "My Atlas · Private Exploration",
  description:
    "A private, truth-labeled workspace for exact-release saved places, user-recorded atlas encounters, one explicit Seven Scales return point, and imagined spacecraft concepts.",
};

export default function MyAtlasPage() {
  return (
    <div className="directory-page">
      <a className="skip-link" href="#main-content">
        Skip to My Atlas workspace
      </a>
      <DirectoryHeader />
      <main className="directory-main" id="main-content">
        <section className="directory-hero">
          <span className="eyebrow">My Atlas · private workspace</span>
          <h1>Imagine boldly. Label honestly.</h1>
          <p>
            Save exact-release atlas places you want to reopen, keep the objects you explicitly
            choose to record, remember one Seven Scales return point, then shape spacecraft
            concepts for journeys you want to compare. Cosmography keeps each private choice
            separate from passive viewing, learning assessment, and real mission evidence.
          </p>
          <aside className="directory-notice" aria-label="Permanent truth boundary">
            <ShieldCheck size={23} aria-hidden="true" />
            <span>
              <strong>
                User-confirmed navigation, history, and return point. Personal concept · not a
                mission record.
              </strong>{" "}
              Saved places are navigation aids, not physical camera poses or progress. Encounters
              appear only after you press record. The tour remembers only the one scale you
              explicitly save and never infers what you learned. Craft styling never creates a
              vehicle, mission, trajectory, telemetry stream, or scientific result.
            </span>
          </aside>
        </section>

        <SpacecraftHangar />
      </main>
    </div>
  );
}
