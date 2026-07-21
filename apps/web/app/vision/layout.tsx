import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Project Vision and Build Status",
  description:
    "What Cosmography is building, what already works, what remains, and how the living universe atlas reaches its final vision.",
};

export default function ProjectVisionLayout({ children }: { children: ReactNode }) {
  return children;
}
