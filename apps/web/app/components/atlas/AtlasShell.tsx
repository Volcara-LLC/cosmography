"use client";

import Link from "next/link";
import {
  Accessibility,
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronRight,
  Compass,
  Database,
  Eye,
  Layers3,
  MapPin,
  Maximize2,
  Minimize2,
  Orbit,
  Pause,
  Play,
  Route,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  atlasEntities,
  atlasRelease,
  defaultEntity,
  missionAgencies,
} from "@/app/data/atlas";
import { foundationProjectedLabelsForSelection } from "@/app/data/labels/foundation-projected-labels";
import type { TravelModeId } from "@/app/lib/navigation/travel";
import type { AtlasEntity } from "@/app/lib/science/scene";
import {
  atlasScientificBreadcrumbLabel,
  atlasScientificNameFor,
  atlasScientificPresentationFor,
} from "@/app/lib/presentation/atlas-scientific-labels";
import { UniverseViewport } from "@/app/components/universe/UniverseViewport";
import type { RenderProfileRequest } from "@/app/components/universe/performance";
import type { RendererDiagnostics } from "@/app/components/universe/runtime/createUniverseRenderer";
import { atlasVisualThemeFor } from "@/app/components/atlas/theme";
import type { GuidedTour } from "@/app/lib/education/guided-tour";
import { notifyCosmographyLocationChange } from "@/app/lib/client/location";
import type { MarsAtlasSceneHandle } from "@/app/components/atlas/MarsAtlasScene";
import type { AtlasOverviewSection } from "@/app/components/atlas/AtlasDomainOverview";

const GuidedTourExperience = lazy(() =>
  import("@/app/components/tours/GuidedTourExperience").then((module) => ({
    default: module.GuidedTourExperience,
  })),
);

const AtlasDetailPanel = lazy(() =>
  import("@/app/components/atlas/AtlasDetailPanel").then((module) => ({
    default: module.AtlasDetailPanel,
  })),
);

const MarsAtlasScene = lazy(() =>
  import("@/app/components/atlas/MarsAtlasScene").then((module) => ({
    default: module.MarsAtlasScene,
  })),
);

const SolarSystemAtlasScene = lazy(() =>
  import("@/app/components/atlas/SolarSystemAtlasScene").then((module) => ({
    default: module.SolarSystemAtlasScene,
  })),
);

const EarthNetworkAtlasScene = lazy(() =>
  import("@/app/components/atlas/EarthNetworkAtlasScene").then((module) => ({
    default: module.EarthNetworkAtlasScene,
  })),
);

const AtlasDomainOverview = lazy(() =>
  import("@/app/components/atlas/AtlasDomainOverview").then((module) => ({
    default: module.AtlasDomainOverview,
  })),
);

type Panel = "layers" | "evidence" | "route" | null;
type LayerKey = "catalogs" | "observations" | "missions" | "coverage";
type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "signed-out"
  | "unavailable"
  | "error";

const sectionNavigation = {
  cosmology: {
    label: "Observable Universe",
    descriptor: "Cosmology",
    description: "Observable-universe context and reconstructed large-scale structure",
  },
  galaxies: {
    label: "Galaxies",
    description: "Galaxy groups and individual galaxies",
  },
  stars: {
    label: "Stars",
    description: "Stars and compact-object models",
  },
  systems: {
    label: "Star Systems",
    description: "Planetary systems and Solar System geometry",
  },
  worlds: {
    label: "Worlds",
    description: "Planetary globes and evidence-bounded surface places",
  },
  missions: {
    label: "Missions",
    description: "Spacecraft journeys and observation programs",
  },
  earth: {
    label: "Earth network",
    description: "Space-exploration sites, institutions, and ground infrastructure",
  },
} as const;

function sectionDestination(section: keyof typeof sectionNavigation) {
  return atlasEntities.find((entity) => entity.section === section);
}

const childDestinations: Record<string, string[]> = {
  "observable-universe": ["laniakea", "jwst-deep-fields"],
  laniakea: ["local-group"],
  "local-group": ["milky-way", "andromeda"],
  "milky-way": ["solar-system", "sagittarius-a-star", "proxima-centauri"],
  "solar-system": ["mars", "apollo-17", "voyager-1"],
  mars: ["jezero"],
};

const COMPACT_ATLAS_QUERY = "(max-width: 1180px), (max-height: 819px)";

function matchingEntities(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return atlasEntities.slice(0, 7);

  return atlasEntities
    .map((entity) => {
      const searchable = [
        entity.name,
        atlasScientificNameFor(entity.id, entity.name),
        atlasScientificPresentationFor(entity).classification,
        entity.subtitle,
        entity.kind,
        entity.section,
        ...entity.tags,
      ]
        .join(" ")
        .toLocaleLowerCase();
      const starts = atlasScientificNameFor(entity.id, entity.name)
        .toLocaleLowerCase()
        .startsWith(normalized);
      return { entity, score: starts ? 2 : searchable.includes(normalized) ? 1 : 0 };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((result) => result.entity);
}

function evidenceName(value: string) {
  return value.replaceAll("-", " ");
}

function replaceAtlasLocation(params: URLSearchParams) {
  const query = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
  notifyCosmographyLocationChange();
}

interface AtlasShellProps {
  initialFocus?: string;
  initialAppearance?: "scientific" | "immersive";
  initialTour?: GuidedTour;
  initialTourOrdinal?: number;
  initialTravelMode?: TravelModeId;
}

interface TourSession {
  initialTour?: GuidedTour;
  initialTourOrdinal?: number;
  focusOnMount: boolean;
}

export function AtlasShell({
  initialFocus,
  initialAppearance,
  initialTour,
  initialTourOrdinal,
  initialTravelMode,
}: AtlasShellProps) {
  const initialEntity =
    atlasEntities.find(
      (entity) => entity.slug === initialFocus || entity.id === initialFocus,
    ) ?? defaultEntity;
  const [selected, setSelected] = useState<AtlasEntity>(initialEntity);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>(initialTravelMode ? "route" : null);
  const [appearance, setAppearance] = useState<"scientific" | "immersive">(
    initialAppearance ?? "scientific",
  );
  const [paused, setPaused] = useState(false);
  const [fullView, setFullView] = useState(false);
  const [destinationExpanded, setDestinationExpanded] = useState(true);
  const [recenterSequence, setRecenterSequence] = useState(0);
  const [travelMode, setTravelMode] = useState<TravelModeId>(
    initialTravelMode ?? "instant",
  );
  const [tourSession, setTourSession] = useState<TourSession | null>(
    initialTour
      ? { initialTour, initialTourOrdinal, focusOnMount: false }
      : null,
  );
  const [tourStatus, setTourStatus] = useState("");
  const timelineYear = 2026;
  const [copied, setCopied] = useState(false);
  const [savedPlaceSave, setSavedPlaceSave] = useState<{ key: string; status: SaveStatus }>({
    key: "",
    status: "idle",
  });
  const [rendererStatus, setRendererStatus] = useState<
    "ready" | "fallback" | "error"
  >("ready");
  const [renderProfile, setRenderProfile] =
    useState<RenderProfileRequest>("auto");
  const [rendererDiagnostics, setRendererDiagnostics] =
    useState<RendererDiagnostics | null>(null);
  const [marsDetailTier, setMarsDetailTier] = useState<"overview" | "regional">(
    "overview",
  );
  const [domainOverview, setDomainOverview] = useState<AtlasOverviewSection | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    catalogs: true,
    observations: false,
    missions: false,
    coverage: false,
  });
  const panelReturnFocusRef = useRef<HTMLElement | null>(null);
  const fullViewToggleRef = useRef<HTMLButtonElement>(null);
  const fullViewExitRef = useRef<HTMLButtonElement>(null);
  const fullViewReturnFocusRef = useRef<HTMLElement | null>(null);
  const destinationToggleRef = useRef<HTMLButtonElement>(null);
  const marsSceneRef = useRef<MarsAtlasSceneHandle>(null);

  const searchResults = useMemo(() => matchingEntities(query), [query]);
  const savedPlaceKey = `${atlasRelease.id}|${selected.id}|${appearance}|${timelineYear}`;
  const savedPlaceState =
    savedPlaceSave.key === savedPlaceKey ? savedPlaceSave.status : "idle";
  const visualTheme = useMemo(() => atlasVisualThemeFor(selected), [selected]);
  const selectedPresentation = useMemo(
    () => atlasScientificPresentationFor(selected),
    [selected],
  );
  const projectedLabelCandidates = useMemo(
    () => foundationProjectedLabelsForSelection(selected.id),
    [selected.id],
  );
  const children = useMemo(
    () =>
      (childDestinations[selected.id] ?? [])
        .map((id) => atlasEntities.find((entity) => entity.id === id))
        .filter((entity): entity is AtlasEntity => Boolean(entity)),
    [selected.id],
  );
  const marsAtlasActive = selected.id === "mars" || selected.id === "jezero";
  const earthNetworkActive = selected.id === "earth-exploration-network";
  const solarSystemActive = selected.id === "solar-system";
  const marsContextActive = marsAtlasActive && marsDetailTier === "regional";

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        document.getElementById("atlas-query")?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const compactAtlas = window.matchMedia(COMPACT_ATLAS_QUERY);
    const collapseForCompactAtlas = () => {
      if (compactAtlas.matches) setDestinationExpanded(false);
    };
    const initialFrame = window.requestAnimationFrame(collapseForCompactAtlas);
    compactAtlas.addEventListener("change", collapseForCompactAtlas);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      compactAtlas.removeEventListener("change", collapseForCompactAtlas);
    };
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const requestedTarget = panelReturnFocusRef.current;
        const returnTarget = requestedTarget?.isConnected
          ? requestedTarget
          : document.getElementById("flight-deck-tool");
        returnTarget?.focus();
      });
    });
  }, []);

  const enterFullView = useCallback((trigger?: HTMLElement) => {
    fullViewReturnFocusRef.current = trigger ?? fullViewToggleRef.current;
    setPanel(null);
    setFullView(true);
    window.requestAnimationFrame(() => fullViewExitRef.current?.focus());
  }, []);

  const exitFullView = useCallback(() => {
    setFullView(false);
    window.requestAnimationFrame(() => {
      const requestedTarget = fullViewReturnFocusRef.current;
      const returnTarget = requestedTarget?.isConnected
        ? requestedTarget
        : fullViewToggleRef.current;
      returnTarget?.focus();
    });
  }, []);

  useEffect(() => {
    if (!fullView) return;

    function handleFullViewEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        exitFullView();
      }
    }

    window.addEventListener("keydown", handleFullViewEscape);
    return () => window.removeEventListener("keydown", handleFullViewEscape);
  }, [exitFullView, fullView]);

  const selectGuidedTourEntity = useCallback((entityId: string) => {
    const entity = atlasEntities.find((candidate) => candidate.id === entityId);
    if (!entity) return;
    setSelected(entity);
    setDomainOverview(null);
    setMarsDetailTier("overview");
    setQuery("");
    setSearchOpen(false);
    setPanel(null);
    setRecenterSequence((value) => value + 1);
  }, []);

  const exitGuidedTour = useCallback((selectedName: string) => {
    setTourSession(null);
    setPanel(null);
    setTourStatus(`Seven Scales tour exited. ${selectedName} remains selected.`);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById("start-seven-scales-tour")?.focus();
      });
    });
  }, []);

  const travelTo = useCallback((entity: AtlasEntity, mode?: TravelModeId) => {
    const presentationName = atlasScientificNameFor(entity.id, entity.name);
    const compactAtlas = window.matchMedia(COMPACT_ATLAS_QUERY).matches;
    const shouldRestoreDestinationFocus = document
      .getElementById("destination-card-details")
      ?.contains(document.activeElement);
    if (tourSession) {
      setTourStatus(`Seven Scales tour exited. ${presentationName} selected.`);
    } else if (compactAtlas) {
      setTourStatus(
        `${presentationName} selected. Details collapsed to keep the compact atlas clear.`,
      );
    } else if (!destinationExpanded) {
      setTourStatus(`${presentationName} selected. Details remain collapsed.`);
    }
    setTourSession(null);
    setDomainOverview(null);
    setSelected(entity);
    setMarsDetailTier("overview");
    if (compactAtlas) {
      setDestinationExpanded(false);
    }
    setQuery("");
    setSearchOpen(false);
    setRecenterSequence((value) => value + 1);
    const params = new URLSearchParams(window.location.search);
    params.set("focus", entity.slug);
    params.set("release", atlasRelease.id);
    params.delete("tour");
    params.delete("step");
    if (mode) params.set("travel", mode);
    else if (panel !== "route") params.delete("travel");
    replaceAtlasLocation(params);
    if (shouldRestoreDestinationFocus) {
      window.requestAnimationFrame(() => destinationToggleRef.current?.focus());
    }
  }, [destinationExpanded, panel, tourSession]);

  const selectProjectedLabel = useCallback(
    (entityId: string) => {
      const entity = atlasEntities.find((candidate) => candidate.id === entityId);
      if (!entity) return;
      setTourStatus(
        `${atlasScientificNameFor(entity.id, entity.name)} selected from the bounded foundation label layer.`,
      );
      travelTo(entity);
    },
    [travelTo],
  );

  const selectDomainOverviewEntity = useCallback(
    (entityId: string) => {
      const entity = atlasEntities.find((candidate) => candidate.id === entityId);
      if (!entity) return;
      setTourStatus(
        `${atlasScientificNameFor(entity.id, entity.name)} selected from the ${domainOverview === "missions" ? "mission" : "star-system"} overview.`,
      );
      travelTo(entity);
    },
    [domainOverview, travelTo],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchResults[activeSearchIndex]) travelTo(searchResults[activeSearchIndex]);
  }

  function searchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((current) =>
        searchResults.length ? (current + 1) % searchResults.length : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((current) =>
        searchResults.length ? (current - 1 + searchResults.length) % searchResults.length : 0,
      );
      return;
    }
    if (event.key === "Escape") {
      setSearchOpen(false);
      event.currentTarget.blur();
    }
  }

  function openPanel(next: Exclude<Panel, null>, trigger?: HTMLElement) {
    if (trigger) panelReturnFocusRef.current = trigger;
    if (next === "route" && tourSession) {
      setTourSession(null);
      setTourStatus(
        `Seven Scales tour exited. Flight Deck opened for ${selectedPresentation.name}.`,
      );
    }
    setPanel(next);
  }

  function togglePanel(next: Exclude<Panel, null>, trigger: HTMLElement) {
    if (panel === next) {
      closePanel();
      return;
    }
    openPanel(next, trigger);
  }

  async function shareScene() {
    const url = new URL(window.location.pathname, window.location.origin);
    const current = new URLSearchParams(window.location.search);
    url.searchParams.set("focus", tourSession ? current.get("focus") ?? selected.id : selected.slug);
    url.searchParams.set(
      "release",
      tourSession ? current.get("release") ?? atlasRelease.id : atlasRelease.id,
    );
    url.searchParams.set("appearance", appearance);
    if (tourSession) {
      const tour = current.get("tour");
      const step = current.get("step");
      if (tour && step) {
        url.searchParams.set("tour", tour);
        url.searchParams.set("step", step);
      }
    } else if (panel === "route") {
      url.search = current.toString();
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function savePlace() {
    const requestKey = savedPlaceKey;
    setSavedPlaceSave({ key: requestKey, status: "saving" });
    try {
      const { savePrivatePlace } = await import(
        "@/app/lib/client/personal-storage"
      );
      const result = await savePrivatePlace({
        entityId: selected.id,
        appearance,
        releaseId: atlasRelease.id,
      });
      setSavedPlaceSave({
        key: requestKey,
        status: result.status,
      });
    } catch {
      setSavedPlaceSave({ key: requestKey, status: "error" });
    }
  }

  const enterSurface = selected.id === "mars" || selected.id === "jezero";
  const enterMoonSurface = selected.id === "apollo-17";
  const enterRelativityLab = selected.id === "sagittarius-a-star";
  const enterVoyagerJourney = selected.id === "voyager-1";
  const enterEarthNetwork = selected.id === "earth-exploration-network";

  return (
    <main
      className={`cosmography-shell is-${appearance}${fullView ? " is-full-view" : ""}`}
      data-atlas-theme={visualTheme.id}
      style={
        {
          "--focus-accent": visualTheme.accent,
          "--focus-accent-strong": visualTheme.accentStrong,
          "--focus-accent-soft": visualTheme.accentSoft,
        } as CSSProperties
      }
    >
      <a
        className="skip-link"
        href="#structured-atlas"
        tabIndex={fullView ? -1 : undefined}
        aria-hidden={fullView || undefined}
      >
        Skip the 3D visualization
      </a>

      <button
        ref={fullViewExitRef}
        className="full-view-exit"
        type="button"
        onClick={exitFullView}
        aria-label="Exit full cosmos view"
        aria-keyshortcuts="Escape"
      >
        <Minimize2 size={18} aria-hidden="true" />
        <span>Exit full view</span>
        <kbd aria-hidden="true">Esc</kbd>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {fullView
          ? layers.catalogs
            ? "Full cosmos view active. Foundation destination controls remain available; press Escape to restore the atlas interface."
            : "Full cosmos view active. Names and designations are off; press Escape to restore the atlas interface."
          : ""}
      </span>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {tourStatus}
      </span>
      <span id="catalog-label-policy" className="sr-only">
        Scientifically reviewed names and designations cover 15 exact-release identities at
        semantic display anchors. Their camera placement is not astrometry, a physical pose,
        catalog streaming, or complete coverage.
      </span>

      {domainOverview ? (
        <div className="universe-viewport" data-domain={domainOverview} data-appearance={appearance}>
          <Suspense fallback={<div role="status">Preparing the {sectionNavigation[domainOverview].label} overview…</div>}>
            <AtlasDomainOverview section={domainOverview} onSelectEntity={selectDomainOverviewEntity} />
          </Suspense>
        </div>
      ) : marsAtlasActive ? (
        <div
          className="universe-viewport"
          data-domain="globe"
          data-appearance={appearance}
        >
          <Suspense fallback={<div role="status">Loading the retained Mars globe…</div>}>
            <MarsAtlasScene
              ref={marsSceneRef}
              onDetailTierChange={setMarsDetailTier}
            />
          </Suspense>
        </div>
      ) : solarSystemActive ? (
        <div className="universe-viewport" data-domain="system" data-appearance={appearance}>
          <Suspense fallback={<div role="status">Preparing the Solar System overview…</div>}>
            <SolarSystemAtlasScene
              onSelectMars={() => {
                const mars = atlasEntities.find((entity) => entity.id === "mars");
                if (mars) travelTo(mars);
              }}
              onSelectTrappist={() => {
                const trappist = atlasEntities.find((entity) => entity.id === "trappist-1");
                if (trappist) travelTo(trappist);
              }}
            />
          </Suspense>
        </div>
      ) : earthNetworkActive ? (
        <div className="universe-viewport" data-domain="globe" data-appearance={appearance}>
          <Suspense fallback={<div role="status">Loading the Earth exploration network…</div>}>
            <EarthNetworkAtlasScene />
          </Suspense>
        </div>
      ) : (
        <UniverseViewport
          domain={selected.domain}
          appearance={appearance}
          paused={paused}
          focusId={selected.id}
          focusColor={selected.color}
          recenterSequence={recenterSequence}
          className="universe-viewport"
          renderProfile={renderProfile}
          labelCandidates={projectedLabelCandidates}
          labelsVisible={layers.catalogs}
          fullView={fullView}
          onSelectLabel={selectProjectedLabel}
          onRendererStatus={setRendererStatus}
          onRendererDiagnostics={setRendererDiagnostics}
        />
      )}

      <div className="cosmos-vignette" aria-hidden="true" />
      <div className="cosmos-grain" aria-hidden="true" />

      <header className="atlas-header">
        <Link className="brand" href="/" aria-label="Cosmography home">
          <span className="brand-mark" aria-hidden="true">
            <Orbit size={20} strokeWidth={1.4} />
          </span>
          <span>
            <strong>COSMOGRAPHY</strong>
            <small>Observable universe atlas</small>
          </span>
        </Link>

        <form className="atlas-search" role="search" onSubmit={submitSearch}>
          <Search size={17} aria-hidden="true" />
          <label className="sr-only" htmlFor="atlas-query">
            Search destinations, missions, worlds, and observations
          </label>
          <input
            id="atlas-query"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            aria-controls="atlas-search-results"
            aria-activedescendant={
              searchOpen && searchResults[activeSearchIndex]
                ? `atlas-search-option-${searchResults[activeSearchIndex].id}`
                : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
              setActiveSearchIndex(0);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={searchKeyDown}
            autoComplete="off"
            placeholder="Search the observable universe"
          />
          <kbd aria-hidden="true">/</kbd>

          {searchOpen ? (
            <div
              className="search-results"
              id="atlas-search-results"
              role="listbox"
              aria-label="Destinations"
            >
              <div className="search-results-label">
                {query ? `${searchResults.length} matched destinations` : "Explore a scale"}
              </div>
              {searchResults.length ? (
                searchResults.map((entity, index) => (
                  <button
                    id={`atlas-search-option-${entity.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeSearchIndex}
                    tabIndex={-1}
                    key={entity.id}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => travelTo(entity)}
                  >
                    <span
                      className="result-dot"
                      style={{ backgroundColor: entity.color }}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{atlasScientificNameFor(entity.id, entity.name)}</strong>
                      <small>{entity.subtitle}</small>
                    </span>
                    <span className="result-domain">{entity.scaleLabel}</span>
                  </button>
                ))
              ) : (
                <p className="empty-search">
                  No seed-atlas match yet. The live registry will expand this index.
                </p>
              )}
            </div>
          ) : null}
        </form>

        <nav className="header-actions" aria-label="Primary">
          <Link href="/atlas">
            <BookOpen size={16} aria-hidden="true" />
            Atlas
          </Link>
          <Link href="/sources">
            <Database size={16} aria-hidden="true" />
            Sources
          </Link>
          <Link href="/vision">
            <Sparkles size={16} aria-hidden="true" />
            Vision
          </Link>
          <button type="button" onClick={shareScene} aria-live="polite">
            <Share2 size={16} aria-hidden="true" />
            {copied ? "Copied" : "Share"}
          </button>
        </nav>
      </header>

      {marsContextActive ? (
        <nav className="scale-rail" aria-label="Mars exploration">
          <span className="scale-rail-title">Mars</span>
          <button type="button" onClick={() => marsSceneRef.current?.showOverview()}>
            <span aria-hidden="true" />
            World
          </button>
          <button type="button" className="active" aria-current="location">
            <span aria-hidden="true" />
            Places
          </button>
          <button type="button" onClick={() => marsSceneRef.current?.openSurface()}>
            <span aria-hidden="true" />
            Surface view
          </button>
          <button type="button" onClick={() => window.location.assign("/worlds/mars")}>
            <span aria-hidden="true" />
            Full record
          </button>
          <button type="button" onClick={(event) => openPanel("evidence", event.currentTarget)}>
            <span aria-hidden="true" />
            Evidence
          </button>
        </nav>
      ) : (
        <nav className="scale-rail" aria-label="Atlas domains">
          <span className="scale-rail-title">Domain</span>
          {Object.entries(sectionNavigation).map(([section, item]) => {
            const destination = sectionDestination(
              section as keyof typeof sectionNavigation,
            );
            const active = domainOverview === section || (!domainOverview && selected.section === section);
            const descriptor = "descriptor" in item ? item.descriptor : undefined;
            return (
              <button
                type="button"
                key={section}
                className={active ? "active" : undefined}
                onClick={() => {
                  if (section === "systems" || section === "missions") {
                    setTourSession(null);
                    setPanel(null);
                    setDomainOverview(section);
                    setTourStatus(`${item.label} overview opened.`);
                    return;
                  }
                  if (destination) travelTo(destination);
                }}
                aria-current={active ? "location" : undefined}
                aria-label={`${item.label}${descriptor ? `. ${descriptor}` : ""}. ${item.description}`}
                title={item.description}
              >
                <span aria-hidden="true" />
                {item.label}
                {descriptor ? (
                  <small
                    style={{ display: "block", marginTop: "0.12rem", fontSize: "0.56rem" }}
                  >
                    {descriptor}
                  </small>
                ) : null}
              </button>
            );
          })}
        </nav>
      )}

      {domainOverview ? null : tourSession ? (
        <Suspense
          fallback={
            <section
              className="destination-card tour-card"
              aria-label="Preparing Seven Scales to Jezero"
              inert={fullView}
              aria-hidden={fullView || undefined}
            >
              <div className="destination-kicker">Guided tour · semantic navigation</div>
              <h1>Preparing Seven Scales…</h1>
              <p className="destination-summary">Loading the release-pinned tour record.</p>
            </section>
          }
        >
          <GuidedTourExperience
            {...tourSession}
            fullView={fullView}
            onSelectEntity={selectGuidedTourEntity}
            onOpenEvidence={(trigger) => openPanel("evidence", trigger)}
            onStatus={setTourStatus}
            onExit={exitGuidedTour}
          />
        </Suspense>
      ) : (
        <section
          className="destination-card destination-card--standard"
          data-collapsed={String(!destinationExpanded)}
          aria-labelledby="destination-name"
          inert={fullView}
          aria-hidden={fullView || undefined}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !destinationExpanded) return;
            event.preventDefault();
            event.stopPropagation();
            setDestinationExpanded(false);
            setTourStatus(`${selectedPresentation.name} details collapsed.`);
            window.requestAnimationFrame(() => destinationToggleRef.current?.focus());
          }}
        >
          <div className="destination-card__heading">
            <div>
              <div className="destination-kicker">
                <span>
                  {selected.section === "cosmology"
                    ? "Cosmology"
                    : sectionNavigation[selected.section].label}
                </span>
                <span>•</span>
                <span>{selectedPresentation.classification}</span>
              </div>
              <h1 id="destination-name">{selectedPresentation.name}</h1>
            </div>
            <button
              ref={destinationToggleRef}
              className="destination-card__toggle"
              type="button"
              aria-expanded={destinationExpanded}
              aria-controls="destination-card-details"
              aria-label={`${destinationExpanded ? "Hide" : "Show"} details for ${selectedPresentation.name}`}
              onClick={() => {
                setDestinationExpanded((expanded) => {
                  const next = !expanded;
                  setTourStatus(
                    `${selectedPresentation.name} details ${next ? "expanded" : "collapsed"}.`,
                  );
                  return next;
                });
              }}
            >
              {destinationExpanded ? (
                <Minimize2 size={17} aria-hidden="true" />
              ) : (
                <Maximize2 size={17} aria-hidden="true" />
              )}
              <span>{destinationExpanded ? "Hide" : "Details"}</span>
            </button>
          </div>

          <div id="destination-card-details" hidden={!destinationExpanded}>
            <div className="breadcrumb" aria-label="Location path">
              {selected.breadcrumb.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
                  {atlasScientificBreadcrumbLabel(item)}
                </span>
              ))}
            </div>
            <p className="destination-subtitle">{selected.subtitle}</p>
            {selectedPresentation.scopeNote ? (
              <p className="destination-scope-note">{selectedPresentation.scopeNote}</p>
            ) : null}
            <p className="destination-summary">{selected.summary}</p>
            <div className="destination-facts">
              <span>
                <MapPin size={14} aria-hidden="true" />
                {selected.distanceLabel}
              </span>
              <span>
                <Eye size={14} aria-hidden="true" />
                {evidenceName(selected.representation.evidence)}
              </span>
            </div>
            <div className="destination-actions">
              {enterSurface ? (
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => marsSceneRef.current?.exploreJezero()}
                >
                  {selected.id === "jezero" ? "Explore Jezero" : "Explore Mars"}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : enterMoonSurface ? (
                <Link className="primary-action" href="/worlds/moon">
                  Enter Apollo 17 surface
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : enterRelativityLab ? (
                <Link className="primary-action" href="/lab/black-holes">
                  Open relativity lab
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : enterVoyagerJourney ? (
                <Link className="primary-action" href="/missions/voyager-1">
                  Replay Voyager 1
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : enterEarthNetwork ? (
                <Link className="primary-action" href="/earth">
                  Explore Earth network
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : children[0] ? (
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => travelTo(children[0])}
                >
                  {selected.id === "solar-system" ? "Enter Mars" : "Travel deeper"}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-action"
                  onClick={(event) => openPanel("evidence", event.currentTarget)}
                >
                  Open object record
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
              {marsAtlasActive ? (
                <Link href="/worlds/mars">
                  Full Mars record
                  <BookOpen size={16} aria-hidden="true" />
                </Link>
              ) : null}
              <button
                id="start-seven-scales-tour"
                type="button"
                onClick={() => {
                  setPanel(null);
                  setTourSession({ focusOnMount: true });
                }}
              >
                <BookOpen size={16} aria-hidden="true" />
                Seven Scales tour
              </button>
              <button
                type="button"
                onClick={(event) => openPanel("route", event.currentTarget)}
              >
                <Route size={16} aria-hidden="true" />
                Flight Deck
              </button>
              <button
                type="button"
                onClick={savePlace}
                disabled={
                  savedPlaceState === "saving" || savedPlaceState === "signed-out"
                }
                aria-busy={savedPlaceState === "saving"}
              >
                <Bookmark size={16} aria-hidden="true" />
                {savedPlaceState === "saving"
                  ? "Saving place…"
                  : savedPlaceState === "saved"
                    ? "Place saved"
                    : savedPlaceState === "signed-out"
                      ? "Opening sign in…"
                      : savedPlaceState === "unavailable"
                        ? "Storage unavailable"
                        : savedPlaceState === "error"
                          ? "Try saving again"
                          : "Save place"}
              </button>
              {savedPlaceState === "saved" ? (
                <Link href="/me#saved-places">
                  Open saved places
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
              <span className="sr-only" role="status" aria-live="polite">
                {savedPlaceState === "saving"
                  ? `Saving ${selectedPresentation.name} as a private place`
                  : savedPlaceState === "saved"
                    ? `${selectedPresentation.name} was saved privately to My Atlas`
                    : savedPlaceState === "signed-out"
                      ? `Opening sign in. Return to ${selectedPresentation.name} and press Save place again.`
                      : savedPlaceState === "unavailable"
                        ? `Private saved-place storage is unavailable. No browser copy of ${selectedPresentation.name} was created.`
                        : savedPlaceState === "error"
                          ? `Saving ${selectedPresentation.name} could not be confirmed. No browser copy was created.`
                          : ""}
              </span>
            </div>
            {children.length > 1 ? (
              <div className="next-destinations">
                <span>Related destinations</span>
                {children.slice(1).map((entity) => (
                  <button type="button" key={entity.id} onClick={() => travelTo(entity)}>
                    {atlasScientificNameFor(entity.id, entity.name)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}

      <aside className="scene-tools" aria-label="Visualization tools">
        <button
          type="button"
          className={panel === "layers" ? "active" : undefined}
          onClick={(event) => togglePanel("layers", event.currentTarget)}
          aria-pressed={panel === "layers"}
          aria-label={panel === "layers" ? "Close map layers" : "Open map layers"}
          aria-describedby="catalog-label-policy"
        >
          <Layers3 size={18} aria-hidden="true" />
          <span>Layers</span>
        </button>
        <button
          type="button"
          className={panel === "evidence" ? "active" : undefined}
          onClick={(event) => togglePanel("evidence", event.currentTarget)}
          aria-pressed={panel === "evidence"}
          aria-label={panel === "evidence" ? "Close evidence record" : "Open evidence record"}
        >
          <Eye size={18} aria-hidden="true" />
          <span>Evidence</span>
        </button>
        <button
          id="flight-deck-tool"
          type="button"
          className={panel === "route" ? "active" : undefined}
          onClick={(event) => togglePanel("route", event.currentTarget)}
          aria-pressed={panel === "route"}
          aria-label={panel === "route" ? "Close Flight Deck" : "Open Flight Deck"}
        >
          <Route size={18} aria-hidden="true" />
          <span>Flight</span>
        </button>
        <button
          ref={fullViewToggleRef}
          type="button"
          onClick={(event) => enterFullView(event.currentTarget)}
          aria-label="Enter full cosmos view"
        >
          <Maximize2 size={18} aria-hidden="true" />
          <span>Full view</span>
        </button>
        <button
          type="button"
          className={appearance === "immersive" ? "active" : undefined}
          onClick={() =>
            setAppearance((current) =>
              current === "scientific" ? "immersive" : "scientific",
            )
          }
          aria-pressed={appearance === "immersive"}
          aria-label={
            appearance === "scientific"
              ? "Use immersive appearance"
              : "Use scientific appearance"
          }
        >
          <Sparkles size={18} aria-hidden="true" />
          <span>{appearance === "scientific" ? "Immerse" : "Scientific"}</span>
        </button>
        <button
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-pressed={paused}
          aria-label={paused ? "Resume atlas motion" : "Pause atlas motion"}
        >
          {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          <span>{paused ? "Resume" : "Pause"}</span>
        </button>
      </aside>

      {panel ? (
        <Suspense
          fallback={
            <aside className="detail-panel" aria-label="Opening atlas panel">
              <p>Opening…</p>
            </aside>
          }
        >
          <AtlasDetailPanel
            panel={panel}
            selected={selected}
            releaseId={atlasRelease.id}
            appearance={appearance}
            layers={layers}
            renderProfile={renderProfile}
            rendererDiagnostics={rendererDiagnostics}
            travelMode={travelMode}
            onClose={closePanel}
            onToggleLayer={(key) =>
              setLayers((current) => ({ ...current, [key]: !current[key] }))
            }
            onRenderProfileChange={(profile) => {
              setRenderProfile(profile);
              setRendererDiagnostics(null);
            }}
            onTravelModeChange={setTravelMode}
            onPreviewJourney={() => travelTo(selected, travelMode)}
          />
        </Suspense>
      ) : null}

      <div className="compass-control" aria-hidden="true">
        <Compass size={22} strokeWidth={1.2} />
        <span>N</span>
      </div>

      <details className="timeline-dock">
        <summary aria-label={`Scene context ${timelineYear}, present-day atlas frame`}>
          <span>Scene context</span>
          <strong>{timelineYear}</strong>
          <small>Present-day atlas frame</small>
        </summary>
        <div className="timeline-context">
          <strong>Temporal layers planned</strong>
          <span>No time-varying scientific layer is active in this release.</span>
        </div>
      </details>

      <div className="release-status">
        <span className={domainOverview || rendererStatus === "ready" ? "status-ok" : "status-warn"} aria-hidden="true" />
        <span>
          {domainOverview
            ? "Atlas overview active"
            : rendererStatus === "ready"
            ? `GPU atlas active · ${rendererDiagnostics?.profile ?? renderProfile}`
            : "Structured fallback active"}
        </span>
        <span>•</span>
        <span>{atlasRelease.id}</span>
        <Link href="/missions">{missionAgencies.length} agency groups indexed</Link>
        <details className="scene-disclosure">
          <summary>
            {domainOverview === "systems"
              ? "Indexed system overview"
              : domainOverview === "missions"
                ? "Multi-scale mission overview"
                : marsAtlasActive
              ? "Derived orbital mosaic"
              : earthNetworkActive
                ? "Derived satellite mosaic"
                : solarSystemActive
                  ? "Illustrative system model"
                  : selected.section === "missions"
                    ? "Mission trajectory view"
                    : "Constructed scientific view"}
          </summary>
          <div>
            <strong>
              {domainOverview === "systems"
                ? "View: schematic foundation system index"
                : domainOverview === "missions"
                  ? "View: evidence-scaled mission paths"
                  : marsAtlasActive
                ? "View: Mars orbit"
                : earthNetworkActive
                  ? "View: processed global Earth mosaic"
                  : solarSystemActive
                    ? "View: compressed heliocentric overview"
                    : selected.section === "missions"
                      ? "Context: outbound from the Solar System"
                      : "Observer: Solar System"}
            </strong>
            <span>
              {domainOverview === "systems"
                ? "Schematic selection layout · not physical separation"
                : domainOverview === "missions"
                  ? "Routes open at surface, planetary, interstellar, or observation scale"
                  : selected.representation.geometry.replaceAll("-", " ")}
            </span>
            {domainOverview ? (
              <span>Select a destination to inspect its evidence</span>
            ) : (
              <button type="button" onClick={(event) => openPanel("evidence", event.currentTarget)}>
                Inspect evidence
              </button>
            )}
          </div>
        </details>
      </div>

      <section
        id="structured-atlas"
        className="sr-atlas"
        aria-label="Structured atlas view"
        tabIndex={-1}
        inert={fullView}
        aria-hidden={fullView || undefined}
      >
        <h2>
          {domainOverview
            ? `Current atlas category: ${sectionNavigation[domainOverview].label}`
            : `Current atlas location: ${selectedPresentation.name}`}
        </h2>
        <p>
          {domainOverview === "systems"
            ? "Choose between the two star systems indexed in this foundation release."
            : domainOverview === "missions"
              ? "Choose a mission or observation path at the scale where its evidence is meaningful."
              : selected.summary}
        </p>
        {!domainOverview ? <p>{selected.distanceLabel}. {selected.scaleLabel}.</p> : null}
        <h3>Available destinations</h3>
        <ul>
          {atlasEntities.map((entity) => (
            <li key={entity.id}>
              <button type="button" onClick={() => travelTo(entity)}>
                {atlasScientificNameFor(entity.id, entity.name)}: {entity.subtitle}
              </button>
            </li>
          ))}
        </ul>
        <Link href="/atlas">
          <Accessibility size={16} aria-hidden="true" />
          Open the complete text atlas
        </Link>
      </section>
    </main>
  );
}
