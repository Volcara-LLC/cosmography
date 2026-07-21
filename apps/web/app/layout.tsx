import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cosmography.ai"),
  title: {
    default: "Cosmography · Observable Universe Atlas",
    template: "%s · Cosmography",
  },
  description:
    "A living, explorable map of humanity's measured and reconstructed knowledge of the universe.",
  applicationName: "Cosmography",
  category: "science",
  keywords: [
    "universe map",
    "space exploration",
    "astronomy",
    "planetary science",
    "mission atlas",
  ],
  openGraph: {
    type: "website",
    siteName: "Cosmography",
    title: "Cosmography · Explore the Observable Universe",
    description:
      "From the observable universe to recorded footsteps on other worlds.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f7f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
