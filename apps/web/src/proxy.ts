import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";

const isSignIn = createRouteMatcher(["/signin"]);

// Convenience redirects only. Real access control is enforced in every Convex function.
export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const signedIn = await convexAuth.isAuthenticated();
  if (isSignIn(request) && signedIn) return nextjsMiddlewareRedirect(request, "/");
  if (!isSignIn(request) && !signedIn) return nextjsMiddlewareRedirect(request, "/signin");
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
