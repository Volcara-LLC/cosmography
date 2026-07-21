import {
  ArrowRight,
  BookOpenCheck,
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
  isRecordedEncounterClearAcknowledgement,
  isRecordedEncounterDeleteAcknowledgement,
  privateSignInHref,
  readResponsePayload,
  recordedEncountersFromEnvelope,
  type RecordedEncounter,
} from "@/app/lib/client/recorded-encounters";
import {
  currentReturnTo,
  subscribeToCosmographyLocation,
} from "@/app/lib/client/location";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";
import styles from "./RecordedEncountersHistory.module.css";

type HistoryLoadState =
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

export function RecordedEncountersHistory() {
  const returnTo = useSyncExternalStore(
    subscribeToCosmographyLocation,
    currentReturnTo,
    serverReturnTo,
  );
  const [loadState, setLoadState] = useState<HistoryLoadState>("loading");
  const [records, setRecords] = useState<RecordedEncounter[]>([]);
  const [confirmEntityId, setConfirmEntityId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [unavailableAfterAction, setUnavailableAfterAction] = useState(false);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const removeTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const removeConfirmRefs = useRef(new Map<string, HTMLButtonElement>());
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearConfirmRef = useRef<HTMLButtonElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);

  const transitionForStatus = useCallback(
    (status: number, userTriggered: boolean) => {
      if (status === 401) {
        setUnavailableAfterAction(false);
        setLoadState("signed-out");
        setRecords([]);
        setAnnouncement(
          userTriggered
            ? "Your sign-in ended. Your recorded encounters were not changed."
            : "Sign in to open your private recorded encounters.",
        );
        if (userTriggered) {
          window.requestAnimationFrame(() => signInRef.current?.focus());
        }
        return true;
      }
      if (status === 503) {
        setUnavailableAfterAction(userTriggered);
        setLoadState("unavailable");
        setRecords([]);
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

  const loadRecords = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch("/api/v1/me/discoveries", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        });
        if (transitionForStatus(response.status, false)) return;
        const payload = await readResponsePayload(response);
        const nextRecords = recordedEncountersFromEnvelope(payload);
        if (!response.ok || !nextRecords) {
          setLoadState("error");
          return;
        }
        setRecords(nextRecords);
        setUnavailableAfterAction(false);
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
    void fetch("/api/v1/me/discoveries", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({
        response,
        payload: await readResponsePayload(response),
      }))
      .then(({ response, payload }) => {
        if (transitionForStatus(response.status, false)) return;
        const nextRecords = recordedEncountersFromEnvelope(payload);
        if (!response.ok || !nextRecords) {
          setLoadState("error");
          return;
        }
        setRecords(nextRecords);
        setUnavailableAfterAction(false);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [transitionForStatus]);

  async function removeRecord(record: RecordedEncounter) {
    const presentationName = atlasScientificNameFor(
      record.entity.id,
      record.entity.name,
    );
    const recordIndex = records.findIndex(
      (candidate) => candidate.entity.id === record.entity.id,
    );
    setPendingAction(`remove:${record.entity.id}`);
    try {
      const response = await fetch(
        `/api/v1/me/discoveries/${encodeURIComponent(record.entity.id)}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      if (transitionForStatus(response.status, true)) return;
      const payload = await readResponsePayload(response);
      if (
        response.status !== 200 ||
        !isRecordedEncounterDeleteAcknowledgement(payload, record.entity.id)
      ) {
        setAnnouncement(
          `Removal of ${presentationName} could not be confirmed. Reload before trying again.`,
        );
        return;
      }
      const remaining = records.filter(
        (candidate) => candidate.entity.id !== record.entity.id,
      );
      setRecords(remaining);
      setConfirmEntityId(null);
      setAnnouncement(`${presentationName} was removed from your private recorded encounters.`);
      const nextRecord = remaining[Math.min(recordIndex, remaining.length - 1)];
      window.requestAnimationFrame(() => {
        if (nextRecord) cardRefs.current.get(nextRecord.entity.id)?.focus();
        else headingRef.current?.focus();
      });
    } catch {
      setAnnouncement(
        `Removal of ${presentationName} could not be confirmed. Reload before trying again.`,
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function clearRecords() {
    setPendingAction("clear");
    try {
      const response = await fetch("/api/v1/me/discoveries", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (transitionForStatus(response.status, true)) return;
      const payload = await readResponsePayload(response);
      if (
        response.status !== 200 ||
        !isRecordedEncounterClearAcknowledgement(payload)
      ) {
        setAnnouncement(
          "Clearing your recorded encounters could not be confirmed. Reload before trying again.",
        );
        return;
      }
      setRecords([]);
      setConfirmClear(false);
      setAnnouncement("Your private recorded encounters were cleared.");
      window.requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      setAnnouncement(
        "Clearing your recorded encounters could not be confirmed. Reload before trying again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="recorded-encounters-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Private history</span>
          <h2 id="recorded-encounters-title" tabIndex={-1} ref={headingRef}>
            Recorded encounters
          </h2>
        </div>
        <p>
          A private list of objects you explicitly chose to record. Counts are literal records,
          not a score or a claim about how much of the universe you have explored.
        </p>
      </div>

      <aside className={styles.truthBoundary} aria-label="Recorded encounter privacy boundary">
        <ShieldCheck size={21} aria-hidden="true" />
        <span>
          <strong>User-confirmed records only.</strong> Passive viewing and navigation never appear
          here. This history makes no scientific or completeness claim.
        </span>
      </aside>

      {announcement ? (
        <p className={styles.announcement} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <div className={styles.statePanel} role="status">
          <LoaderCircle className={styles.spinner} size={22} aria-hidden="true" />
          <div>
            <h3>Opening your private history…</h3>
            <p>Nothing is inferred from the atlas view.</p>
          </div>
        </div>
      ) : null}

      {loadState === "signed-out" ? (
        <div className={styles.statePanel}>
          <LockKeyhole size={22} aria-hidden="true" />
          <div>
            <h3>Sign in to open private records</h3>
            <p>The public atlas remains available without an account.</p>
            <a className={styles.primaryButton} ref={signInRef} href={privateSignInHref(returnTo)}>
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
            <h3>Private encounter storage is unavailable</h3>
            <p>
              {unavailableAfterAction
                ? "The change could not be confirmed. Reload before trying again. No browser copy was created."
                : "Try again later. No local or browser-storage history was created."}
            </p>
          </div>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className={styles.statePanel} role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h3>Your private history could not be opened</h3>
            <p>Check your connection, then try again.</p>
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
        <div className={styles.historyPanel}>
          <div className={styles.historyHeader}>
            <div>
              <BookOpenCheck size={20} aria-hidden="true" />
              <span>
                Private object records: <strong>{records.length}</strong>
              </span>
            </div>
            {records.length > 0 ? (
              <button
                className={styles.textButton}
                type="button"
                ref={clearTriggerRef}
                disabled={pendingAction !== null}
                onClick={() => {
                  setConfirmEntityId(null);
                  setConfirmClear(true);
                  window.requestAnimationFrame(() => clearConfirmRef.current?.focus());
                }}
              >
                <Trash2 size={15} aria-hidden="true" /> Clear all
              </button>
            ) : null}
          </div>

          {confirmClear ? (
            <div
              className={styles.confirmPanel}
              role="alertdialog"
              aria-labelledby="clear-encounters-title"
              aria-describedby="clear-encounters-copy"
              onKeyDown={(event) => {
                if (event.key !== "Escape" || pendingAction !== null) return;
                event.preventDefault();
                setConfirmClear(false);
                window.requestAnimationFrame(() => clearTriggerRef.current?.focus());
              }}
            >
              <div>
                <strong id="clear-encounters-title">Clear every private encounter record?</strong>
                <span id="clear-encounters-copy">This cannot be undone.</span>
              </div>
              <div>
                <button
                  className={styles.dangerButton}
                  type="button"
                  ref={clearConfirmRef}
                  disabled={pendingAction !== null}
                  onClick={() => void clearRecords()}
                >
                  {pendingAction === "clear" ? (
                    <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />
                  ) : (
                    <Trash2 size={16} aria-hidden="true" />
                  )}
                  {pendingAction === "clear" ? "Clearing…" : "Clear all records"}
                </button>
                <button
                  className={styles.textButton}
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => {
                    setConfirmClear(false);
                    window.requestAnimationFrame(() => clearTriggerRef.current?.focus());
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {records.length === 0 ? (
            <div className={styles.emptyState}>
              <BookOpenCheck size={28} aria-hidden="true" />
              <h3>No encounters recorded yet</h3>
              <p>Open an object’s Evidence panel and choose “Record this encounter.”</p>
              <Link href="/">
                Return to the interactive atlas <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className={styles.cardList}>
              {records.map((record) => {
                const isConfirming = confirmEntityId === record.entity.id;
                const isBusy = pendingAction === `remove:${record.entity.id}`;
                const presentationName = atlasScientificNameFor(
                  record.entity.id,
                  record.entity.name,
                );
                return (
                  <article
                    className={styles.card}
                    key={record.entity.id}
                    tabIndex={-1}
                    ref={(node) => {
                      if (node) cardRefs.current.set(record.entity.id, node);
                      else cardRefs.current.delete(record.entity.id);
                    }}
                  >
                    <div className={styles.cardTopline}>
                      <span>{record.entity.kind.replaceAll("-", " ")}</span>
                      <span>User confirmed</span>
                    </div>
                    <h3>{presentationName}</h3>
                    <dl>
                      <div>
                        <dt>First recorded</dt>
                        <dd>
                          <time dateTime={new Date(record.firstRecordedAtMs).toISOString()}>
                            {formattedDate(record.firstRecordedAtMs)}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>Most recent record</dt>
                        <dd>
                          <time dateTime={new Date(record.lastRecordedAtMs).toISOString()}>
                            {formattedDate(record.lastRecordedAtMs)}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>Encounter records</dt>
                        <dd>{record.recordCount}</dd>
                      </div>
                      <div>
                        <dt>First release</dt>
                        <dd>{record.firstReleaseId}</dd>
                      </div>
                    </dl>

                    {isConfirming ? (
                      <div
                        className={styles.confirmPanel}
                        role="alertdialog"
                        aria-labelledby={`remove-encounter-title-${record.entity.id}`}
                        aria-describedby={`remove-encounter-copy-${record.entity.id}`}
                        onKeyDown={(event) => {
                          if (event.key !== "Escape" || pendingAction !== null) return;
                          event.preventDefault();
                          setConfirmEntityId(null);
                          window.requestAnimationFrame(() =>
                            removeTriggerRefs.current.get(record.entity.id)?.focus(),
                          );
                        }}
                      >
                        <div>
                          <strong id={`remove-encounter-title-${record.entity.id}`}>
                            Remove {presentationName} from this private history?
                          </strong>
                          <span id={`remove-encounter-copy-${record.entity.id}`}>
                            The first and most recent timestamps, plus the record count for this
                            object, will be removed.
                          </span>
                        </div>
                        <div>
                          <button
                            className={styles.dangerButton}
                            type="button"
                            ref={(node) => {
                              if (node) removeConfirmRefs.current.set(record.entity.id, node);
                              else removeConfirmRefs.current.delete(record.entity.id);
                            }}
                            disabled={pendingAction !== null}
                            onClick={() => void removeRecord(record)}
                          >
                            {isBusy ? (
                              <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />
                            ) : (
                              <Trash2 size={16} aria-hidden="true" />
                            )}
                            {isBusy ? "Removing…" : "Remove record"}
                          </button>
                          <button
                            className={styles.textButton}
                            type="button"
                            disabled={pendingAction !== null}
                            onClick={() => {
                              setConfirmEntityId(null);
                              window.requestAnimationFrame(() =>
                                removeTriggerRefs.current.get(record.entity.id)?.focus(),
                              );
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.cardActions}>
                        <a href={record.entity.href}>
                          Open evidence-bound object <ArrowRight size={15} aria-hidden="true" />
                        </a>
                        <button
                          className={styles.textButton}
                          type="button"
                          ref={(node) => {
                            if (node) removeTriggerRefs.current.set(record.entity.id, node);
                            else removeTriggerRefs.current.delete(record.entity.id);
                          }}
                          disabled={pendingAction !== null}
                          onClick={() => {
                            setConfirmClear(false);
                            setConfirmEntityId(record.entity.id);
                            window.requestAnimationFrame(() =>
                              removeConfirmRefs.current.get(record.entity.id)?.focus(),
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
