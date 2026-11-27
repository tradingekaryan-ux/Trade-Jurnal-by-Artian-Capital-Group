import { NextResponse, type NextRequest } from "next/server";

/** Navigation guard. Cryptographic verification happens in the API handlers. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/ranking",
  "/api/auth",
  "/api/register",
  "/api/ranking",
  "/api/quotes",
]);

export const middleware = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  const cookie = request.cookies.get("tj_session")?.value;
  if (!cookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
