import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Must reassign inside setAll so refreshed session cookies propagate
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // First write cookies back onto the request so subsequent getAll() sees them
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Then rebuild the response so Set-Cookie headers go to the browser
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT server-side — more reliable than getSession() in middleware
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect admin routes — only reviews@liminalsva.com
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (user.email !== "reviews@liminalsva.com") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return supabaseResponse;
  }

  // Protect all authenticated routes: unauthenticated → login
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/feedback");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect already-logged-in users away from auth pages
  if (user && (pathname === "/signup" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/signup", "/login", "/dashboard/:path*", "/orders/:path*", "/projects/:path*", "/feedback/:path*", "/admin/:path*"],
};
