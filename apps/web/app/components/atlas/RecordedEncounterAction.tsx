import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  privateSignInHref,
  readResponsePayload,
  recordedEncountersFromEnvelope,
  type RecordedEncounter,
} from "@/app/lib/client/recorded-encounters";
import {
  currentReturnTo,
  subscribeToCosmographyLocation,
} from "@/app/lib/client/location";
import styles from "./RecordedEncounterAction.module.css";

type EncounterLoadState =
  | "loading"
  | "ready"
  | "signed-out"
  | "unavailable"
  | "error";

function serverReturnTo(): string {
  return "/";
}

export function RecordedEncounterAction({
  entityId,
  entityName,
  releaseId,
}: {
  entityId: string;
  entityName: string;
  releaseId: string;
}) {
  const returnTo = useSyncExternalStore(
    subscribeToCosmographyLocation,
    currentReturnTo,
    serverReturnTo,
  );
  const [loadState, setLoadState] = useState<EncounterLoadState>("loading");
  const [record, setRecord] = useState<RecordedEncounter | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [unavailableAfterAction, setUnavailableAfterAction] = useState(false);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);

  const transitionForStatus = useCallback(
    (status: number, userTriggered: boolean) => {
      if (status === 401) {
        setUnavailableAfterAction(false);
        setLoadState("signed-out");
        setRecord(null);
        setAnnouncement(
          userTriggered
            ? "Your sign-in ended. This encounter was not recorded."
            : "Sign in to record encounters privately.",
        );
        if (userTriggered) {
          window.requestAnimationFrame(() => signInRef.current?.focus());
        }
        return true;
      }
      if (status === 503) {
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

  const loadRecord = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch("/api/v1/me/discoveries", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal,
        });
        if (transitionForStatus(response.status, false)) return;
        const payload = await readResponsePayload(response);
        const records = recordedEncountersFromEnvelope(payload);
        if (!response.ok || !records) {
          setLoadState("error");
          return;
        }
        setRecord(records.find((candidate) => candidate.entity.id === entityId) ?? null);
        setUnavailableAfterAction(false);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      }
    },
    [entityId, transitionForStatus],
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
        const records = recordedEncountersFromEnvelope(payload);
        if (!response.ok || !records) {
          setLoadState("error");
          return;
        }
        setRecord(
          records.find((candidate) => candidate.entity.id === entityId) ?? null,
        );
        setUnavailableAfterAction(false);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [entityId, transitionForStatus]);

  async function recordEncounter() {
    setPending(true);
    try {
      const response = await fetch("/api/v1/me/discoveries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ entityId, releaseId }),
      });
      if (transitionForStatus(response.status, true)) return;
      const payload = await readResponsePayload(response);
      const nextRecord = recordedEncountersFromEnvelope(payload)?.[0];
      if (
        ![200, 201].includes(response.status) ||
        !nextRecord ||
        nextRecord.entity.id !== entityId
      ) {
        setAnnouncement(
          response.status === 409
            ? "Your private history has reached its object limit. Remove an encounter in My Atlas before recording another."
            : "The result could not be confirmed. Check My Atlas before trying again. No browser copy was created.",
        );
        return;
      }
      setRecord(nextRecord);
      setLoadState("ready");
      setAnnouncement(
        nextRecord.recordCount === 1
          ? `${entityName} was added to your private recorded encounters.`
          : `A new encounter with ${entityName} was recorded privately.`,
      );
    } catch {
      setAnnouncement(
        "The result could not be confirmed. Check My Atlas before trying again. No browser copy was created.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="record-encounter-title">
      <div className={styles.heading}>
        <ShieldCheck size={19} aria-hidden="true" />
        <div>
          <span>Private · user confirmed</span>
          <h3 id="record-encounter-title">Record this encounter</h3>
        </div>
      </div>

      <p className={styles.boundary}>
        Only pressing the button creates a record. Viewing, selecting, or navigating to this
        object never records anything and never implies completion or scientific discovery.
      </p>

      {announcement ? (
        <p className={styles.announcement} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <div className={styles.inlineState} role="status">
          <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
          Checking your private records…
        </div>
      ) : null}

      {loadState === "ready" ? (
        <div className={styles.actionRow}>
          <div>
            {record ? (
              <>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>
                  Recorded encounter count for this object: <strong>{record.recordCount}</strong>
                </span>
              </>
            ) : (
              <span>No encounter with this object has been recorded in your private history.</span>
            )}
          </div>
          <button type="button" disabled={pending} onClick={() => void recordEncounter()}>
            {pending ? (
              <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            {pending
              ? "Recording…"
              : record
                ? "Record this encounter again"
                : "Record this encounter"}
          </button>
        </div>
      ) : null}

      {loadState === "signed-out" ? (
        <div className={styles.inlineState}>
          <LockKeyhole size={17} aria-hidden="true" />
          <span>Sign in only if you want to create a private record.</span>
          <a ref={signInRef} href={privateSignInHref(returnTo)}>
            Sign in with ChatGPT
          </a>
        </div>
      ) : null}

      {loadState === "unavailable" ? (
        <div
          className={styles.inlineState}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          ref={unavailableRef}
        >
          <CircleAlert size={17} aria-hidden="true" />
          {unavailableAfterAction
            ? "Private storage could not confirm this request. Check My Atlas before trying again. No browser copy was created."
            : "Private encounter storage is unavailable. No browser copy was created."}
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className={styles.inlineState} role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>Your private encounter record could not be opened.</span>
          <button
            type="button"
            onClick={() => {
              setLoadState("loading");
              void loadRecord();
            }}
          >
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : null}

      <a className={styles.historyLink} href="/me#recorded-encounters-title">
        Open recorded encounters in My Atlas
        <ArrowRight size={15} aria-hidden="true" />
      </a>
    </section>
  );
}
