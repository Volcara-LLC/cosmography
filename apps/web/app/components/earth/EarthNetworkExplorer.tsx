"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronRight,
  ExternalLink,
  Landmark,
  MapPinned,
  Radio,
  Rocket,
  Search,
  Telescope,
} from "lucide-react";
import type {
  EarthOrganization,
  EarthSite,
  EarthSource,
} from "@/app/data/earth/schema";
import styles from "./EarthNetwork.module.css";

type Props = {
  sites: EarthSite[];
  organizations: EarthOrganization[];
  sources: EarthSource[];
};

const roleLabels: Record<EarthSite["roles"][number], string> = {
  "agency-center": "Agency center",
  "launch-site": "Launch site",
  "mission-control": "Mission control",
  "tracking-station": "Tracking",
  observatory: "Observatory",
  "research-center": "Research",
  "museum-public": "Museum / public",
  "historical-site": "Historic site",
};

const statusLabels: Record<EarthSite["status"], string> = {
  operational: "Operational",
  "mixed-operational-historical": "Operational + historic",
  "construction-commissioning": "Construction / commissioning",
  historical: "Historical",
  "status-review-needed": "Status review needed",
};

const accessLabels: Record<EarthSite["publicAccess"], string> = {
  "regular-public-access": "Public access",
  "advance-reservation": "Reservation required",
  "occasional-events": "Occasional events",
  "virtual-only": "Virtual access",
  restricted: "Restricted",
  "access-review-needed": "Access unverified",
};

const precisionLabels: Record<EarthSite["coordinates"]["precision"], string> = {
  "official-survey-coordinate": "Official survey coordinate",
  "official-published-coordinate": "Official published coordinate",
  "rounded-facility-centroid": "Rounded facility centroid",
  "official-address-centroid": "Official-address centroid",
  "regional-centroid-only": "Coarse regional centroid",
};

function roleIcon(role: EarthSite["roles"][number]) {
  if (role === "launch-site") return Rocket;
  if (role === "tracking-station" || role === "mission-control") return Radio;
  if (role === "observatory") return Telescope;
  if (role === "museum-public" || role === "historical-site") return Landmark;
  return Building2;
}

function coordinateLabel(site: EarthSite) {
  const uncertainty = site.coordinates.uncertaintyMeters;
  const decimals =
    uncertainty >= 20_000 ? 1 :
    uncertainty >= 2_000 ? 2 :
    uncertainty >= 200 ? 3 :
    uncertainty >= 20 ? 4 :
    uncertainty >= 2 ? 5 : 6;
  const lat = Math.abs(site.coordinates.latitude).toFixed(decimals);
  const lon = Math.abs(site.coordinates.longitude).toFixed(decimals);
  return `${lat}° ${site.coordinates.latitude >= 0 ? "N" : "S"} · ${lon}° ${
    site.coordinates.longitude >= 0 ? "E" : "W"
  } · ${site.coordinates.datum}`;
}

function mapPosition(site: EarthSite) {
  return {
    left: `${((site.coordinates.longitude + 180) / 360) * 100}%`,
    top: `${((90 - site.coordinates.latitude) / 180) * 100}%`,
  };
}

export function EarthNetworkExplorer({ sites, organizations, sources }: Props) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(sites[0]?.id ?? "");

  const organizationById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization])),
    [organizations],
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const regions = useMemo(
    () => [...new Set(sites.map((site) => site.region))].sort(),
    [sites],
  );

  const filteredSites = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return sites.filter((site) => {
      const organizationNames = site.organizations
        .map((item) => organizationById.get(item.organizationId)?.name ?? "")
        .join(" ");
      const haystack = [
        site.name,
        site.shortName,
        site.country,
        site.locality,
        site.summary,
        site.tags.join(" "),
        organizationNames,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (role === "all" || site.roles.includes(role as EarthSite["roles"][number])) &&
        (region === "all" || site.region === region) &&
        (status === "all" || site.status === status)
      );
    });
  }, [organizationById, query, region, role, sites, status]);

  const selectedSite =
    filteredSites.find((site) => site.id === selectedId) ?? filteredSites[0] ?? null;

  return (
    <section className={`${styles.explorer} earth-network-explorer`} aria-labelledby="earth-explorer-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>Interactive facility layer</span>
          <h2 id="earth-explorer-title">Follow humanity&apos;s links to space.</h2>
        </div>
        <p>
          Search by institution or place. The coordinate plane is intentionally tile-free: every
          marker reports its own precision instead of borrowing certainty from a commercial map.
        </p>
      </div>

      <form className={`${styles.filters} earth-network-filters`} onSubmit={(event) => event.preventDefault()}>
        <label className={styles.searchField}>
          <span className={styles.visuallyHidden}>Search Earth exploration sites</span>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agency, country, mission, or place"
          />
        </label>

        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="all">All roles</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="all">All regions</option>
            {regions.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>

        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </form>

      <p className={styles.resultSummary} role="status" aria-live="polite">
        Showing <strong>{filteredSites.length}</strong> of {sites.length} representative sites
      </p>

      <div className={`${styles.mapFrame} earth-network-map`}>
        <div className={styles.mapHeader}>
          <span><MapPinned size={14} aria-hidden="true" /> Equirectangular coordinate plane</span>
          <span>180° W <b>·</b> 0° <b>·</b> 180° E</span>
        </div>

        <div className={styles.mapPlot} aria-label="Map-style plot of filtered exploration sites">
          <div className={styles.latitudeNorth} aria-hidden="true">90° N</div>
          <div className={styles.latitudeEquator} aria-hidden="true">Equator</div>
          <div className={styles.latitudeSouth} aria-hidden="true">90° S</div>

          {filteredSites.map((site) => {
            const Icon = roleIcon(site.roles[0]);
            const isSelected = selectedSite?.id === site.id;
            return (
              <button
                key={site.id}
                type="button"
                className={`${styles.mapPin} earth-network-map-pin`}
                style={mapPosition(site)}
                data-selected={isSelected}
                data-status={site.status}
                data-edge={site.coordinates.longitude > 120 ? "east" : undefined}
                aria-label={`Select ${site.name}, ${site.country}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(site.id)}
              >
                <span className={styles.pinPulse} aria-hidden="true" />
                <span className={styles.pinCore} aria-hidden="true"><Icon size={12} /></span>
                <span className={styles.pinLabel}>{site.shortName}</span>
              </button>
            );
          })}

          {filteredSites.length === 0 && (
            <div className={styles.emptyMap}>
              <MapPinned size={24} aria-hidden="true" />
              <strong>No sites match these filters.</strong>
              <span>Clear one filter or try a broader search.</span>
            </div>
          )}

          {selectedSite && (
            <article className={`${styles.mapDetail} earth-network-map-detail`}>
              <div className={styles.mapDetailTopline}>
                <span>{selectedSite.region} · {selectedSite.country}</span>
                <span data-status={selectedSite.status}>{statusLabels[selectedSite.status]}</span>
              </div>
              <h3>{selectedSite.name}</h3>
              <p>{selectedSite.summary}</p>
              <div className={styles.coordinateReadout}>
                <span>{coordinateLabel(selectedSite)}</span>
                <span>{precisionLabels[selectedSite.coordinates.precision]}</span>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById(`earth-card-${selectedSite.id}`)?.focus()}
              >
                Read full record <ChevronRight size={13} aria-hidden="true" />
              </button>
            </article>
          )}
        </div>

        <div className={styles.mapFooter}>
          <span><i data-kind="operational" /> Operational or mixed</span>
          <span><i data-kind="building" /> Construction / commissioning</span>
          <span><i data-kind="coarse" /> Pin shape does not encode coordinate precision</span>
        </div>
      </div>

      <div className={`${styles.siteGrid} earth-network-site-grid`} aria-label="Filtered facility records">
        {filteredSites.map((site) => {
          const coordinateSource = sourceById.get(site.coordinates.sourceId);
          return (
            <article className={`${styles.siteCard} earth-network-site-card`} key={site.id}>
              <button
                id={`earth-card-${site.id}`}
                type="button"
                className={styles.siteCardHeading}
                onClick={() => setSelectedId(site.id)}
              >
                <span className={styles.cardIndex}>{String(sites.indexOf(site) + 1).padStart(2, "0")}</span>
                <span>
                  <small>{site.region} · {site.locality}</small>
                  <strong>{site.name}</strong>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>

              <p>{site.summary}</p>

              <div className={styles.roleList} aria-label="Roles">
                {site.roles.slice(0, 4).map((siteRole) => (
                  <span key={siteRole}>{roleLabels[siteRole]}</span>
                ))}
                {site.roles.length > 4 && <span>+{site.roles.length - 4}</span>}
              </div>

              <dl className={styles.cardFacts}>
                <div>
                  <dt>Status</dt>
                  <dd data-status={site.status}>{statusLabels[site.status]}</dd>
                </div>
                <div>
                  <dt>Visit</dt>
                  <dd>{accessLabels[site.publicAccess]}</dd>
                </div>
                <div>
                  <dt>Coordinate</dt>
                  <dd>{coordinateLabel(site)}</dd>
                </div>
                <div>
                  <dt>Precision</dt>
                  <dd>{precisionLabels[site.coordinates.precision]} · ±{site.coordinates.uncertaintyMeters.toLocaleString()} m</dd>
                </div>
              </dl>

              <details className={styles.cardDetails}>
                <summary>Evidence, access, and caveats</summary>
                <div>
                  <h4>Coordinate method</h4>
                  <p>{site.coordinates.note}</p>
                  <h4>Public access</h4>
                  <p>{site.accessNote}</p>
                  <h4>Data boundary</h4>
                  <p>{site.dataCaveat}</p>
                  <h4>Participating organizations</h4>
                  <ul>
                    {site.organizations.map((item) => {
                      const organization = organizationById.get(item.organizationId);
                      return (
                        <li key={`${site.id}-${item.organizationId}-${item.relation}`}>
                          {organization?.shortName ?? item.organizationId} · {item.relation.replaceAll("-", " ")}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>

              <footer className={styles.cardFooter}>
                <span>Verified {site.verifiedAt} · review by {site.reviewBy}</span>
                <a href={site.officialUrl} target="_blank" rel="noreferrer">
                  Official site <ExternalLink size={12} aria-hidden="true" />
                </a>
                {coordinateSource && (
                  <a href={coordinateSource.url} target="_blank" rel="noreferrer">
                    Source record <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
