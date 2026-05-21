import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/resend";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Send welcome email for new signups (created_at within last 60 seconds)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const serviceClient = await createServiceClient();
          const { data: customer } = await serviceClient
            .from("customers")
            .select("email, name, created_at")
            .eq("id", user.id)
            .single();

          if (customer) {
            const ageMs = Date.now() - new Date(customer.created_at).getTime();
            if (ageMs < 60_000) {
              await sendWelcomeEmail({
                to:   customer.email,
                name: customer.name ?? "there",
              });
            }
          }
        }
      } catch (e) {
        console.error("[auth/callback] Welcome email failed:", e);
      }

      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
}
