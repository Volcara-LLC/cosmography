# Scientific Integrity Contract

**Status:** proposed foundational contract
**Applies to:** source ingestion, normalized data, derived assets, rendering, timelines, search, tours, exports, offline packs, and community contributions.

## Purpose

Cosmography may simplify an interface, but it must not simplify away what a visual represents. A beautiful scene can combine measured position, derived distance, reconstructed terrain, representative color, predicted motion, and an artistic atmosphere. Scientific accountability therefore belongs to each assertion and representation—not to an object-wide “accurate” badge.

Nothing is publishable unless the viewer can ultimately answer:

- What am I seeing?
- Is it observed, measured, derived, reconstructed, simulated, or artistic?
- From where and when is it seen?
- Which coordinates, origin, frame, epoch, and time scale apply?
- What is uncertain, missing, predicted, interpolated, or exaggerated?
- Which source and processing chain produced it?
- May it legally be displayed and redistributed?

## Public truth labels

Every independently meaningful component or representation receives one evidence-class value and one value from each other applicable axis. A composite layer or scene may contain several components with different labels; its manifest preserves them instead of assigning one misleading scene-wide class.

### Evidence class

| Label | Meaning | Example |
|---|---|---|
| Direct observation | Raw or minimally transformed detector output. | A mission image product with calibration state disclosed. |
| Calibrated observation | Observation corrected through a documented instrument pipeline. | Calibrated FITS radiance or spectrum. |
| Catalog measurement | Published measured or fitted parameters with errors. | Gaia parallax and proper motion. |
| Derived result | Computed from observations using a documented method. | An estimated stellar distance or terrain slope. |
| Scientific reconstruction | An inverse/model-based reconstruction constrained by evidence. | A local 3D dust map or photogrammetric mesh. |
| Physics simulation | Output of declared equations, initial conditions, and parameters. | Kerr lensing or a cosmological simulation snapshot. |
| Artist interpretation | A communicative depiction not claiming an evidence-constrained physical solution. | An exoplanet surface illustration. |

### AI involvement

- None declared
- Assistive processing, with model/tool and human validation disclosed
- Generative output, with model/tool, prompt/process, and review disclosed

AI involvement is a production-method axis, not an evidence class. ML can assist a scientifically valid reconstruction, while generative concept art remains artist interpretation. AI-assisted or generated material is never relabeled as observation, reconstruction, or simulation merely because it appears plausible.

### Time state

- Observed at stated time
- Reconstructed historical state
- Latest published estimate
- Interpolated state
- Predicted state
- Timeless/conceptual representation

### Appearance class

- Calibrated radiometric
- Natural color
- Approximate natural color
- Representative/false color
- Colorized scalar measurement
- Procedural scientific shading
- Cinematic/aesthetic treatment
- Artist texture

### Geometry class

- True scale within stated accuracy
- Logarithmic scale
- Exaggerated size
- Exaggerated elevation
- Display-offset to prevent overlap
- Not to scale

### Freshness

Display the source release, valid/coverage interval, retrieval time, Cosmography publication time, and upstream lag where known. “Real-time” is permitted only for a genuinely live upstream feed with measured latency.

## Required scientific state

Every numeric state or measurement must be capable of carrying:

- value and unit, normalized to SI where practical while retaining the source unit;
- semantic quantity and method;
- coordinate system, axes, center/origin, and reference frame;
- epoch and time scale;
- observer and target, when meaningful;
- aberration and light-time correction;
- spatial and temporal coverage;
- uncertainty type, values, confidence level, and covariance where available;
- quality flags and null reason;
- authoritative source identifier and release;
- source field or product identifier;
- source and local content hashes;
- processing software, version, parameters, and code commit;
- AI involvement state and model/process disclosure where applicable;
- display-only transformations;
- review and supersession state.

Do not replace a source value silently. Conflicting measurements remain independent assertions with citations. A preferred assertion can be selected by an explicit, versioned rule or curator decision.

## Entity and assertion model

The minimum persistent concepts are:

- **Entity:** internal identifier, type, names, authority identifiers, aliases, and entity-resolution evidence.
- **Assertion:** subject, predicate, value/object, unit, validity, uncertainty, method, source, and preference state.
- **Observation:** observatory, instrument, proposal/program, observation ID, time range, band, footprint, calibration, and resolution.
- **Dataset/Product:** publisher, release, identifiers, DOI/bibcode/LIDVID, schema, coverage, and access endpoints.
- **Asset:** original/derivative URLs, MIME/format, size, checksum, creator, credit, rights, and relationship to observations.
- **Event:** event time or interval, location/trajectory context, participants, evidence, and historical confidence.
- **Activity:** transformation or curation action with inputs, agents, software, parameters, outputs, hashes, and review.
- **Representation:** the evidence, time, appearance, and geometry labels that govern what the viewer sees.

Lineage should map to [W3C PROV-O](https://www.w3.org/TR/prov-o/) and the [IVOA Provenance Data Model](https://www.ivoa.net/documents/ProvenanceDM/). Astronomical coordinates and measurements should follow the applicable [IVOA Coordinates](https://www.ivoa.net/documents/Coords/) and [IVOA Measurements](https://www.ivoa.net/documents/Meas/) models.

## Coordinate domains

Cosmography uses several linked domains instead of pretending all space is one scene.

| Domain | Authority/default | Essential context |
|---|---|---|
| Celestial/sky | ICRS/BCRS and FITS WCS | Origin, observer, epoch, passband, footprint, projection. |
| Stellar neighborhood | ICRS astrometry | Reference epoch, TCB, parallax, proper motion, radial velocity, covariance. |
| Solar System | ICRF-compatible SPICE frames | Center, frame, ET/TDB, light-time/aberration, kernel set. |
| Body/global | IAU body-fixed frame/PCK | Body model, radii/datum, longitude direction/domain, latitude type. |
| Surface/local | Projected CRS, DSK, or tangent frame | Projection, horizontal/vertical datum, resolution, no-data, local origin. |
| Earth | ITRF/WGS84 as appropriate | EOP series, observation epoch, geoid/ellipsoid distinction. |
| Cosmological | Declared cosmological model | Redshift type, distance definition, parameters, lookback time, selection effects. |

ICRS defines axes; it does not by itself define every origin. “J2000” is not an acceptable unqualified frame declaration.

### Precision implementation

- Preserve the raw lexical/numeric source representation, stated precision, and uncertainty. Use domain-appropriate computation—normally Float64 or higher/split representations where required—without claiming more precision than the source.
- Represent high-precision time with an appropriate split epoch, integer-plus-fraction, or domain library type rather than assuming one binary floating-point value is sufficient.
- Use camera-relative coordinates or high/low splitting for GPU transfer.
- Rebase origins at semantic boundaries.
- Keep physical coordinates separate from logarithmic mapping, icon offsets, or size exaggeration.
- Transition between sky, galaxy, Solar-System, body, and local scene graphs through explicit, tested transforms.
- Treat 3D Tiles geographic region bounds as Earth/WGS84-specific; non-Earth bodies require body-fixed bounding volumes and transforms.

## Time and observer semantics

UTC is a display/input scale, not the only computational time. Depending on the domain, calculations may require TAI, TT, TDB/ET, TCB, UT1, leap seconds, spacecraft clock correlation, and Earth-orientation parameters.

The user must be able to distinguish:

1. **Geometric state at epoch:** a simultaneous coordinate state, such as SPICE with no aberration correction.
2. **Appearance to an observer:** the retarded state whose light reaches the observer at the selected reception time, with declared correction such as light time and stellar aberration.
3. **Published catalog state:** parameters referred to a catalog epoch and propagated only when the required motion information permits it.

The timeline stores at least event time, observation time, validity interval, source publication time, ingestion time, and Cosmography publication time. Those fields are not interchangeable.

## Mission replay manifest

A reproducible mission scene freezes:

- SPK trajectory kernels;
- CK attitude kernels;
- SCLK spacecraft clock kernels;
- LSK leap-second kernels;
- FK reference frames;
- IK instrument geometry and fields of view;
- PCK body orientation/shape;
- DSK detailed shapes when used;
- meta-kernel load order;
- source URLs, filenames, sizes, SHA-256 hashes, coverage intervals, and retrieval dates;
- all query parameters and renderer transforms.

The newest kernel is not automatically the correct kernel. Predicted and reconstructed kernels must be distinguishable. Never interpolate across an unexplained coverage gap.

## Domain-specific rules

### Stars and catalogs

Treat astrometry as measurements with covariance. Do not make permanent 3D points from source IDs alone. Preserve release, reference epoch, parallax, proper motions, radial velocity, correlations, quality flags, and distance method. Do not use reciprocal parallax blindly for weak or negative parallaxes. If missing radial velocity is assumed to be zero during propagation, disclose it.

### Planetary terrain

Preserve body radii/datum, planetocentric versus planetographic latitude, longitude direction and domain, projection, vertical datum/unit, no-data, spatial resolution, observation dates, control-network status, and interpolation. Elevation exaggeration defaults to 1× and is always visible when changed.

Geometry levels are explicitly identified:

1. reference ellipsoid/triaxial body;
2. controlled global DEM/mosaic;
3. regional DTM;
4. local photogrammetric/rover mesh or DSK.

### Sky imagery

Keep the scientific master in FITS with WCS and derive progressive HiPS/tiles for viewing. Preserve bandpass, units, calibration, exposure, PSF, observation epoch, WCS, color mapping, and lineage. A deep-field image is positioned on the observer's celestial sphere or light cone—not placed at an invented single 3D distance.

### Spacecraft images

Place an image at a physical camera frustum only when timing, CK attitude, IK instrument geometry, target shape, and applicable frame transforms support it. Otherwise show it as a timeline/media artifact and state why spatial placement is approximate.

### Atmospheres and surfaces

Standard metallic-roughness PBR is not a scientific radiometric model for every regolith, gas giant, star, or plasma. A science mode uses calibrated data or documented body-specific photometry and scattering. A cinematic mode can add bloom, fog, clouds, or stylized lighting but keeps its label visible.

### Black holes

The reference benchmark is the peer-reviewed [DNGR Kerr ray-tracing work](https://doi.org/10.1088/0264-9381/32/6/065001), not a claim that every *Interstellar* film frame is an observation or uniquely correct depiction.

Implementation levels:

- **BH1:** vacuum Kerr null-geodesic lensing plus a labeled analytic toy disk;
- **BH2:** general-relativistic radiative transfer with parameterized emission and absorption;
- **BH3:** an ensemble of GRMHD plus ray-transfer models with wavelength, electron model, mass, spin, inclination, exposure, and uncertainty exposed.

Validate analytic limits, conserved quantities, symmetry, frequency shifts, pixel convergence, and selected scenes against an independent implementation such as [GYOTO](https://gyoto.obspm.fr/). Do not draw an event horizon as a textured solid sphere or wrap an Event Horizon Telescope reconstruction around one.

### Nebulae, galaxies, and the cosmic web

Default to observed sky projection when reliable depth is unavailable. Volumes are labeled as tomography/reconstruction, simulation, or illustrative extrusion. Redshift-space visualizations state distance conversion, cosmological parameters, peculiar-velocity limitations, selection functions, and lookback time. A cosmological light cone is not a simultaneous Euclidean snapshot. The CMB is a last-scattering-surface observation, not a hard present-day boundary texture.

## Internal quality tiers

| Tier | Publication meaning |
|---|---|
| T0 Illustrative | No metric claim; prominent interpretation label. |
| T1 Data-anchored | Coordinates/parameters trace to a source; appearance may remain procedural. |
| T2 Scientific reconstruction | Calibrated inputs or documented physical/inverse model; uncertainty represented. |
| T3 Reproducible reference | Frozen inputs and transforms, formal coverage/error context, automated tests, independent validation, and domain review. |

T3 means reproducible within declared evidence and model limits. It does not mean absolute truth.

## Publication gates

No public layer ships without:

- complete truth labels;
- source/release/product identifiers and access links;
- coordinate/frame/time/unit context;
- uncertainty or an explicit reason it is unavailable;
- original and derived hashes;
- processing and rendering lineage;
- rights and exact attribution;
- automated schema/range/coverage checks;
- scientific review appropriate to its quality tier;
- a rollback-capable versioned manifest.

The system fails closed when required rights, lineage, or representation fields are absent.

## Validation suite

- Compare sampled SPICE states with Horizons across epochs, frames, observers, and corrections.
- Test SOFA/IERS reference vectors, time conversions, leap-second boundaries, EOP changes, and kernel coverage edges.
- Test stellar epoch propagation and covariance with an independent library and Monte Carlo samples.
- Test terrain control points, landmarks, seams, poles, antimeridian, datums, and DSK ray intersections.
- Round-trip FITS WCS pixels and sky coordinates; validate HiPS and MOC footprints.
- Compare illumination angles with SPICE and retain numeric buffers, not only screenshots.
- Test black-hole analytic limits, cross-code reference scenes, and resolution convergence.
- Automatically reject any published object without a dataset passport and required labels.
- Require domain-scientist review for flagship experiences and publish the validation report.
