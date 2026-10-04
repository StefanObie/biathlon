import { updateSession } from "@/lib/supabase/proxy";
import { ORGANIZATION_COOKIE } from "@/lib/organizations/landing";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // Visiting any page of an Organization remembers it, for where bare
  // /organizations and /leagues land next time. Server Components can't set
  // cookies, so it's done here.
  const visited = request.nextUrl.pathname.match(
    /^\/organizations\/(\d+)(?:\/|$)/,
  );
  if (visited && !response.headers.has("location")) {
    response.cookies.set(ORGANIZATION_COOKIE, visited[1], {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
