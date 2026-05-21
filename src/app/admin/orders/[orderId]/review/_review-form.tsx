"use client";

import { useState } from "react";

export default function ReviewForm({
  orderId,
  token,
}: {
  orderId: string;
  token: string;
}) {
  const [instructions, setInstructions] = useState("");
  const [loading,      setLoading]      = useState<"approve" | "changes" | null>(null);
  const [message,      setMessage]      = useState<{ text: string; ok: boolean } | null>(null);

  async function handleApprove() {
    setLoading("approve");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/approve?token=${encodeURIComponent(token)}`);
      const text = await res.text();
      if (res.ok) {
        setMessage({ text: "Approved. Output will deliver at the scheduled time.", ok: true });
      } else {
        setMessage({ text: `Error: ${text}`, ok: false });
      }
    } catch (e) {
      setMessage({ text: `Error: ${(e as Error).message}`, ok: false });
    } finally {
      setLoading(null);
    }
  }

  async function handleSubmitChanges() {
    if (!instructions.trim()) {
      setMessage({ text: "Please enter change instructions.", ok: false });
      return;
    }
    setLoading("changes");
    setMessage(null);
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}/request-changes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, instructions: instructions.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "Changes submitted. Pipeline is regenerating output. A new QA review email will arrive shortly.", ok: true });
        setInstructions("");
      } else {
        setMessage({ text: `Error: ${data.error ?? "Unknown error"}`, ok: false });
      }
    } catch (e) {
      setMessage({ text: `Error: ${(e as Error).message}`, ok: false });
    } finally {
      setLoading(null);
    }
  }

  return (
    <section style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: "20px", marginBottom: 24 }}>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Actions</h2>

      {message && (
        <div style={{
          padding:       "12px 16px",
          borderRadius:  4,
          marginBottom:  16,
          background:    message.ok ? "#e8f5e9" : "#fdecea",
          color:         message.ok ? "#2e7d32" : "#c62828",
          fontSize:      14,
        }}>
          {message.text}
        </div>
      )}

      {/* Approve */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          style={{
            padding:       "10px 24px",
            background:    "#27ae60",
            color:         "#fff",
            border:        "none",
            borderRadius:  6,
            fontWeight:    700,
            fontSize:      15,
            cursor:        loading ? "not-allowed" : "pointer",
            opacity:       loading ? 0.6 : 1,
          }}
        >
          {loading === "approve" ? "Approving…" : "Approve"}
        </button>
        <span style={{ marginLeft: 12, fontSize: 13, color: "#888" }}>
          Output will be delivered to the customer at the scheduled time.
        </span>
      </div>

      {/* Request changes */}
      <div>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          Request Changes
        </label>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#666" }}>
          Type your instructions in plain English — the same as you would tell Claude Code.
          The pipeline will regenerate the output and send a new QA review email.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          placeholder="e.g. The walking distance calculation in section 3 is using the wrong baseline. Change it to use 0.5 miles instead of 0.25 miles throughout the document..."
          style={{
            width:       "100%",
            boxSizing:   "border-box",
            padding:     "10px 12px",
            border:      "1px solid #ccc",
            borderRadius: 4,
            fontSize:    14,
            fontFamily:  "monospace",
            resize:      "vertical",
          }}
        />
        <button
          onClick={handleSubmitChanges}
          disabled={loading !== null}
          style={{
            marginTop:    10,
            padding:      "10px 24px",
            background:   "#e67e22",
            color:        "#fff",
            border:       "none",
            borderRadius: 6,
            fontWeight:   700,
            fontSize:     15,
            cursor:       loading ? "not-allowed" : "pointer",
            opacity:      loading ? 0.6 : 1,
          }}
        >
          {loading === "changes" ? "Submitting… (pipeline running, may take a few minutes)" : "Submit Changes"}
        </button>
      </div>
    </section>
  );
}
