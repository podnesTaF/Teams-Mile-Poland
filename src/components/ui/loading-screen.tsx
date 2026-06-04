import { Loader } from "./loader";

/**
 * Full-screen branded loading state. Used as the route-level `loading.tsx`
 * fallback while a page's server work (DB reads, translations) streams in.
 */
export function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <Loader size={132} />
    </div>
  );
}
