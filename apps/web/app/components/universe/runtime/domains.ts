import type { ScaleDomain } from "@/app/lib/science/scene";
import type { DomainBuilder } from "@/app/components/universe/runtime/types";

export async function loadDomainBuilder(
  domain: ScaleDomain,
): Promise<DomainBuilder> {
  switch (domain) {
    case "lightcone":
    case "extragalactic": {
      const domainModule = await import(
        "@/app/components/universe/runtime/domains/cosmic"
      );
      return domainModule.createCosmicBuilder(domain);
    }
    case "galactic": {
      const domainModule = await import(
        "@/app/components/universe/runtime/domains/galactic"
      );
      return domainModule.buildDomain;
    }
    case "system": {
      const domainModule = await import(
        "@/app/components/universe/runtime/domains/system"
      );
      return domainModule.buildDomain;
    }
    case "globe": {
      const domainModule = await import(
        "@/app/components/universe/runtime/domains/globe"
      );
      return domainModule.buildDomain;
    }
    case "surface":
    case "panorama": {
      const domainModule = await import(
        "@/app/components/universe/runtime/domains/surface"
      );
      return domainModule.createSurfaceBuilder(domain);
    }
    case "simulation": {
      const domainModule = await import(
        "@/app/components/universe/runtime/domains/relativity"
      );
      return domainModule.buildDomain;
    }
  }
}
