import {
  ArrowRight,
  Bookmark,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Shield,
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
  TOUR_RESUME_API_PATH,
  TOUR_RESUME_STOP_COUNT,
  canonicalTourResumeHref,
  parseTourResumeEnvelope,
  readTourResumeResponse,
  tourResumeSignInHref,
  type TourResumeRecord,
} from "@/app/lib/client/tour-resume";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";
import styles from "./TourResumeSummary.module.css";

type SummaryLoadState =
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

export function TourResumeSummary() {
  const returnTo = useSyncExternalStore(
    subscribeToCosmographyLocation,
    currentReturnTo,
    serverReturnTo,
  );
  const [loadState, setLoadState] = useState<SummaryLoadState>("loading");
  const [record, setRecord] = useState<TourResumeRecord | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  const loadResumePoint = useCallback(async (
    signal?: AbortSignal,
    userTriggered = false,
  ) => {
    try {
      const response = await fetch(TOUR_RESUME_API_PATH, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        setRecord(null);
        setLoadState("signed-out");
        if (userTriggered) {
          window.requestAnimationFrame(() => signInRef.current?.focus());
        }
        return;
      }
      if (response.status === 503) {
        setRecord(null);
        setLoadState("unavailable");
        if (userTriggered) {
          window.requestAnimationFrame(() => unavailableRef.current?.focus());
        }
        return;
      }
      const parsed = parseTourResumeEnvelope(
        await readTourResumeResponse(response),
      );
      if (!response.ok || !parsed.valid) {
        setRecord(null);
        setLoadState("error");
        if (userTriggered) {
          window.requestAnimationFrame(() => retryRef.current?.focus());
        }
        return;
      }
      setRecord(parsed.record);
      setLoadState("ready");
      if (userTriggered) {
        window.requestAnimationFrame(() => headingRef.current?.focus());
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setRecord(null);
      setLoadState("error");
      if (userTriggered) {
        window.requestAnimationFrame(() => retryRef.current?.focus());
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadResumePoint(controller.signal));
    return () => controller.abort();
  }, [loadResumePoint]);

  return (
    <section className={styles.section} aria-labelledby="tour-resume-summary-title">
      <div className={styles.heading}>
        <span className={styles.icon} aria-hidden="true">
          <Bookmark size={19} />
        </span>
        <div>
          <span className={styles.kicker}>Seven Scales · private navigation aid</span>
          <h2 id="tour-resume-summary-title" ref={headingRef} tabIndex={-1}>
            Saved tour resume point
          </h2>
        </div>
      </div>

      <div className={styles.boundary}>
        <Shield size={18} aria-hidden="true" />
        <p>
          This record remembers one literal place to reopen. It does not record which
          scales you viewed, change the release-pinned tour, or assess learning.
        </p>
      </div>

      {loadState === "loading" ? (
        <div className={styles.state} role="status">
          <LoaderCircle size={17} aria-hidden="true" />
          Opening your private saved point…
        </div>
      ) : null}

      {loadState === "ready" && record ? (
        <article className={styles.record}>
          <div>
            <span>Saved resume point</span>
            <h3>
              Scale {record.resume.ordinal} of {TOUR_RESUME_STOP_COUNT} ·{" "}
              {atlasScientificNameFor(
                record.resume.targetEntityId,
                record.resume.stopTitle,
              )}
            </h3>
            <p>
              Saved at{" "}
              <time dateTime={new Date(record.savedAtMs).toISOString()}>
                {formattedDate(record.savedAtMs)}
              </time>
            </p>
          </div>
          <Link href={record.resume.href}>
            Open saved scale
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </article>
      ) : null}

      {loadState === "ready" && !record ? (
        <div className={styles.emptyState}>
          <div>
            <strong>No saved tour resume point</strong>
            <span>Open the tour and explicitly save any scale for later.</span>
          </div>
          <Link href={canonicalTourResumeHref(1)}>
            Open Seven Scales
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {loadState === "signed-out" ? (
        <div className={styles.state}>
          <LockKeyhole size={17} aria-hidden="true" />
          <span>Sign in only if you want to see your private saved point.</span>
          <a ref={signInRef} href={tourResumeSignInHref(returnTo)}>
            Sign in with ChatGPT
          </a>
        </div>
      ) : null}

      {loadState === "unavailable" ? (
        <div className={styles.state} ref={unavailableRef} tabIndex={-1}>
          <CircleAlert size={17} aria-hidden="true" />
          <span>
            Private resume storage is unavailable. No browser copy is used.
          </span>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className={styles.state} role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>Your private saved point could not be opened.</span>
          <button
            ref={retryRef}
            type="button"
            onClick={() => {
              setLoadState("loading");
              void loadResumePoint(undefined, true);
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
