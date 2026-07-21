# Migration design

`0001_core_control_plane.sql` targets Cloudflare D1/SQLite and holds the small,
queryable control plane: releases, active pointers, source snapshots, canonical
entity metadata, assertions, representation labels, rights decisions, and R2 or
authority object pointers.

The migration deliberately does **not** create tables for Gaia-scale rows,
planetary rasters, SPICE kernels, media bytes, tile payloads, or dense time
series. Those are release-namespaced R2 objects (often Parquet, Zarr, FITS,
GeoTIFF, 3D Tiles, or media derivatives) or remain federated at an authoritative
archive. `release_objects` and `assets` retain immutable locations and hashes.

Operational notes:

- Apply migrations to a new database before an application release; do not edit
  an applied migration.
- Run the TypeScript validators before a release reaches `ready`. SQLite cannot
  enforce polymorphic `release_members` or every cross-row publication rule.
- Activate a release by changing `active_releases` in one transaction only after
  validation and signature verification.
- Roll back by moving that pointer to a compatible immutable release. Do not
  delete the rejected release or reuse its ID.
- D1 is the early deployment target. Keep APIs release-scoped so the control
  plane can move to PostgreSQL/PostGIS when measured query needs justify it.
