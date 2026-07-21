import {
  ArrowRight,
  Bookmark,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  currentReturnTo,
  subscribeToCosmographyLocation,
} from "@/app/lib/client/location";
import {
  SAVED_PLACES_API_PATH,
  isSavedPlaceDeleteAcknowledgement,
  personalStorageSignInHref,
  readPersonalStorageResponse,
  savedPlacesFromEnvelope,
} from "@/app/lib/client/personal-storage";
import {
  createSavedPlaceHref,
  savedPlaceIdentityFor,
  type SavedPlaceRecord,
} from "@/app/lib/personal/saved-place-foundation";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";
import styles from "./SavedPlaces.module.css";

type SavedPlacesLoadState =
  | "loading"
  | "ready"
  | "signed-out"
  | "unavailable"
  | "error";

function serverReturnTo(): string {
  return "/me";
}

function formattedDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function appearanceLabel(record: SavedPlaceRecord): string {
  return record.scene.appearance === "scientific"
    ? "Scientific appearance"
    : "Immersive appearance";
}

const foundationAtlasEntry = savedPlaceIdentityFor("observable-universe");
if (!foundationAtlasEntry) {
  throw new Error("The foundation saved-place entry is unavailable");
}
const foundationAtlasHref = createSavedPlaceHref(
  foundationAtlasEntry.slug,
  "scientific",
);

export function SavedPlaces() {
  const returnTo = useSyncExternalStore(
    subscribeToCosmographyLocation,
    currentReturnTo,
    serverReturnTo,
  );
  const [loadState, setLoadState] =
    useState<SavedPlacesLoadState>("loading");
  const [records, setRecords] = useState<SavedPlaceRecord[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [requiresReload, setRequiresReload] = useState(false);
  const [unavailableAfterAction, setUnavailableAfterAction] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const reloadRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const removeTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const removeConfirmRefs = useRef(new Map<string, HTMLButtonElement>());

  const transitionForStatus = useCallback(
    (status: number, userTriggered: boolean) => {
      if (status === 401) {
        setRecords([]);
        setConfirmId(null);
        setRequiresReload(false);
        setUnavailableAfterAction(false);
        setLoadState("signed-out");
        setAnnouncement(
          userTriggered
            ? "Your sign-in ended. The saved-place change was not confirmed."
            : "Sign in to open your private saved places.",
        );
        if (userTriggered) {
          window.requestAnimationFrame(() => signInRef.current?.focus());
        }
        return true;
      }
      if (status === 503) {
        setRecords([]);
        setConfirmId(null);
        setRequiresReload(false);
        setUnavailableAfterAction(userTriggered);
        setLoadState("unavailable");
        setAnnouncement("");
        if (userTriggered) {
          window.requestAnimationFrame(() => unavailableRef.current?.focus());
        }
        return true;
      }
      return false;
    },
    [],
  );

  const loadPlaces = useCallback(
    async (signal?: AbortSignal, userTriggered = false) => {
      try {
        const response = await fetch(SAVED_PLACES_API_PATH, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        });
        if (transitionForStatus(response.status, userTriggered)) return;
        const nextRecords = savedPlacesFromEnvelope(
          await readPersonalStorageResponse(response),
        );
        if (!response.ok || !nextRecords) {
          setRecords([]);
          setLoadState("error");
          if (userTriggered) {
            window.requestAnimationFrame(() => retryRef.current?.focus());
          }
          return;
        }
        setRecords(nextRecords);
        setConfirmId(null);
        setRequiresReload(false);
        setUnavailableAfterAction(false);
        setAnnouncement("");
        setLoadState("ready");
        if (userTriggered) {
          window.requestAnimationFrame(() => headingRef.current?.focus());
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRecords([]);
        setLoadState("error");
        if (userTriggered) {
          window.requestAnimationFrame(() => retryRef.current?.focus());
        }
      }
    },
    [transitionForStatus],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadPlaces(controller.signal));
    return () => controller.abort();
  }, [loadPlaces]);

  function requireReload(message: string) {
    setConfirmId(null);
    setRequiresReload(true);
    setAnnouncement(message);
    window.requestAnimationFrame(() => reloadRef.current?.focus());
  }

  async function removePlace(record: SavedPlaceRecord) {
    const presentationName = atlasScientificNameFor(
      record.entity.id,
      record.entity.name,
    );
    const recordIndex = records.findIndex((candidate) => candidate.id === record.id);
    setPendingId(record.id);
    try {
      const response = await fetch(SAVED_PLACES_API_PATH, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          id: record.id,
          expectedSavedAtMs: record.savedAtMs,
        }),
      });
      if (transitionForStatus(response.status, true)) return;
      const payload = await readPersonalStorageResponse(response);
      if (
        response.status !== 200 ||
        !isSavedPlaceDeleteAcknowledgement(payload, record.id)
      ) {
        requireReload(
          `Removal of ${presentationName} could not be confirmed. Reload saved places before trying again.`,
        );
        return;
      }

      const remaining = records.filter((candidate) => candidate.id !== record.id);
      setRecords(remaining);
      setConfirmId(null);
      setAnnouncement(`${presentationName} was removed from your private saved places.`);
      const nextRecord = remaining[Math.min(recordIndex, remaining.length - 1)];
      window.requestAnimationFrame(() => {
        if (nextRecord) cardRefs.current.get(nextRecord.id)?.focus();
        else headingRef.current?.focus();
      });
    } catch {
      requireReload(
        `Removal of ${presentationName} could not be confirmed. Reload saved places before trying again.`,
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      className={styles.section}
      id="saved-places"
      aria-labelledby="saved-places-title"
    >
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Private navigation</span>
          <h2 id="saved-places-title" tabIndex={-1} ref={headingRef}>
            Saved places
          </h2>
        </div>
        <p>
          Reopen destinations you explicitly saved with their exact foundation
          release, appearance, and fixed scene-time context.
        </p>
      </div>

      <aside className={styles.truthBoundary} aria-label="Saved-place truth boundary">
        <ShieldCheck size={21} aria-hidden="true" />
        <span>
          <strong>Navigation aids only.</strong> A saved place is not a camera pose,
          observation, encounter, route, progress record, achievement, or discovery.
          Passive viewing never creates one.
        </span>
      </aside>

      {announcement ? (
        <p
          className={styles.announcement}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <div className={styles.statePanel} role="status">
          <LoaderCircle className={styles.spinner} size={22} aria-hidden="true" />
          <div>
            <h3>Opening your private saved places…</h3>
            <p>Nothing is saved by loading or viewing this page.</p>
          </div>
        </div>
      ) : null}

      {loadState === "signed-out" ? (
        <div className={styles.statePanel}>
          <LockKeyhole size={22} aria-hidden="true" />
          <div>
            <h3>Sign in to open saved places</h3>
            <p>The public atlas remains available without an account.</p>
            <a
              className={styles.primaryButton}
              ref={signInRef}
              href={personalStorageSignInHref(returnTo)}
            >
              Sign in with ChatGPT <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}

      {loadState === "unavailable" ? (
        <div
          className={styles.statePanel}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          ref={unavailableRef}
        >
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <h3>Private saved-place storage is unavailable</h3>
            <p>
              {unavailableAfterAction
                ? "The removal could not be confirmed. Reload later before trying again. No browser copy was created."
                : "Try again later. No browser copy was created."}
            </p>
          </div>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className={styles.statePanel} role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h3>Your saved places could not be opened</h3>
            <p>The response was not trusted. Check your connection, then try again.</p>
            <button
              className={styles.secondaryButton}
              ref={retryRef}
              type="button"
              onClick={() => {
                setLoadState("loading");
                void loadPlaces(undefined, true);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : null}

      {loadState === "ready" ? (
        <div className={styles.collection}>
          <div className={styles.collectionHeader}>
            <div>
              <Bookmark size={20} aria-hidden="true" />
              <span>
                Private saved places: <strong>{records.length}</strong>
              </span>
            </div>
            <span>Exact release · no cross-release fallback</span>
          </div>

          {requiresReload ? (
            <div className={styles.reconcilePanel} role="alert">
              <CircleAlert size={19} aria-hidden="true" />
              <div>
                <strong>Reload before changing saved places</strong>
                <span>
                  The last removal was not confirmed, so the existing list remains
                  visible without claiming that it changed.
                </span>
              </div>
              <button
                type="button"
                ref={reloadRef}
                onClick={() => {
                  setLoadState("loading");
                  void loadPlaces(undefined, true);
                }}
              >
                <RotateCcw size={15} aria-hidden="true" /> Reload saved places
              </button>
            </div>
          ) : null}

          {records.length === 0 ? (
            <div className={styles.emptyState}>
              <Bookmark size={29} aria-hidden="true" />
              <h3>No saved places yet</h3>
              <p>
                Open an exact-release atlas destination and choose “Save place.”
              </p>
              <Link href={foundationAtlasHref}>
                Open the foundation atlas <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className={styles.cardList}>
              {records.map((record) => {
                const isConfirming = confirmId === record.id;
                const isBusy = pendingId === record.id;
                const presentationName = atlasScientificNameFor(
                  record.entity.id,
                  record.entity.name,
                );
                return (
                  <article
                    className={styles.card}
                    key={record.id}
                    tabIndex={-1}
                    ref={(node) => {
                      if (node) cardRefs.current.set(record.id, node);
                      else cardRefs.current.delete(record.id);
                    }}
                  >
                    <div className={styles.cardTopline}>
                      <span>{record.entity.kind.replaceAll("-", " ")}</span>
                      <span>{appearanceLabel(record)}</span>
                    </div>
                    <h3>{presentationName}</h3>
                    <p className={styles.sceneNote}>
                      Reopens the selected destination—not a stored physical camera pose.
                    </p>
                    <dl>
                      <div>
                        <dt>Saved</dt>
                        <dd>
                          <time dateTime={new Date(record.savedAtMs).toISOString()}>
                            {formattedDate(record.savedAtMs)}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>Scene context</dt>
                        <dd>{record.scene.timelineYear} · fixed</dd>
                      </div>
                      <div>
                        <dt>Renderer domain</dt>
                        <dd>{record.entity.domain}</dd>
                      </div>
                      <div>
                        <dt>Release</dt>
                        <dd>{record.scene.releaseId}</dd>
                      </div>
                    </dl>

                    {isConfirming ? (
                      <div
                        className={styles.confirmPanel}
                        role="alertdialog"
                        data-confirmation-mode="inline-nonmodal"
                        aria-labelledby={`remove-place-title-${record.id}`}
                        aria-describedby={`remove-place-copy-${record.id}`}
                        onKeyDown={(event) => {
                          if (event.key !== "Escape" || pendingId !== null) return;
                          event.preventDefault();
                          setConfirmId(null);
                          window.requestAnimationFrame(() =>
                            removeTriggerRefs.current.get(record.id)?.focus(),
                          );
                        }}
                      >
                        <div>
                          <strong id={`remove-place-title-${record.id}`}>
                            Remove {presentationName} from saved places?
                          </strong>
                          <span id={`remove-place-copy-${record.id}`}>
                            This removes only the private navigation aid. Other My Atlas
                            records are unchanged.
                          </span>
                        </div>
                        <div>
                          <button
                            className={styles.dangerButton}
                            type="button"
                            ref={(node) => {
                              if (node) removeConfirmRefs.current.set(record.id, node);
                              else removeConfirmRefs.current.delete(record.id);
                            }}
                            disabled={pendingId !== null}
                            aria-busy={isBusy}
                            onClick={() => void removePlace(record)}
                          >
                            {isBusy ? (
                              <LoaderCircle
                                className={styles.spinner}
                                size={16}
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 size={16} aria-hidden="true" />
                            )}
                            {isBusy ? "Removing…" : "Remove saved place"}
                          </button>
                          <button
                            className={styles.textButton}
                            type="button"
                            disabled={pendingId !== null}
                            onClick={() => {
                              setConfirmId(null);
                              window.requestAnimationFrame(() =>
                                removeTriggerRefs.current.get(record.id)?.focus(),
                              );
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.cardActions}>
                        <Link href={record.href}>
                          Reopen saved place <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                        <button
                          className={styles.textButton}
                          type="button"
                          ref={(node) => {
                            if (node) removeTriggerRefs.current.set(record.id, node);
                            else removeTriggerRefs.current.delete(record.id);
                          }}
                          disabled={pendingId !== null || requiresReload}
                          onClick={() => {
                            setConfirmId(record.id);
                            window.requestAnimationFrame(() =>
                              removeConfirmRefs.current.get(record.id)?.focus(),
                            );
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" /> Remove
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
