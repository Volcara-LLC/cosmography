import { deepFreeze, sha256Hex, stableStringify } from "./canonical";
import {
  FrozenRequestManifestSchema,
  type FrozenRequestManifest,
} from "./contracts";
import {
  assertQuarantineCaptureIntegrity,
  assertQuarantineValidationReportIntegrity,
} from "./quarantine";
import { getSourcePassport } from "./registry";
import {
  QuarantineCaptureSchema,
  QuarantineValidationReportSchema,
  type QuarantineCapture,
  type QuarantineValidationReport,
  type ValidationFinding,
} from "./runner-contracts";

export const RESPONSE_VALIDATOR_VERSION = "1.0.0";

function reportState(findings: readonly ValidationFinding[]) {
  if (findings.some((finding) => finding.outcome === "fail")) {
    return "rejected" as const;
  }
  if (findings.some((finding) => finding.outcome === "review-required")) {
    return "needs-review" as const;
  }
  return "accepted-basic" as const;
}

function canonicalFindings(
  findings: readonly ValidationFinding[],
): ValidationFinding[] {
  return findings
    .map((finding) => ({ ...finding }))
    .sort((left, right) =>
      [left.validator, left.code, left.outcome, left.message]
        .join("\u0000")
        .localeCompare(
          [right.validator, right.code, right.outcome, right.message].join(
            "\u0000",
          ),
        ),
    );
}

/** Only the canonical validator in this module can construct trusted reports. */
function createCanonicalValidationReport(input: {
  readonly manifest: FrozenRequestManifest;
  readonly capture: QuarantineCapture;
  readonly validatedAt: string;
  readonly findings: readonly ValidationFinding[];
}): QuarantineValidationReport {
  assertQuarantineCaptureIntegrity(input.manifest, input.capture);
  const findings = canonicalFindings(input.findings);
  const state = reportState(findings);
  const reportIdentity = {
    captureId: input.capture.captureId,
    captureChecksum: input.capture.captureChecksum,
    responseChecksum: input.capture.responseChecksum,
    validatedAt: input.validatedAt,
    findings,
  };
  const reportId = `qval_${sha256Hex(stableStringify(reportIdentity)).slice(
    0,
    24,
  )}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    reportId,
    releaseId: input.capture.releaseId,
    manifestId: input.manifest.manifestId,
    captureId: input.capture.captureId,
    sourceId: input.manifest.sourceId,
    policyVersion: input.capture.policyVersion,
    validatedAt: input.validatedAt,
    state,
    findings,
    captureChecksum: input.capture.captureChecksum,
    responseChecksum: input.capture.responseChecksum,
  };
  const report = QuarantineValidationReportSchema.parse({
    ...unsigned,
    reportChecksum: {
      algorithm: "sha256",
      value: sha256Hex(stableStringify(unsigned)),
      scope: "validation-report",
    },
  });
  assertQuarantineValidationReportIntegrity(
    input.manifest,
    input.capture,
    report,
  );
  return deepFreeze(report);
}

function finding(
  code: string,
  outcome: ValidationFinding["outcome"],
  severity: ValidationFinding["severity"],
  validator: string,
  message: string,
): ValidationFinding {
  return {
    code,
    outcome,
    severity,
    validator,
    validatorVersion: RESPONSE_VALIDATOR_VERSION,
    message,
  };
}

function normalizedMediaType(value: string | undefined): string | undefined {
  return value?.split(";", 1)[0]?.trim().toLowerCase() || undefined;
}

function mediaTypeMatches(actual: string, expected: readonly string[]): boolean {
  return expected
    .map((value) => normalizedMediaType(value))
    .filter((value): value is string => Boolean(value) && value !== "*/*")
    .some(
      (value) =>
        value === actual ||
        (value === "application/json" && actual.endsWith("+json")) ||
        ((value === "application/xml" || value === "text/xml") &&
          actual.endsWith("+xml")),
    );
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function parseJson(bytes: Uint8Array): unknown {
  const text = decodeUtf8(bytes);
  if (text === undefined) throw new Error("invalid-utf8");
  return JSON.parse(text);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function xmlTags(text: string, localName: string): string[] {
  const expression = new RegExp(
    `<(?:[A-Za-z_][A-Za-z0-9_.-]*:)?${localName}\\b[^>]*>`,
    "gi",
  );
  return text.match(expression) ?? [];
}

function xmlAttribute(tag: string, name: string): string | undefined {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return expression.exec(tag)?.[2];
}

function hasUnsafeXmlDeclaration(text: string): boolean {
  return /<!DOCTYPE\b|<!ENTITY\b/i.test(text);
}

function validateJsonEnvelope(
  bytes: Uint8Array,
  validator: string,
): { findings: ValidationFinding[]; parsed?: unknown } {
  try {
    const parsed = parseJson(bytes);
    return {
      findings: [
        finding(
          "json-syntax",
          "pass",
          "blocking",
          validator,
          "Response is valid UTF-8 JSON.",
        ),
      ],
      parsed,
    };
  } catch {
    return {
      findings: [
        finding(
          "json-syntax",
          "fail",
          "blocking",
          validator,
          "Response is not valid UTF-8 JSON.",
        ),
      ],
    };
  }
}

function sourceFindings(
  manifest: FrozenRequestManifest,
  bytes: Uint8Array,
): ValidationFinding[] {
  const kind = manifest.intent.kind;
  if (kind === "horizons") {
    const validation = validateJsonEnvelope(bytes, "jpl-horizons");
    const findings = [...validation.findings];
    const payload = recordValue(validation.parsed);
    findings.push(
      finding(
        "horizons-json-envelope",
        payload ? "pass" : "fail",
        "blocking",
        "jpl-horizons",
        payload
          ? "Horizons response is a JSON object."
          : "Horizons response is not a JSON object.",
      ),
    );
    const signature = recordValue(payload?.signature);
    const expectedVersion = manifest.intent.expectedSignatureVersion;
    findings.push(
      signature?.version === expectedVersion
        ? finding(
            "horizons-signature",
            "pass",
            "blocking",
            "jpl-horizons",
            "Horizons response signature matches the frozen expected version.",
          )
        : finding(
            "horizons-signature",
            "fail",
            "blocking",
            "jpl-horizons",
            "Horizons response signature does not match the frozen expected version.",
          ),
    );
    const hasError = payload?.error !== undefined && payload.error !== null;
    findings.push(
      finding(
        "horizons-domain-error",
        hasError ? "fail" : "pass",
        "blocking",
        "jpl-horizons",
        hasError
          ? "Horizons returned a domain-level error payload."
          : "Horizons did not return a domain-level error payload.",
      ),
    );
    return findings;
  }

  if (kind === "pds-search" || kind === "mast-invoke") {
    const validator = kind === "pds-search" ? "nasa-pds4" : "stsci-mast";
    const validation = validateJsonEnvelope(bytes, validator);
    const findings = [...validation.findings];
    const payload = recordValue(validation.parsed);
    findings.push(
      finding(
        `${kind}-json-envelope`,
        payload ? "pass" : "fail",
        "blocking",
        validator,
        payload
          ? "Archive response is a JSON object."
          : "Archive response is not a JSON object.",
      ),
    );
    const hasError =
      payload !== undefined &&
      (payload.error !== undefined ||
        (typeof payload.status === "string" &&
          ["error", "failed"].includes(payload.status.toLowerCase())));
    findings.push(
      finding(
        `${kind}-domain-error`,
        hasError ? "fail" : "pass",
        "blocking",
        validator,
        hasError
          ? "Archive returned a domain-level error payload."
          : "Archive did not return a domain-level error payload.",
      ),
    );
    findings.push(
      finding(
        `${kind}-schema-review`,
        "review-required",
        "review",
        validator,
        "Archive-specific scientific schema review is required before promotion.",
      ),
    );
    return findings;
  }

  if (kind === "tap") {
    const format = manifest.intent.format;
    if (format === "json") {
      const validation = validateJsonEnvelope(bytes, "ivoa-tap");
      const envelope = recordValue(validation.parsed) ??
        (Array.isArray(validation.parsed) ? validation.parsed : undefined);
      const payload = recordValue(validation.parsed);
      const hasError = Boolean(
        payload &&
          (payload.error !== undefined ||
            (typeof payload.status === "string" &&
              ["error", "failed"].includes(payload.status.toLowerCase()))),
      );
      return validation.findings.concat(
        finding(
          "tap-json-envelope",
          envelope ? "pass" : "fail",
          "blocking",
          "ivoa-tap",
          envelope
            ? "TAP response is a JSON object or array."
            : "TAP response is not a JSON object or array.",
        ),
        finding(
          "tap-domain-error",
          hasError ? "fail" : "pass",
          "blocking",
          "ivoa-tap",
          hasError
            ? "TAP returned a domain-level error payload."
            : "TAP did not return a domain-level error payload.",
        ),
        finding(
          "tap-schema-review",
          "review-required",
          "review",
          "ivoa-tap",
          "TAP column metadata, units, nulls, and row limits require scientific review.",
        ),
      );
    }
    if (format === "votable") {
      const text = decodeUtf8(bytes);
      const unsafeDeclaration = Boolean(text && hasUnsafeXmlDeclaration(text));
      const votable = Boolean(
        text &&
          !unsafeDeclaration &&
          !/<html\b/i.test(text) &&
          /^\s*(?:<\?xml\b[^>]*>\s*)?<VOTABLE\b/i.test(text),
      );
      const queryStatuses = (text ? xmlTags(text, "INFO") : [])
        .filter(
          (tag) => xmlAttribute(tag, "name")?.toUpperCase() === "QUERY_STATUS",
        )
        .map((tag) => xmlAttribute(tag, "value")?.toUpperCase());
      const queryError = queryStatuses.includes("ERROR");
      const queryOverflow = queryStatuses.includes("OVERFLOW");
      return [
        finding(
          "votable-envelope",
          votable ? "pass" : "fail",
          "blocking",
          "ivoa-tap",
          votable
            ? "Response contains a VOTable envelope."
            : "Response does not contain a valid VOTable envelope.",
        ),
        finding(
          "xml-declaration-safety",
          unsafeDeclaration ? "fail" : "pass",
          "blocking",
          "ivoa-tap",
          unsafeDeclaration
            ? "TAP XML contains a blocked DTD or entity declaration."
            : "TAP XML contains no DTD or entity declaration.",
        ),
        finding(
          "tap-query-status",
          queryError ? "fail" : "pass",
          "blocking",
          "ivoa-tap",
          queryError
            ? "TAP response declares QUERY_STATUS ERROR."
            : "TAP response does not declare QUERY_STATUS ERROR.",
        ),
        finding(
          "tap-query-overflow",
          queryOverflow ? "fail" : "pass",
          "blocking",
          "ivoa-tap",
          queryOverflow
            ? "TAP response declares QUERY_STATUS OVERFLOW."
            : "TAP response does not declare QUERY_STATUS OVERFLOW.",
        ),
        finding(
          "tap-schema-review",
          "review-required",
          "review",
          "ivoa-tap",
          "TAP fields, units, nulls, overflow status, and row limits require review.",
        ),
      ];
    }
    if (format === "fits") {
      const magic = decodeUtf8(bytes.subarray(0, Math.min(bytes.length, 9)));
      return [
        finding(
          "fits-envelope",
          magic?.startsWith("SIMPLE  =") ? "pass" : "fail",
          "blocking",
          "ivoa-tap",
          magic?.startsWith("SIMPLE  =")
            ? "Response begins with a FITS primary header."
            : "Response does not begin with a FITS primary header.",
        ),
        finding(
          "fits-sandbox-scan",
          "review-required",
          "review",
          "ivoa-tap",
          "FITS parsing and scientific validation must run in a dedicated sandbox.",
        ),
      ];
    }
    const text = decodeUtf8(bytes);
    const delimiter = format === "tsv" ? "\t" : ",";
    const tableLike = Boolean(
      text &&
        text.trim().length > 0 &&
        !/<html\b/i.test(text) &&
        (text.split(/\r?\n/, 1)[0] ?? "").includes(delimiter),
    );
    return [
      finding(
        "delimited-table-envelope",
        tableLike ? "pass" : "fail",
        "blocking",
        "ivoa-tap",
        tableLike
          ? "Response is non-empty UTF-8 delimited text."
          : "Response is not a valid delimited-table envelope.",
      ),
      finding(
        "tap-schema-review",
        "review-required",
        "review",
        "ivoa-tap",
        "TAP fields, units, nulls, and row limits require scientific review.",
      ),
    ];
  }

  if (kind === "ned-rest") {
    const text = decodeUtf8(bytes);
    const unsafeDeclaration = Boolean(text && hasUnsafeXmlDeclaration(text));
    const xml = Boolean(
      text &&
        !unsafeDeclaration &&
        !/<html\b/i.test(text) &&
        /^(?:\s*<\?xml\b[^>]*>)?\s*<[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s|>)/i.test(
          text,
        ),
    );
    const domainError = Boolean(
      text && (xmlTags(text, "error").length > 0 || xmlTags(text, "fault").length > 0),
    );
    return [
      finding(
        "ned-xml-envelope",
        xml ? "pass" : "fail",
        "blocking",
        "nasa-ned",
        xml ? "NED response is XML." : "NED response is not XML.",
      ),
      finding(
        "xml-declaration-safety",
        unsafeDeclaration ? "fail" : "pass",
        "blocking",
        "nasa-ned",
        unsafeDeclaration
          ? "NED XML contains a blocked DTD or entity declaration."
          : "NED XML contains no DTD or entity declaration.",
      ),
      finding(
        "ned-domain-error",
        domainError ? "fail" : "pass",
        "blocking",
        "nasa-ned",
        domainError
          ? "NED returned a domain-level error payload."
          : "NED did not return a domain-level error payload.",
      ),
      finding(
        "ned-schema-review",
        "review-required",
        "review",
        "nasa-ned",
        "NED identifiers, measurements, references, and release lineage require review.",
      ),
    ];
  }

  if (kind === "http-artifact") {
    return [
      finding(
        "artifact-sandbox-scan",
        "review-required",
        "review",
        "binary-artifact",
        "Binary artifacts require malware, archive, format, rights, and scientific validation.",
      ),
    ];
  }

  return [
    finding(
      "source-validator-missing",
      "fail",
      "blocking",
      "connector-runner",
      "No approved source-response validator exists for this manifest intent.",
    ),
  ];
}

export function validateQuarantinedResponse(input: {
  readonly manifest: unknown;
  readonly capture: unknown;
  readonly bytes: Uint8Array;
  readonly validatedAt: string;
}): QuarantineValidationReport {
  const manifest = FrozenRequestManifestSchema.parse(input.manifest);
  const capture = QuarantineCaptureSchema.parse(input.capture);
  assertQuarantineCaptureIntegrity(manifest, capture);
  const findings: ValidationFinding[] = [];

  const actualSha = sha256Hex(input.bytes);
  findings.push(
    finding(
      "validator-input-checksum",
      actualSha === capture.responseChecksum.value ? "pass" : "fail",
      "blocking",
      "generic-http",
      actualSha === capture.responseChecksum.value
        ? "Validator input matches the immutable response checksum."
        : "Validator input does not match the immutable response checksum.",
    ),
  );
  findings.push(
    finding(
      "validator-input-length",
      input.bytes.byteLength === capture.wireByteLength ? "pass" : "fail",
      "blocking",
      "generic-http",
      input.bytes.byteLength === capture.wireByteLength
        ? "Validator input matches the captured wire-byte length."
        : "Validator input does not match the captured wire-byte length.",
    ),
  );

  const statusAccepted = capture.httpStatus === 200;
  findings.push(
    finding(
      "http-status",
      statusAccepted ? "pass" : "fail",
      "blocking",
      "generic-http",
      statusAccepted
        ? "HTTP status is the complete-response status 200."
        : "HTTP status is not the complete-response status 200.",
    ),
  );

  const contentEncoding = capture.responseHeaders.contentEncoding?.toLowerCase();
  const uncompressed = !contentEncoding || contentEncoding === "identity";
  findings.push(
    finding(
      "content-encoding",
      uncompressed ? "pass" : "fail",
      "blocking",
      "generic-http",
      uncompressed
        ? "Response is uncompressed under the foundation policy."
        : "Compressed responses are blocked by the foundation policy.",
    ),
  );

  const completeResponse = capture.responseHeaders.contentRange === undefined;
  findings.push(
    finding(
      "content-range",
      completeResponse ? "pass" : "fail",
      "blocking",
      "generic-http",
      completeResponse
        ? "Response does not declare partial content."
        : "Partial-content responses are blocked by the foundation policy.",
    ),
  );

  const actualMediaType = normalizedMediaType(capture.responseHeaders.contentType);
  const expectedMediaTypes =
    manifest.request.kind === "http" ? manifest.request.expectedMediaTypes : [];
  const mediaAccepted = Boolean(
    actualMediaType && mediaTypeMatches(actualMediaType, expectedMediaTypes),
  );
  findings.push(
    finding(
      "media-type",
      mediaAccepted ? "pass" : "fail",
      "blocking",
      "generic-http",
      mediaAccepted
        ? "Response media type matches the frozen request manifest."
        : "Response media type does not match the frozen request manifest.",
    ),
  );

  const declaredLengthRaw = capture.responseHeaders.contentLengthRaw;
  const declaredLength = capture.responseHeaders.contentLength;
  const lengthHeaderValid =
    declaredLengthRaw === undefined || declaredLength !== undefined;
  const lengthAccepted =
    lengthHeaderValid &&
    (declaredLength === undefined || declaredLength === capture.wireByteLength);
  findings.push(
    finding(
      "content-length",
      lengthAccepted ? "pass" : "fail",
      "blocking",
      "generic-http",
      lengthAccepted
        ? "Declared and captured response lengths are consistent."
        : "Declared and captured response lengths differ.",
    ),
  );

  if (manifest.expectedResponseChecksum) {
    const checksumAccepted =
      manifest.expectedResponseChecksum.value === capture.responseChecksum.value;
    findings.push(
      finding(
        "expected-response-checksum",
        checksumAccepted ? "pass" : "fail",
        "blocking",
        "generic-http",
        checksumAccepted
          ? "Response bytes match the frozen expected checksum."
          : "Response bytes do not match the frozen expected checksum.",
      ),
    );
  }

  const safeToInspect =
    actualSha === capture.responseChecksum.value &&
      input.bytes.byteLength === capture.wireByteLength &&
      statusAccepted &&
      uncompressed &&
      mediaAccepted &&
      lengthAccepted &&
      completeResponse;
  if (safeToInspect) {
    findings.push(...sourceFindings(manifest, input.bytes));
  } else {
    findings.push(
      finding(
        "source-validation-skipped",
        "fail",
        "blocking",
        "connector-runner",
        "Source-specific validation was skipped because a generic safety gate failed.",
      ),
    );
  }

  const passport = getSourcePassport(manifest.sourceId);
  if (passport.rights.reviewBeforePublication) {
    findings.push(
      finding(
        "publication-rights-review",
        "review-required",
        "review",
        "rights-policy",
        "Source and asset rights require review before release promotion.",
      ),
    );
  }

  return createCanonicalValidationReport({
    manifest,
    capture,
    validatedAt: input.validatedAt,
    findings,
  });
}

export function responseValidationInputs(
  manifest: FrozenRequestManifest,
  capture: QuarantineCapture,
) {
  assertQuarantineCaptureIntegrity(manifest, capture);
  return { manifest, capture } as const;
}
