import type { Metadata } from "next";
import { BlackHoleLab } from "@/app/components/relativity/BlackHoleLab";

export const metadata: Metadata = {
  title: "Black-Hole Relativity Lab",
  description:
    "Cosmography's evidence-labeled Kerr-renderer benchmark, analytic reference geometry, and publication gates.",
};

export default function BlackHoleLabPage() {
  return <BlackHoleLab />;
}
