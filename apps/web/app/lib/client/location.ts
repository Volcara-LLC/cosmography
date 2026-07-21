export const COSMOGRAPHY_LOCATION_CHANGE_EVENT =
  "cosmography:locationchange" as const;

export function notifyCosmographyLocationChange(): void {
  window.dispatchEvent(new Event(COSMOGRAPHY_LOCATION_CHANGE_EVENT));
}

export function subscribeToCosmographyLocation(
  onChange: () => void,
): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener(COSMOGRAPHY_LOCATION_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(COSMOGRAPHY_LOCATION_CHANGE_EVENT, onChange);
  };
}

export function currentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
