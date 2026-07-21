import {
  createKerrZamoScreenRay,
  traceKerrNullGeodesic,
} from "./null-geodesic.js";
import {
  KerrReferenceTraceRequestSchema,
  assertKerrReferenceTraceRequestIntegrity,
  createKerrReferenceRayRecord,
  createKerrReferenceTraceReport,
  type KerrReferenceTraceReport,
  type KerrReferenceTraceRequest,
} from "./trace-contracts.js";

export interface TraceKerrReferenceLensMapInput {
  readonly request: unknown;
  readonly generatedAt: unknown;
  /** Declared only; this offline slice does not authenticate repository provenance. */
  readonly declaredCodeCommit: unknown;
}

export function kerrReferenceScreenCoordinate(
  request: KerrReferenceTraceRequest,
  pixelX: number,
  pixelY: number,
): { readonly screenX: number; readonly screenY: number } {
  const unitX = (2 * (pixelX + 0.5)) / request.grid.width - 1;
  const unitY = 1 - (2 * (pixelY + 0.5)) / request.grid.height;
  const tangent = Math.tan(
    (request.camera.verticalFieldOfViewDegrees * Math.PI) / 360,
  );
  return {
    screenX: unitX * (request.grid.width / request.grid.height) * tangent,
    screenY: unitY * tangent,
  };
}

function normalizedAzimuth(value: number): number {
  const wrapped = ((value % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

/**
 * Produces a neutral, hash-bound coordinate/mask report. It emits no image,
 * emission model, render manifest, validation token, or placeholder authority.
 */
export function traceKerrReferenceLensMap(
  input: TraceKerrReferenceLensMapInput,
): KerrReferenceTraceReport {
  const request = KerrReferenceTraceRequestSchema.parse(input.request);
  assertKerrReferenceTraceRequestIntegrity(request);
  const theta = (request.camera.inclinationDegrees * Math.PI) / 180;
  const phi = (request.camera.azimuthDegrees * Math.PI) / 180;
  const rays = [];
  let pixelIndex = 0;
  for (let pixelY = 0; pixelY < request.grid.height; pixelY += 1) {
    for (let pixelX = 0; pixelX < request.grid.width; pixelX += 1) {
      const screen = kerrReferenceScreenCoordinate(
        request,
        pixelX,
        pixelY,
      );
      const initialState = createKerrZamoScreenRay({
        spin: request.spin,
        radiusRg: request.camera.radiusRg,
        thetaRadians: theta,
        phiRadians: phi,
        screenX: screen.screenX,
        screenY: screen.screenY,
      });
      const trace = traceKerrNullGeodesic(initialState, {
        spin: request.spin,
        stepSize: request.integration.stepSize,
        maxSteps: request.integration.maxSteps,
        maxAffineParameter: request.integration.maxAffineParameter,
        horizonGuardRg: request.integration.horizonGuardRg,
        escapeRadiusRg: request.integration.escapeRadiusRg,
        thetaGuardRadians: request.integration.thetaGuardRadians,
      });
      const lensCoordinate =
        trace.termination === "captured-horizon-guard"
          ? {
              kind: "horizon-guard-coordinate" as const,
              thetaRadians: trace.finalState.theta,
              phiRadians: normalizedAzimuth(trace.finalState.phi),
            }
          : trace.termination === "escaped-domain"
            ? {
                kind: "finite-escape-domain-coordinate" as const,
                thetaRadians: trace.finalState.theta,
                phiRadians: normalizedAzimuth(trace.finalState.phi),
              }
            : { kind: "unresolved" as const };
      rays.push(
        createKerrReferenceRayRecord({
          request,
          pixelIndex,
          pixelX,
          pixelY,
          screenX: screen.screenX,
          screenY: screen.screenY,
          termination: trace.termination,
          terminationReason: trace.terminationReason,
          steps: trace.steps,
          affineParameter: trace.affineParameter,
          initialState: trace.initialState,
          finalState: trace.finalState,
          constants: trace.constants,
          diagnostics: trace.diagnostics,
          lensCoordinate,
        }),
      );
      pixelIndex += 1;
    }
  }
  return createKerrReferenceTraceReport({
    request,
    generatedAt: input.generatedAt,
    declaredCodeCommit: input.declaredCodeCommit,
    rays,
  });
}
