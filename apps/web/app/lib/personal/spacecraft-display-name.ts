const CONTROL_OR_BIDI_PATTERN =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export type SpacecraftDisplayNameIssue = "forbidden-characters" | "invalid-length";

export function normalizeSpacecraftDisplayName(value: string): string {
  return value.normalize("NFC").trim();
}

export function spacecraftDisplayNameIssue(
  value: string,
): SpacecraftDisplayNameIssue | null {
  if (CONTROL_OR_BIDI_PATTERN.test(value)) return "forbidden-characters";
  const codePointLength = Array.from(normalizeSpacecraftDisplayName(value)).length;
  return codePointLength < 1 || codePointLength > 80 ? "invalid-length" : null;
}

export function isCanonicalSpacecraftDisplayName(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value === normalizeSpacecraftDisplayName(value) &&
    spacecraftDisplayNameIssue(value) === null
  );
}
