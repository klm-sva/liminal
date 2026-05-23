"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient()!;
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
    >
      <LogOut size={12} />
      Sign out
    </button>
  );
}
