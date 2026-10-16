"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OtpForm({ email }: { email: string }) {
  const router = useRouter();
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Auth service not configured");
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type:  "email",
      });
      if (verifyError) throw verifyError;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "That code didn't work. Check it and try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="mb-6 p-5 text-left"
      style={{
        borderRadius: "14px",
        background: "#fff",
        border: "1px solid rgba(56,143,166,0.18)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(43,64,68,0.55)" }}>
        Link not working?
      </p>
      <p className="text-sm leading-relaxed mb-4" style={{ color: "#7a8f94" }}>
        Enter the 8-digit code from the same email instead.
      </p>

      {error && (
        <div
          className="mb-4 px-3 py-2 text-xs"
          style={{
            borderRadius: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="12345678"
          className="flex-1 outline-none transition-all text-center text-lg tracking-[0.3em] font-semibold"
          style={{
            borderRadius: "10px",
            border: "1px solid rgba(43,64,68,0.14)",
            background: "#fafbfc",
            padding: "10px 12px",
            color: "#2b4044",
          }}
        />
        <button
          type="submit"
          disabled={loading || code.length !== 8}
          className="text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderRadius: "10px",
            background: "linear-gradient(135deg, #388fa6, #1c5e70)",
            padding: "10px 20px",
          }}
        >
          {loading ? "..." : "Verify"}
        </button>
      </form>
    </div>
  );
}
