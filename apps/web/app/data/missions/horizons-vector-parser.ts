export type ParsedHorizonsVectorRow = {
  julianDateTdbLexical: string;
  julianDateTdb: number;
  calendarDateTdb: string;
  positionLexemes: readonly [string, string, string];
  velocityLexemes: readonly [string, string, string];
  positionAu: readonly [number, number, number];
  velocityAuPerDay: readonly [number, number, number];
};

export type ParsedHorizonsVectorArtifact = {
  apiVersion: string;
  targetName: string;
  targetNaifId: number;
  centerName: string;
  centerNaifId: number;
  solutionName: string;
  outputUnits: "AU-D";
  outputType: "GEOMETRIC cartesian states";
  outputFormat: "2 (position and velocity)";
  referenceFrame: "Ecliptic of J2000.0";
  referenceSystem: "ICRF";
  timeScale: "TDB";
  correction: "NONE";
  rows: readonly ParsedHorizonsVectorRow[];
};

function exactCapture(text: string, expression: RegExp, label: string): string {
  const matches = [...text.matchAll(expression)];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error(`Horizons artifact must declare exactly one ${label}`);
  }
  return matches[0][1].trim();
}

function parseFinite(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Horizons ${label} must be finite`);
  }
  return parsed;
}

function requireExactlyOne(text: string, expression: RegExp, label: string): void {
  if ((text.match(expression) ?? []).length !== 1) {
    throw new Error(`Horizons artifact must contain exactly one ${label}`);
  }
}

const calendarMonths = new Map(
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    .map((month, index) => [month, index + 1]),
);

function julianDateFromGregorianCalendar(label: string): number {
  const match = label.match(
    /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/,
  );
  if (!match) {
    throw new Error("Horizons calendar date must retain the reviewed Gregorian lexical form");
  }
  const calendarYear = Number(match[1]);
  const calendarMonth = calendarMonths.get(match[2]!);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    calendarMonth === undefined ||
    !Number.isInteger(calendarYear) ||
    day < 1 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    second < 0 || second >= 60
  ) {
    throw new Error("Horizons calendar date contains an invalid field");
  }
  const isLeapYear =
    calendarYear % 4 === 0 &&
    (calendarYear % 100 !== 0 || calendarYear % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day > daysInMonth[calendarMonth - 1]!) {
    throw new Error("Horizons calendar date contains an invalid field");
  }
  let year = calendarYear;
  let month = calendarMonth;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const century = Math.floor(year / 100);
  const gregorianCorrection = 2 - century + Math.floor(century / 4);
  const dayFraction = (hour + (minute + second / 60) / 60) / 24;
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    dayFraction +
    gregorianCorrection -
    1524.5
  );
}

const vectorRowPattern =
  /^(\d+\.\d+),\s*A\.D\.\s+([^,]+),\s*([+-]?\d+(?:\.\d+)?E[+-]\d+),\s*([+-]?\d+(?:\.\d+)?E[+-]\d+),\s*([+-]?\d+(?:\.\d+)?E[+-]\d+),\s*([+-]?\d+(?:\.\d+)?E[+-]\d+),\s*([+-]?\d+(?:\.\d+)?E[+-]\d+),\s*([+-]?\d+(?:\.\d+)?E[+-]\d+),\s*$/;

export function parseHorizonsVectorArtifact(
  text: string,
): ParsedHorizonsVectorArtifact {
  if (text.includes("\0")) {
    throw new Error("Horizons artifact cannot contain NUL bytes");
  }
  const startMarkers = text.match(/^\$\$SOE\s*$/gm) ?? [];
  const endMarkers = text.match(/^\$\$EOE\s*$/gm) ?? [];
  if (startMarkers.length !== 1 || endMarkers.length !== 1) {
    throw new Error("Horizons artifact must contain one exact SOE/EOE vector table");
  }
  const startIndex = text.indexOf("$$SOE");
  const endIndex = text.indexOf("$$EOE");
  if (endIndex <= startIndex) {
    throw new Error("Horizons vector table markers are reversed");
  }

  const apiVersion = exactCapture(text, /^API VERSION:\s*([^\r\n]+)$/gm, "API version");
  const target = exactCapture(
    text,
    /^Target body name:\s*([^\r\n]+)$/gm,
    "target body",
  );
  const center = exactCapture(
    text,
    /^Center body name:\s*([^\r\n]+)$/gm,
    "center body",
  );
  const targetMatch = target.match(/^(.+?)\s+\((-?\d+)\)\s+\{source:\s*([^}]+)\}$/);
  const centerMatch = center.match(/^(.+?)\s+\((-?\d+)\)\s+\{source:\s*([^}]+)\}$/);
  if (!targetMatch || !centerMatch) {
    throw new Error("Horizons target and center declarations must retain NAIF IDs and solution names");
  }
  if (targetMatch[3] !== centerMatch[3]) {
    throw new Error("Horizons target and center must disclose one consistent solution name");
  }
  const targetNaifId = Number(targetMatch[2]);
  const centerNaifId = Number(centerMatch[2]);
  if (!Number.isSafeInteger(targetNaifId) || !Number.isSafeInteger(centerNaifId)) {
    throw new Error("Horizons target and center NAIF IDs must be safe integers");
  }

  const outputUnits = exactCapture(text, /^Output units\s*:\s*([^\r\n]+)$/gm, "output units");
  const outputType = exactCapture(text, /^Output type\s*:\s*([^\r\n]+)$/gm, "output type");
  const outputFormat = exactCapture(text, /^Output format\s*:\s*([^\r\n]+)$/gm, "output format");
  const referenceFrame = exactCapture(text, /^Reference frame\s*:\s*([^\r\n]+)$/gm, "reference frame");
  if (outputUnits !== "AU-D") {
    throw new Error("Horizons vector artifact must use AU-D");
  }
  if (outputType !== "GEOMETRIC cartesian states") {
    throw new Error("Horizons vector artifact must contain geometric Cartesian states");
  }
  if (outputFormat !== "2 (position and velocity)") {
    throw new Error("Horizons vector artifact must contain position and velocity table 2");
  }
  if (referenceFrame !== "Ecliptic of J2000.0") {
    throw new Error("Horizons vector artifact must use the Ecliptic of J2000.0 frame");
  }
  requireExactlyOne(
    text,
    /^\s*JDTDB,\s*Calendar Date \(TDB\),\s*X,\s*Y,\s*Z,\s*VX,\s*VY,\s*VZ,\s*$/gm,
    "ordered JDTDB position/velocity column header",
  );
  requireExactlyOne(text, /^\s*X-axis\s*:\s*ICRF\s*$/gm, "ICRF X-axis declaration");
  requireExactlyOne(
    text,
    /^\s*JDTDB\s+Julian Day Number, Barycentric Dynamical Time\s*$/gm,
    "JDTDB symbol definition",
  );
  for (const component of ["X", "Y", "Z"] as const) {
    requireExactlyOne(
      text,
      new RegExp(`^\\s*${component}\\s+${component}-component of position vector \\(au\\)\\s*$`, "gm"),
      `${component} position definition`,
    );
  }
  for (const component of ["VX", "VY", "VZ"] as const) {
    const axis = component.slice(1);
    requireExactlyOne(
      text,
      new RegExp(`^\\s*${component}\\s+${axis}-component of velocity vector \\(au/day\\)\\s*$`, "gm"),
      `${component} velocity definition`,
    );
  }
  if (!/Barycentric Dynamical Time \("TDB" or T_eph\) output was requested\./.test(text)) {
    throw new Error("Horizons vector artifact must explicitly disclose TDB output");
  }
  if (!/Geometric state vectors have NO corrections or aberrations applied\./.test(text)) {
    throw new Error("Horizons vector artifact must explicitly disclose correction NONE");
  }

  const tableText = text.slice(startIndex + "$$SOE".length, endIndex);
  const lines = tableText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Horizons vector artifact needs at least two states");
  }

  const rows = lines.map((line, index): ParsedHorizonsVectorRow => {
    const match = line.match(vectorRowPattern);
    if (!match) {
      throw new Error(`Horizons vector row ${index + 1} is truncated or malformed`);
    }
    const [jd, calendar, x, y, z, vx, vy, vz] = match.slice(1) as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const julianDateTdb = parseFinite(jd, "Julian date");
    const calendarDateTdb = calendar.trim();
    if (Math.abs(julianDateFromGregorianCalendar(calendarDateTdb) - julianDateTdb) > 1e-9) {
      throw new Error(`Horizons vector row ${index + 1} calendar date does not match JDTDB`);
    }
    return {
      julianDateTdbLexical: jd,
      julianDateTdb,
      calendarDateTdb,
      positionLexemes: [x, y, z],
      velocityLexemes: [vx, vy, vz],
      positionAu: [
        parseFinite(x, "X component"),
        parseFinite(y, "Y component"),
        parseFinite(z, "Z component"),
      ],
      velocityAuPerDay: [
        parseFinite(vx, "VX component"),
        parseFinite(vy, "VY component"),
        parseFinite(vz, "VZ component"),
      ],
    };
  });

  const julianDates = rows.map((row) => row.julianDateTdb);
  if (
    new Set(julianDates).size !== julianDates.length ||
    julianDates.some((epoch, index) => index > 0 && epoch <= julianDates[index - 1]!)
  ) {
    throw new Error("Horizons vector epochs must be unique and strictly chronological");
  }

  return {
    apiVersion,
    targetName: targetMatch[1]!.trim(),
    targetNaifId,
    centerName: centerMatch[1]!.trim(),
    centerNaifId,
    solutionName: targetMatch[3]!.trim(),
    outputUnits: "AU-D",
    outputType: "GEOMETRIC cartesian states",
    outputFormat: "2 (position and velocity)",
    referenceFrame: "Ecliptic of J2000.0",
    referenceSystem: "ICRF",
    timeScale: "TDB",
    correction: "NONE",
    rows,
  };
}
