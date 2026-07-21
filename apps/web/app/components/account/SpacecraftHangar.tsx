"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  isCanonicalSpacecraftDisplayName,
  normalizeSpacecraftDisplayName,
  spacecraftDisplayNameIssue,
} from "@/app/lib/personal/spacecraft-display-name";
import styles from "./SpacecraftHangar.module.css";
import { RecordedEncountersHistory } from "./RecordedEncountersHistory";
import { SavedPlaces } from "./SavedPlaces";
import { TourResumeSummary } from "./TourResumeSummary";

type SpacecraftProfile = "fusion-0.1c" | "fictional-warp";
type HullPreset = "pearl" | "graphite" | "mars-copper" | "lunar-silver";
type AccentPreset = "cyan" | "gold" | "verdant" | "ember";
type InsigniaPreset = "none" | "orbit" | "star" | "horizon";

interface SpacecraftAppearance {
  schemaId: "cosmography.user-spacecraft.appearance";
  schemaVersion: "1.0.0";
  hullPreset: HullPreset;
  accentPreset: AccentPreset;
  insignia: InsigniaPreset;
}

interface SpacecraftPropulsion {
  id: string;
  label: string;
  truthClass: "hypothetical-physical" | "fictional-only";
  summary: string;
  speedFractionOfC: number | null;
  fictional: boolean;
  counterfactual: boolean;
  personalConcept: true;
  comparisonOnly: true;
  availableVehicle: false;
  actualJourneyClaim: false;
  missionPlan: false;
  trajectoryClaim: false;
  telemetryClaim: false;
  scientificValidation: false;
}

interface SpacecraftRecord {
  id: string;
  displayName: string;
  profile: SpacecraftProfile;
  appearance: SpacecraftAppearance;
  propulsion: SpacecraftPropulsion;
  createdAtMs: number;
  updatedAtMs: number;
}

interface Draft {
  displayName: string;
  profile: SpacecraftProfile;
  appearance: SpacecraftAppearance;
}

type LoadState = "loading" | "ready" | "signed-out" | "unavailable" | "error";

const APPEARANCE_SCHEMA = {
  schemaId: "cosmography.user-spacecraft.appearance",
  schemaVersion: "1.0.0",
} as const;

const DEFAULT_DRAFT: Draft = {
  displayName: "",
  profile: "fusion-0.1c",
  appearance: {
    ...APPEARANCE_SCHEMA,
    hullPreset: "pearl",
    accentPreset: "cyan",
    insignia: "orbit",
  },
};

const PROFILE_DETAILS: Record<
  SpacecraftProfile,
  { label: string; eyebrow: string; description: string; assumption: string }
> = {
  "fusion-0.1c": {
    label: "Hypothetical fusion study",
    eyebrow: "Physics comparison · 0.1c assumption",
    description:
      "Imagine a fusion-driven concept moving at a constant ten percent of light speed. That speed is an explicit comparison assumption—not an available spacecraft or mission plan.",
    assumption: "Counterfactual physical comparison",
  },
  "fictional-warp": {
    label: "Fictional warp story craft",
    eyebrow: "Story mode · no scientific duration",
    description:
      "Build a narrative craft around fictional warp travel. Cosmography will not assign it a scientific travel time, trajectory, telemetry, or validation.",
    assumption: "Fictional comparison only",
  },
};

const HULL_OPTIONS: ReadonlyArray<{ value: HullPreset; label: string }> = [
  { value: "pearl", label: "Pearl white" },
  { value: "graphite", label: "Graphite" },
  { value: "mars-copper", label: "Mars copper" },
  { value: "lunar-silver", label: "Lunar silver" },
];

const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentPreset; label: string }> = [
  { value: "cyan", label: "Ion cyan" },
  { value: "gold", label: "Solar gold" },
  { value: "verdant", label: "Aurora green" },
  { value: "ember", label: "Ember coral" },
];

const INSIGNIA_OPTIONS: ReadonlyArray<{ value: InsigniaPreset; label: string }> = [
  { value: "none", label: "No insignia" },
  { value: "orbit", label: "Orbit" },
  { value: "star", label: "Star" },
  { value: "horizon", label: "Horizon" },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringWithin(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function isAppearance(value: unknown): value is SpacecraftAppearance {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).length === 5 &&
    value.schemaId === APPEARANCE_SCHEMA.schemaId &&
    value.schemaVersion === APPEARANCE_SCHEMA.schemaVersion &&
    HULL_OPTIONS.some((option) => option.value === value.hullPreset) &&
    ACCENT_OPTIONS.some((option) => option.value === value.accentPreset) &&
    INSIGNIA_OPTIONS.some((option) => option.value === value.insignia)
  );
}

function isPropulsion(value: unknown, profile: SpacecraftProfile): value is SpacecraftPropulsion {
  if (!isObject(value)) return false;
  const speedIsValid =
    value.speedFractionOfC === null ||
    (typeof value.speedFractionOfC === "number" && Number.isFinite(value.speedFractionOfC));
  const profileTruthIsValid =
    profile === "fusion-0.1c"
      ? value.speedFractionOfC === 0.1 &&
        value.fictional === false &&
        value.counterfactual === true &&
        value.truthClass === "hypothetical-physical"
      : value.speedFractionOfC === null &&
        value.fictional === true &&
        value.counterfactual === false &&
        value.truthClass === "fictional-only";
  return (
    Object.keys(value).length === 15 &&
    isStringWithin(value.id, 120) &&
    isStringWithin(value.label, 120) &&
    isStringWithin(value.truthClass, 80) &&
    isStringWithin(value.summary, 600) &&
    speedIsValid &&
    profileTruthIsValid &&
    value.personalConcept === true &&
    value.comparisonOnly === true &&
    value.availableVehicle === false &&
    value.actualJourneyClaim === false &&
    value.missionPlan === false &&
    value.trajectoryClaim === false &&
    value.telemetryClaim === false &&
    value.scientificValidation === false
  );
}

function isSpacecraftRecord(value: unknown): value is SpacecraftRecord {
  if (!isObject(value)) return false;
  const profile = value.profile;
  if (profile !== "fusion-0.1c" && profile !== "fictional-warp") return false;
  return (
    typeof value.id === "string" &&
    /^ship_[0-9a-f]{32}$/.test(value.id) &&
    isCanonicalSpacecraftDisplayName(value.displayName) &&
    isAppearance(value.appearance) &&
    isPropulsion(value.propulsion, profile) &&
    typeof value.createdAtMs === "number" &&
    Number.isSafeInteger(value.createdAtMs) &&
    value.createdAtMs > 0 &&
    value.createdAtMs <= 8_640_000_000_000_000 &&
    typeof value.updatedAtMs === "number" &&
    Number.isSafeInteger(value.updatedAtMs) &&
    value.updatedAtMs <= 8_640_000_000_000_000 &&
    value.updatedAtMs >= value.createdAtMs
  );
}

function recordsFromEnvelope(payload: unknown): SpacecraftRecord[] | null {
  if (
    !isObject(payload) ||
    payload.schemaId !== "cosmography.user-spacecraft" ||
    payload.schemaVersion !== "1.0.0"
  ) {
    return null;
  }
  const values = Array.isArray(payload.records) ? payload.records : [payload.records];
  return values.every(isSpacecraftRecord) ? values : null;
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizedName(value: string): string {
  return normalizeSpacecraftDisplayName(value);
}

function nameError(value: string): string | null {
  const issue = spacecraftDisplayNameIssue(value);
  if (issue === "forbidden-characters") {
    return "Remove control or bidirectional formatting characters from the name.";
  }
  if (issue === "invalid-length") {
    return normalizedName(value) ? "Use 80 characters or fewer." : "Give this concept a name.";
  }
  return null;
}

function appearancesMatch(first: SpacecraftAppearance, second: SpacecraftAppearance): boolean {
  return (
    first.schemaId === second.schemaId &&
    first.schemaVersion === second.schemaVersion &&
    first.hullPreset === second.hullPreset &&
    first.accentPreset === second.accentPreset &&
    first.insignia === second.insignia
  );
}

function subscribeToLocation(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

function browserReturnTo(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function serverReturnTo(): string {
  return "/me";
}

function formattedDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function responseError(payload: unknown, fallback: string): string {
  if (!isObject(payload)) return fallback;
  if (payload.error === "spacecraft_quota_reached") {
    return "Your private hangar is full. Remove a concept before creating another.";
  }
  if (payload.error === "spacecraft_conflict") {
    return "This concept changed in another session. Reload the hangar before trying again.";
  }
  return fallback;
}

function CraftPreview({
  appearance,
  label,
  compact = false,
}: {
  appearance: SpacecraftAppearance;
  label: string;
  compact?: boolean;
}) {
  const insigniaGlyph: Record<InsigniaPreset, string> = {
    none: "",
    orbit: "○",
    star: "✦",
    horizon: "⌒",
  };
  return (
    <div
      className={`${styles.craftPreview} ${compact ? styles.craftPreviewCompact : ""}`}
      data-hull={appearance.hullPreset}
      data-accent={appearance.accentPreset}
      role="img"
      aria-label={`${label}, shown as a ${appearance.hullPreset.replaceAll("-", " ")} personal spacecraft concept with ${appearance.accentPreset} accents.`}
    >
      <span className={styles.planetGlow} aria-hidden="true" />
      <span className={styles.flightLine} aria-hidden="true" />
      <span className={styles.craft} aria-hidden="true">
        <span className={styles.craftWing} />
        <span className={styles.craftBody}>
          <span className={styles.cockpit} />
          <span className={styles.insignia}>{insigniaGlyph[appearance.insignia]}</span>
        </span>
        <span className={styles.craftEngine} />
      </span>
      <span className={styles.previewLabel} aria-hidden="true">
        Concept visualization
      </span>
    </div>
  );
}

function AppearanceFields({
  draft,
  idPrefix,
  onChange,
}: {
  draft: Draft;
  idPrefix: string;
  onChange: (appearance: SpacecraftAppearance) => void;
}) {
  return (
    <div className={styles.appearanceGrid}>
      <label htmlFor={`${idPrefix}-hull`}>
        <span>Hull finish</span>
        <select
          id={`${idPrefix}-hull`}
          value={draft.appearance.hullPreset}
          onChange={(event) =>
            onChange({ ...draft.appearance, hullPreset: event.target.value as HullPreset })
          }
        >
          {HULL_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-accent`}>
        <span>Accent light</span>
        <select
          id={`${idPrefix}-accent`}
          value={draft.appearance.accentPreset}
          onChange={(event) =>
            onChange({ ...draft.appearance, accentPreset: event.target.value as AccentPreset })
          }
        >
          {ACCENT_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-insignia`}>
        <span>Insignia</span>
        <select
          id={`${idPrefix}-insignia`}
          value={draft.appearance.insignia}
          onChange={(event) =>
            onChange({ ...draft.appearance, insignia: event.target.value as InsigniaPreset })
          }
        >
          {INSIGNIA_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ValidationSummary({
  message,
  summaryRef,
}: {
  message: string | null;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  if (!message) return null;
  return (
    <div className={styles.validationSummary} role="alert" tabIndex={-1} ref={summaryRef}>
      <CircleAlert size={17} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function SpacecraftHangar() {
  const returnTo = useSyncExternalStore(subscribeToLocation, browserReturnTo, serverReturnTo);
  const privateSignInHref = `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [records, setRecords] = useState<SpacecraftRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const createNameRef = useRef<HTMLInputElement>(null);
  const createErrorRef = useRef<HTMLDivElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const editErrorRef = useRef<HTMLDivElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const recordRefs = useRef(new Map<string, HTMLElement>());
  const editTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const deleteTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const deleteConfirmRefs = useRef(new Map<string, HTMLButtonElement>());

  const transitionForStatus = useCallback((status: number, action: "load" | "write") => {
    if (status === 401) {
      setLoadState("signed-out");
      setRecords([]);
      setAnnouncement(
        action === "write"
          ? "Your sign-in ended. Nothing was saved."
          : "Sign in to open your private spacecraft hangar.",
      );
      if (action === "write") {
        window.requestAnimationFrame(() => signInRef.current?.focus());
      }
      return true;
    }
    if (status === 503) {
      setLoadState("unavailable");
      setRecords([]);
      setAnnouncement("Private storage is unavailable. Nothing was saved on this device.");
      return true;
    }
    return false;
  }, []);

  const loadRecords = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch("/api/v1/me/spacecraft", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        });
        if (transitionForStatus(response.status, "load")) return;
        const payload = await responsePayload(response);
        const parsedRecords = recordsFromEnvelope(payload);
        if (!response.ok || !parsedRecords) {
          setLoadState("error");
          return;
        }
        setRecords(parsedRecords);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      }
    },
    [transitionForStatus],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/me/spacecraft", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({ response, payload: await responsePayload(response) }))
      .then(({ response, payload }) => {
        if (transitionForStatus(response.status, "load")) return;
        const parsedRecords = recordsFromEnvelope(payload);
        if (!response.ok || !parsedRecords) {
          setLoadState("error");
          return;
        }
        setRecords(parsedRecords);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [transitionForStatus]);

  function focusRecord(id: string) {
    window.requestAnimationFrame(() => recordRefs.current.get(id)?.focus());
  }

  function openEditor(record: SpacecraftRecord) {
    setDeleteId(null);
    setEditError(null);
    setEditing({
      id: record.id,
      draft: {
        displayName: record.displayName,
        profile: record.profile,
        appearance: record.appearance,
      },
    });
    window.requestAnimationFrame(() => editNameRef.current?.focus());
  }

  function cancelEditor(id: string) {
    setEditing(null);
    setEditError(null);
    window.requestAnimationFrame(() => editTriggerRefs.current.get(id)?.focus());
  }

  function openDeleteConfirmation(id: string) {
    setDeleteId(id);
    window.requestAnimationFrame(() => deleteConfirmRefs.current.get(id)?.focus());
  }

  async function createSpacecraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = nameError(draft.displayName);
    if (validationMessage) {
      setCreateError(validationMessage);
      window.requestAnimationFrame(() => createErrorRef.current?.focus());
      return;
    }

    const displayName = normalizedName(draft.displayName);
    setCreateError(null);
    setPendingAction("create");
    try {
      const response = await fetch("/api/v1/me/spacecraft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          displayName,
          profile: draft.profile,
          appearance: draft.appearance,
        }),
      });
      if (transitionForStatus(response.status, "write")) return;
      const payload = await responsePayload(response);
      const created = recordsFromEnvelope(payload)?.[0];
      if (response.status !== 201 || !created) {
        setCreateError(responseError(payload, "This concept could not be saved. Try again."));
        window.requestAnimationFrame(() => createErrorRef.current?.focus());
        return;
      }
      setRecords((current) => [created, ...current.filter((record) => record.id !== created.id)]);
      setDraft(DEFAULT_DRAFT);
      setAnnouncement(`${created.displayName} was saved privately as a personal concept.`);
      focusRecord(created.id);
    } catch {
      setCreateError("This concept could not be saved. Check your connection and try again.");
      window.requestAnimationFrame(() => createErrorRef.current?.focus());
    } finally {
      setPendingAction(null);
    }
  }

  async function updateSpacecraft(event: FormEvent<HTMLFormElement>, record: SpacecraftRecord) {
    event.preventDefault();
    if (!editing || editing.id !== record.id) return;
    const validationMessage = nameError(editing.draft.displayName);
    if (validationMessage) {
      setEditError(validationMessage);
      window.requestAnimationFrame(() => editErrorRef.current?.focus());
      return;
    }

    const displayName = normalizedName(editing.draft.displayName);
    setEditError(null);
    setPendingAction(`edit:${record.id}`);
    try {
      const response = await fetch(`/api/v1/me/spacecraft/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          expectedUpdatedAtMs: record.updatedAtMs,
          displayName,
          appearance: editing.draft.appearance,
        }),
      });
      if (transitionForStatus(response.status, "write")) return;
      const payload = await responsePayload(response);
      const updated = recordsFromEnvelope(payload)?.[0];
      if (response.status !== 200 || !updated) {
        setEditError(responseError(payload, "Changes could not be saved. Try again."));
        window.requestAnimationFrame(() => editErrorRef.current?.focus());
        return;
      }
      setRecords((current) =>
        current.map((currentRecord) => (currentRecord.id === updated.id ? updated : currentRecord)),
      );
      setEditing(null);
      setAnnouncement(`${updated.displayName} was updated.`);
      focusRecord(updated.id);
    } catch {
      setEditError("Changes could not be saved. Check your connection and try again.");
      window.requestAnimationFrame(() => editErrorRef.current?.focus());
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteSpacecraft(record: SpacecraftRecord) {
    const recordIndex = records.findIndex((candidate) => candidate.id === record.id);
    setPendingAction(`delete:${record.id}`);
    try {
      const response = await fetch(`/api/v1/me/spacecraft/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (transitionForStatus(response.status, "write")) return;
      if (response.status !== 200 && response.status !== 204) {
        const payload = await responsePayload(response);
        setAnnouncement(responseError(payload, `${record.displayName} could not be removed.`));
        return;
      }
      const remaining = records.filter((candidate) => candidate.id !== record.id);
      setRecords(remaining);
      setDeleteId(null);
      setAnnouncement(`${record.displayName} was removed from your private hangar.`);
      const nextRecord = remaining[Math.min(recordIndex, remaining.length - 1)];
      if (nextRecord) focusRecord(nextRecord.id);
      else window.requestAnimationFrame(() => createNameRef.current?.focus());
    } catch {
      setAnnouncement(`${record.displayName} could not be removed. Check your connection.`);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className={styles.hangar}>
      <SavedPlaces />

      {announcement ? (
        <p className={styles.actionStatus} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      ) : null}

      <section className={styles.modelSection} aria-labelledby="concept-models-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>Two honest starting points</span>
            <h2 id="concept-models-title">Choose the idea before the finish.</h2>
          </div>
          <p>
            These profiles explain what Cosmography can compare. Their truth labels never disappear,
            even after you name and style a craft.
          </p>
        </div>

        <div className={styles.modelGrid}>
          {(Object.entries(PROFILE_DETAILS) as Array<
            [SpacecraftProfile, (typeof PROFILE_DETAILS)[SpacecraftProfile]]
          >).map(([profile, detail]) => (
            <article className={styles.modelCard} key={profile} data-profile={profile}>
              <div className={styles.modelNumber} aria-hidden="true">
                {profile === "fusion-0.1c" ? "01" : "02"}
              </div>
              <span className={styles.modelEyebrow}>{detail.eyebrow}</span>
              <h3>{detail.label}</h3>
              <p>{detail.description}</p>
              <div className={styles.truthRow} aria-label="Permanent truth boundaries">
                <span>No available vehicle</span>
                <span>No mission claim</span>
                <span>{profile === "fusion-0.1c" ? "Assumed speed" : "Fictional only"}</span>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.voyagerAside}>
          <div>
            <span className={styles.voyagerDot} aria-hidden="true" />
            <p>
              Looking for the real spacecraft? Voyager 1 is kept in the mission atlas, separate
              from anything imagined here.
            </p>
          </div>
          <Link href="/missions/voyager-1">
            Open the Voyager 1 record <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.hangarSection} aria-labelledby="hangar-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>Private workspace</span>
            <h2 id="hangar-title">Your spacecraft concepts</h2>
          </div>
          <p>
            Names and finishes are personal exploration data. Cosmography stores them privately
            when sign-in and private storage are available—never in browser storage.
          </p>
        </div>

        {loadState === "loading" ? (
          <div className={styles.statePanel} role="status">
            <LoaderCircle className={styles.spinner} size={22} aria-hidden="true" />
            <div>
              <h3>Opening your private hangar…</h3>
              <p>The model explanations above remain public.</p>
            </div>
          </div>
        ) : null}

        {loadState === "signed-out" ? (
          <div className={styles.statePanel}>
            <LockKeyhole size={24} aria-hidden="true" />
            <div>
              <h3>Sign in to save privately</h3>
              <p>
                You can read both concept profiles without an account. Sign in only when you want
                to create a private hangar.
              </p>
              <a
                className={styles.primaryButton}
                href={privateSignInHref}
                ref={signInRef}
              >
                Sign in with ChatGPT <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        ) : null}

        {loadState === "unavailable" ? (
          <div className={styles.statePanel} role="status">
            <ShieldCheck size={24} aria-hidden="true" />
            <div>
              <h3>Private storage is not configured in this preview.</h3>
              <p>
                Nothing was saved. The two public concept profiles remain available above, and no
                browser fallback was created on this device.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className={styles.statePanel} role="alert">
            <CircleAlert size={24} aria-hidden="true" />
            <div>
              <h3>Your private hangar could not be opened</h3>
              <p>No local copy was created. Check your connection, then try again.</p>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setLoadState("loading");
                  void loadRecords();
                }}
              >
                <RotateCcw size={16} aria-hidden="true" /> Try again
              </button>
            </div>
          </div>
        ) : null}

        {loadState === "ready" ? (
          <div className={styles.workspace}>
            <section className={styles.creator} aria-labelledby="create-concept-title">
              <div className={styles.creatorIntro}>
                <span className={styles.stepNumber}>01</span>
                <div>
                  <span className={styles.kicker}>Design a personal concept</span>
                  <h3 id="create-concept-title">Name the craft. Keep the boundary.</h3>
                  <p>
                    Styling changes the illustration only. It never creates a real vehicle,
                    trajectory, mission, or scientific result.
                  </p>
                </div>
              </div>

              <form className={styles.creatorForm} onSubmit={createSpacecraft} noValidate>
                <CraftPreview
                  appearance={draft.appearance}
                  label={normalizedName(draft.displayName) || "Unnamed craft"}
                />
                <div className={styles.truthBadge}>
                  <ShieldCheck size={15} aria-hidden="true" />
                  Personal concept · not a mission record
                </div>

                <ValidationSummary message={createError} summaryRef={createErrorRef} />

                <label className={styles.nameField} htmlFor="new-spacecraft-name">
                  <span>Concept name</span>
                  <input
                    id="new-spacecraft-name"
                    ref={createNameRef}
                    value={draft.displayName}
                    autoComplete="off"
                    aria-invalid={Boolean(createError && nameError(draft.displayName))}
                    aria-describedby="new-spacecraft-name-help"
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, displayName: event.target.value }));
                      if (createError) setCreateError(null);
                    }}
                    placeholder="Example: Horizon Lantern"
                  />
                  <small id="new-spacecraft-name-help">1–80 characters · stored privately</small>
                </label>

                <fieldset className={styles.profilePicker}>
                  <legend>Comparison profile</legend>
                  {(Object.entries(PROFILE_DETAILS) as Array<
                    [SpacecraftProfile, (typeof PROFILE_DETAILS)[SpacecraftProfile]]
                  >).map(([profile, detail]) => (
                    <label key={profile} data-selected={draft.profile === profile}>
                      <input
                        type="radio"
                        name="new-spacecraft-profile"
                        value={profile}
                        checked={draft.profile === profile}
                        onChange={() => setDraft((current) => ({ ...current, profile }))}
                      />
                      <span>
                        <strong>{detail.label}</strong>
                        <small>{detail.assumption}</small>
                      </span>
                      {draft.profile === profile ? <Check size={17} aria-hidden="true" /> : null}
                    </label>
                  ))}
                </fieldset>

                <AppearanceFields
                  draft={draft}
                  idPrefix="new-spacecraft"
                  onChange={(appearance) => setDraft((current) => ({ ...current, appearance }))}
                />

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "create" ? (
                    <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                  ) : (
                    <Plus size={17} aria-hidden="true" />
                  )}
                  {pendingAction === "create" ? "Saving concept…" : "Save private concept"}
                </button>
              </form>
            </section>

            <section className={styles.collection} aria-labelledby="saved-concepts-title">
              <div className={styles.collectionHeading}>
                <div>
                  <span className={styles.stepNumber}>02</span>
                  <div>
                    <span className={styles.kicker}>Private collection</span>
                    <h3 id="saved-concepts-title">Saved concepts</h3>
                  </div>
                </div>
                <span className={styles.count} aria-label={`${records.length} saved concepts`}>
                  {records.length.toString().padStart(2, "0")}
                </span>
              </div>

              {records.length === 0 ? (
                <div className={styles.emptyState}>
                  <span aria-hidden="true">✦</span>
                  <h4>Your first concept starts on the left.</h4>
                  <p>
                    Choose a truthful comparison profile, give the idea a name, and save it to this
                    private collection.
                  </p>
                  <button type="button" onClick={() => createNameRef.current?.focus()}>
                    Start with a name <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className={styles.cardList}>
                  {records.map((record) => {
                    const isEditing = editing?.id === record.id;
                    const isConfirmingDelete = deleteId === record.id;
                    const isBusy = pendingAction?.endsWith(record.id) ?? false;
                    const editHasChanges =
                      isEditing && editing
                        ? normalizedName(editing.draft.displayName) !== record.displayName ||
                          !appearancesMatch(editing.draft.appearance, record.appearance)
                        : false;
                    return (
                      <article
                        className={styles.spacecraftCard}
                        key={record.id}
                        tabIndex={-1}
                        ref={(node) => {
                          if (node) recordRefs.current.set(record.id, node);
                          else recordRefs.current.delete(record.id);
                        }}
                      >
                        {isEditing && editing ? (
                          <form
                            className={styles.editForm}
                            onSubmit={(event) => void updateSpacecraft(event, record)}
                            noValidate
                          >
                            <div className={styles.editHeading}>
                              <div>
                                <span className={styles.kicker}>Editing concept</span>
                                <h4>{record.displayName}</h4>
                              </div>
                              <span>{PROFILE_DETAILS[record.profile].label}</span>
                            </div>
                            <CraftPreview
                              compact
                              appearance={editing.draft.appearance}
                              label={normalizedName(editing.draft.displayName) || "Unnamed craft"}
                            />
                            <div className={styles.truthBadge}>
                              <ShieldCheck size={15} aria-hidden="true" />
                              Personal concept · not a mission record
                            </div>
                            <ValidationSummary message={editError} summaryRef={editErrorRef} />
                            <label className={styles.nameField} htmlFor={`edit-name-${record.id}`}>
                              <span>Concept name</span>
                              <input
                                id={`edit-name-${record.id}`}
                                ref={editNameRef}
                                value={editing.draft.displayName}
                                autoComplete="off"
                                aria-invalid={Boolean(editError && nameError(editing.draft.displayName))}
                                onChange={(event) => {
                                  const displayName = event.target.value;
                                  setEditing((current) =>
                                    current ? { ...current, draft: { ...current.draft, displayName } } : current,
                                  );
                                  if (editError) setEditError(null);
                                }}
                              />
                            </label>
                            <AppearanceFields
                              draft={editing.draft}
                              idPrefix={`edit-${record.id}`}
                              onChange={(appearance) =>
                                setEditing((current) =>
                                  current ? { ...current, draft: { ...current.draft, appearance } } : current,
                                )
                              }
                            />
                            <p className={styles.immutableNote}>
                              The comparison profile stays fixed. Create a new craft to explore the
                              other profile without rewriting this concept’s history.
                            </p>
                            {!editHasChanges ? (
                              <p className={styles.noChangeNote} role="status">
                                Change the name or appearance before saving.
                              </p>
                            ) : null}
                            <div className={styles.formActions}>
                              <button
                                className={styles.primaryButton}
                                type="submit"
                                disabled={pendingAction !== null || !editHasChanges}
                              >
                                {isBusy ? (
                                  <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                                ) : (
                                  <Check size={17} aria-hidden="true" />
                                )}
                                {isBusy ? "Saving changes…" : "Save changes"}
                              </button>
                              <button
                                className={styles.textButton}
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() => cancelEditor(record.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <CraftPreview compact appearance={record.appearance} label={record.displayName} />
                            <div className={styles.cardBody}>
                              <div className={styles.truthBadge}>
                                <ShieldCheck size={15} aria-hidden="true" />
                                Personal concept · not a mission record
                              </div>
                              <span className={styles.modelEyebrow}>
                                {PROFILE_DETAILS[record.profile].eyebrow}
                              </span>
                              <h4>{record.displayName}</h4>
                              <p>{record.propulsion.summary}</p>
                              <dl className={styles.truthLedger}>
                                <div>
                                  <dt>Profile</dt>
                                  <dd>{record.propulsion.label}</dd>
                                </div>
                                <div>
                                  <dt>Vehicle status</dt>
                                  <dd>Not available</dd>
                                </div>
                                <div>
                                  <dt>Record status</dt>
                                  <dd>Not a mission</dd>
                                </div>
                                <div>
                                  <dt>Updated</dt>
                                  <dd>
                                    <time dateTime={new Date(record.updatedAtMs).toISOString()}>
                                      {formattedDate(record.updatedAtMs)}
                                    </time>
                                  </dd>
                                </div>
                              </dl>

                              {isConfirmingDelete ? (
                                <div
                                  className={styles.deleteConfirm}
                                  role="alertdialog"
                                  aria-labelledby={`delete-title-${record.id}`}
                                  aria-describedby={`delete-copy-${record.id}`}
                                  onKeyDown={(event) => {
                                    if (event.key !== "Escape" || pendingAction !== null) return;
                                    event.preventDefault();
                                    setDeleteId(null);
                                    window.requestAnimationFrame(() =>
                                      deleteTriggerRefs.current.get(record.id)?.focus(),
                                    );
                                  }}
                                >
                                  <div>
                                    <strong id={`delete-title-${record.id}`}>
                                      Remove this private concept?
                                    </strong>
                                    <span id={`delete-copy-${record.id}`}>This cannot be undone.</span>
                                  </div>
                                  <div>
                                    <button
                                      className={styles.dangerButton}
                                      type="button"
                                      disabled={pendingAction !== null}
                                      ref={(node) => {
                                        if (node) deleteConfirmRefs.current.set(record.id, node);
                                        else deleteConfirmRefs.current.delete(record.id);
                                      }}
                                      onClick={() => void deleteSpacecraft(record)}
                                    >
                                      {isBusy ? (
                                        <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />
                                      ) : (
                                        <Trash2 size={16} aria-hidden="true" />
                                      )}
                                      {isBusy ? "Removing…" : "Remove"}
                                    </button>
                                    <button
                                      className={styles.textButton}
                                      type="button"
                                      disabled={pendingAction !== null}
                                      onClick={() => {
                                        setDeleteId(null);
                                        window.requestAnimationFrame(() =>
                                          deleteTriggerRefs.current.get(record.id)?.focus(),
                                        );
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className={styles.cardActions}>
                                  <button
                                    className={styles.secondaryButton}
                                    type="button"
                                    disabled={pendingAction !== null}
                                    ref={(node) => {
                                      if (node) editTriggerRefs.current.set(record.id, node);
                                      else editTriggerRefs.current.delete(record.id);
                                    }}
                                    onClick={() => openEditor(record)}
                                  >
                                    <Pencil size={15} aria-hidden="true" /> Edit concept
                                  </button>
                                  <button
                                    className={styles.textButton}
                                    type="button"
                                    disabled={pendingAction !== null}
                                    ref={(node) => {
                                      if (node) deleteTriggerRefs.current.set(record.id, node);
                                      else deleteTriggerRefs.current.delete(record.id);
                                    }}
                                    onClick={() => openDeleteConfirmation(record.id)}
                                  >
                                    <Trash2 size={15} aria-hidden="true" /> Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </section>
      <RecordedEncountersHistory />
      <TourResumeSummary />
    </div>
  );
}
