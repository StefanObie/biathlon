const BASE = "http://this-site.invalid";

/**
 * Where to go after signing in, from a `next` parameter: a path on this
 * site, or null. Anything that would leave the site (another origin, a
 * protocol-relative `//host`, a backslash trick) is refused, so a crafted
 * sign-in link can't redirect someone elsewhere.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  // Parse it the way a browser would, so stripped tabs or backslashes that
  // turn it into another host are caught too.
  const url = new URL(next, BASE);
  if (url.origin !== BASE) return null;
  // Dot segments can collapse "/..//host" into "//host", which a browser
  // reads as another site, so check the path that comes out too.
  const path = url.pathname + url.search + url.hash;
  return path.startsWith("//") || path.startsWith("/\\") ? null : path;
}
