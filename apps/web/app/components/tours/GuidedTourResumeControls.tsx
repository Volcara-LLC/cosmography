import {
  ArrowRight,
  Bookmark,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
  FOUNDATION_TOUR_RESUME_RELEASE_ID,
  SEVEN_SCALES_TOUR_ID,
  TOUR_RESUME_API_PATH,
  TOUR_RESUME_STOP_COUNT,
  parseTourResumeEnvelope,
  readTourResumeResponse,
  tourResumeSignInHref,
  type TourResumeRecord,
} from "@/app/lib/client/tour-resume";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";
import styles from "./GuidedTourResumeControls.module.css";

type ResumeLoadState =
  | "loading"
  | "ready"
  | "reconcile"
  | "signed-out"
  | "unavailable"
  | "error";

function serverReturnTo(): string {
  return "/";
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

export function GuidedTourResumeControls({
  currentOrdinal,
  onResume,
}: {
  currentOrdinal: number;
  onResume: (ordinal: number) => void;
}) {
  const returnTo = useSyncExternalStore(
    subscribeToCosmographyLocation,
    currentReturnTo,
    serverReturnTo,
  );
  const [loadState, setLoadState] = useState<ResumeLoadState>("loading");
  const [record, setRecord] = useState<TourResumeRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "clear" | null>(
    null,
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [unavailableAfterAction, setUnavailableAfterAction] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const reconcileRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearConfirmRef = useRef<HTMLButtonElement>(null);

  const transitionForStatus = useCallback(
    (status: number, userTriggered: boolean) => {
      if (status === 401) {
        setConfirmClear(false);
        setUnavailableAfterAction(false);
        setLoadState("signed-out");
        setRecord(null);
        setAnnouncement(
          userTriggered
            ? "Your sign-in ended. Sign in to verify your private saved point."
            : "",
        );
        if (userTriggered) {
          window.requestAnimationFrame(() => signInRef.current?.focus());
        }
        return true;
      }
      if (status === 503) {
        setConfirmClear(false);
        setUnavailableAfterAction(userTriggered);
        setLoadState("unavailable");
        setRecord(null);
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

  const loadResumePoint = useCallback(
    async (signal?: AbortSignal, userTriggered = false) => {
      try {
        const response = await fetch(TOUR_RESUME_API_PATH, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        });
        if (transitionForStatus(response.status, userTriggered)) return;
        const parsed = parseTourResumeEnvelope(
          await readTourResumeResponse(response),
        );
        if (!response.ok || !parsed.valid) {
          setLoadState("error");
          if (userTriggered) {
            setAnnouncement(
              "The refreshed private record could not be confirmed. No browser copy was used.",
            );
            window.requestAnimationFrame(() => retryRef.current?.focus());
          }
          return;
        }
        setConfirmClear(false);
        setAnnouncement("");
        setRecord(parsed.record);
        setUnavailableAfterAction(false);
        setLoadState("ready");
        if (userTriggered) {
          window.requestAnimationFrame(() => headingRef.current?.focus());
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
        if (userTriggered) {
          setAnnouncement(
            "The refreshed private record could not be confirmed. No browser copy was used.",
          );
          window.requestAnimationFrame(() => retryRef.current?.focus());
        }
      }
    },
    [transitionForStatus],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadResumePoint(controller.signal));
    return () => controller.abort();
  }, [loadResumePoint]);

  function requireReconciliation(message: string) {
    setConfirmClear(false);
    setRecord(null);
    setLoadState("reconcile");
    setAnnouncement(message);
    window.requestAnimationFrame(() => reconcileRef.current?.focus());
  }

  async function saveCurrentScale() {
    setPendingAction("save");
    setAnnouncement("");
    try {
      const response = await fetch(TOUR_RESUME_API_PATH, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          tourId: SEVEN_SCALES_TOUR_ID,
          releaseId: FOUNDATION_TOUR_RESUME_RELEASE_ID,
          resumeOrdinal: currentOrdinal,
          expectedSavedAtMs: record?.savedAtMs ?? null,
        }),
      });
      if (transitionForStatus(response.status, true)) return;
      if (response.status === 409) {
        requireReconciliation(
          "Your saved point changed elsewhere. Reload it before saving again.",
        );
        return;
      }
      const parsed = parseTourResumeEnvelope(
        await readTourResumeResponse(response),
      );
      if (
        ![200, 201].includes(response.status) ||
        !parsed.valid ||
        !parsed.record ||
        parsed.record.resume.ordinal !== currentOrdinal
      ) {
        requireReconciliation(
          "The save result could not be confirmed. Reload your private record before trying again. No browser copy was created.",
        );
        return;
      }
      setRecord(parsed.record);
      setLoadState("ready");
      setAnnouncement(
        `Scale ${currentOrdinal} of ${TOUR_RESUME_STOP_COUNT} is now your private saved resume point.`,
      );
    } catch {
      requireReconciliation(
        "The save result could not be confirmed. Reload your private record before trying again. No browser copy was created.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function openClearConfirmation() {
    setConfirmClear(true);
    setAnnouncement("");
    window.requestAnimationFrame(() => clearConfirmRef.current?.focus());
  }

  function closeClearConfirmation() {
    setConfirmClear(false);
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus());
  }

  async function clearResumePoint() {
    if (!record) return;
    setPendingAction("clear");
    setAnnouncement("");
    try {
      const response = await fetch(TOUR_RESUME_API_PATH, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ expectedSavedAtMs: record.savedAtMs }),
      });
      if (transitionForStatus(response.status, true)) return;
      if (response.status === 409) {
        requireReconciliation(
          "Your saved point changed elsewhere. Reload it before clearing again.",
        );
        return;
      }
      const parsed = parseTourResumeEnvelope(
        await readTourResumeResponse(response),
      );
      if (response.status !== 200 || !parsed.valid || parsed.record !== null) {
        requireReconciliation(
          "The clear result could not be confirmed. Reload your private record before trying again. No browser copy was created.",
        );
        return;
      }
      setConfirmClear(false);
      setRecord(null);
      setLoadState("ready");
      setAnnouncement("Your private saved resume point was cleared.");
      window.requestAnimationFrame(() => saveRef.current?.focus());
    } catch {
      requireReconciliation(
        "The clear result could not be confirmed. Reload your private record before trying again. No browser copy was created.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="tour-resume-heading">
      <div className={styles.heading}>
        <Bookmark size={17} aria-hidden="true" />
        <div>
          <span>Private · user confirmed</span>
          <h2 id="tour-resume-heading" ref={headingRef} tabIndex={-1}>
            Saved resume point
          </h2>
        </div>
      </div>

      <p className={styles.boundary} id="tour-resume-boundary">
        Saving remembers only one scale to reopen later. It does not record other
        scales or assess what you learned. Next, Back, Evidence, and the transcript
        never save anything.
      </p>

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
        <div className={styles.inlineState} role="status">
          <LoaderCircle size={16} aria-hidden="true" />
          Opening your private saved point…
        </div>
      ) : null}

      {loadState === "ready" ? (
        <div className={styles.readyState}>
          {record ? (
            <div className={styles.savedPoint}>
              <div>
                <strong>
                  Scale {record.resume.ordinal} of {TOUR_RESUME_STOP_COUNT} ·{" "}
                  {atlasScientificNameFor(
                    record.resume.targetEntityId,
                    record.resume.stopTitle,
                  )}
                </strong>
                <span>
                  Saved{" "}
                  <time dateTime={new Date(record.savedAtMs).toISOString()}>
                    {formattedDate(record.savedAtMs)}
                  </time>
                </span>
              </div>
              <button
                className={styles.resumeButton}
                type="button"
                onClick={() => onResume(record.resume.ordinal)}
              >
                Resume saved scale
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className={styles.emptyState}>No private resume point is saved.</p>
          )}

          {confirmClear && record ? (
            <div
              className={styles.clearConfirm}
              role="group"
              data-confirmation-mode="inline-nonmodal"
              aria-labelledby="clear-tour-resume-title"
              aria-describedby="clear-tour-resume-copy"
              onKeyDown={(event) => {
                if (event.key !== "Escape" || pendingAction !== null) return;
                event.preventDefault();
                closeClearConfirmation();
              }}
            >
              <div>
                <strong id="clear-tour-resume-title">Clear this saved point?</strong>
                <span id="clear-tour-resume-copy">
                  The tour remains available from any scale.
                </span>
              </div>
              <div>
                <button
                  ref={clearConfirmRef}
                  className={styles.dangerButton}
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => void clearResumePoint()}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {pendingAction === "clear" ? "Clearing…" : "Clear saved point"}
                </button>
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={closeClearConfirmation}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <button
                ref={saveRef}
                className={styles.saveButton}
                type="button"
                aria-describedby="tour-resume-boundary"
                disabled={pendingAction !== null}
                onClick={() => void saveCurrentScale()}
              >
                <Bookmark size={15} aria-hidden="true" />
                {pendingAction === "save"
                  ? "Saving…"
                  : "Save this scale for later"}
              </button>
              {record ? (
                <button
                  ref={clearTriggerRef}
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={openClearConfirmation}
                >
                  Clear saved point
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {loadState === "signed-out" ? (
        <div className={styles.inlineState}>
          <LockKeyhole size={16} aria-hidden="true" />
          <span>Sign in only if you want a private saved resume point.</span>
          <a ref={signInRef} href={tourResumeSignInHref(returnTo)}>
            Sign in with ChatGPT
          </a>
        </div>
      ) : null}

      {loadState === "reconcile" ? (
        <div className={styles.inlineState}>
          <CircleAlert size={16} aria-hidden="true" />
          <span>
            Reload the private record before saving or clearing another point.
          </span>
          <button
            ref={reconcileRef}
            type="button"
            onClick={() => {
              setLoadState("loading");
              void loadResumePoint(undefined, true);
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reload private saved point
          </button>
        </div>
      ) : null}

      {loadState === "unavailable" ? (
        <div
          className={styles.inlineState}
          tabIndex={-1}
          ref={unavailableRef}
          role={unavailableAfterAction ? "status" : undefined}
          aria-live={unavailableAfterAction ? "polite" : undefined}
          aria-atomic={unavailableAfterAction ? "true" : undefined}
        >
          <CircleAlert size={16} aria-hidden="true" />
          <span>
            Private resume storage is unavailable. The tour still works, and no
            browser copy was created.
          </span>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className={styles.inlineState} role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>Your private saved point could not be opened.</span>
          <button
            ref={retryRef}
            type="button"
            onClick={() => {
              setLoadState("loading");
              void loadResumePoint(undefined, true);
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
