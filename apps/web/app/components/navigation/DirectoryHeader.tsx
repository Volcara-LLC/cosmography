import Link from "next/link";
import { Orbit } from "lucide-react";

export function DirectoryHeader() {
  return (
    <header className="directory-header">
      <Link className="brand" href="/" aria-label="Return to the interactive universe">
        <span className="brand-mark" aria-hidden="true">
          <Orbit size={20} strokeWidth={1.4} />
        </span>
        <span>
          <strong>COSMOGRAPHY</strong>
          <small>Observable universe atlas</small>
        </span>
      </Link>
      <nav aria-label="Atlas sections">
        <Link href="/">Interactive map</Link>
        <Link href="/atlas">Atlas</Link>
        <Link href="/missions">Missions</Link>
        <Link href="/sources">Sources</Link>
        <Link href="/vision">Vision</Link>
        <Link href="/me">My Atlas</Link>
      </nav>
    </header>
  );
}
