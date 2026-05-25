"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, CheckCircle2, FileText, Info } from "lucide-react";
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";
import StepProgress from "@/components/ui/StepProgress";

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

interface Props {
  orderId:            string;
  creditCode?:        string;
  creditName?:        string;
  requiredDocs:       string[];
  reviewIssues?:      string[];
  isGapAnalysis:      boolean;
  hasPreviousOrders?: boolean;
}

export default function UploadClient({ orderId, creditCode, creditName, requiredDocs, reviewIssues = [], isGapAnalysis, hasPreviousOrders }: Props) {
  const router = useRouter();
  const [files,        setFiles]        = useState<File[]>([]);
  const [dragOver,     setDragOver]     = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [error,        setError]        = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function callReady(): Promise<boolean> {
    setIsSubmitting(true);
    try {
      const res  = await fetch(`/api/orders/${orderId}/ready`, { method: "POST" });
      const data = await res.json() as { error?: string; status?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to submit order. Please try again.");
        return false;
      }

      return true;
    } catch {
      setError("Failed to submit order. Please try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  const { startUpload, isUploading } = useUploadThing("creditDocument", {
    headers:              { "x-order-id": orderId },
    uploadProgressGranularity: "fine",
    onUploadProgress:     (p) => setProgress(p),
    onClientUploadComplete: async () => {
      // Consolidate upload: one email + accurate path list on the run
      await fetch(`/api/orders/${orderId}/confirm-upload`, { method: "POST" }).catch(() => null);
      const ok = await callReady();
      if (ok) router.push(`/orders/${orderId}/processing`);
    },
    onUploadError: (err) => {
      setError(err.message ?? "Upload failed. Please try again.");
      setProgress(0);
    },
  });

  function addFiles(incoming: File[]) {
    setFiles((prev) => [...prev, ...incoming]);
    setError(null);
  }

  async function handleSubmit() {
    if (isUploading || isSubmitting) return;
    setError(null);

    if (files.length === 0) {
      const ok = await callReady();
      if (ok) router.push(`/orders/${orderId}/processing`);
      return;
    }

    setProgress(0);
    await startUpload(files);
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={1} />
        </div>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Upload your documents</h1>
        <p className="text-certify-cool-grey mb-1">Order #{orderId.slice(-6).toUpperCase()}</p>
        {!isGapAnalysis && creditCode && (
          <p className="text-sm font-semibold text-certify-deep mb-6">{creditCode}: {creditName}</p>
        )}

        {/* Review issues from previous submission */}
        {reviewIssues.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">Additional documents needed</p>
            <ul className="space-y-1">
              {reviewIssues.map((issue, i) => (
                <li key={i} className="text-xs text-red-700 leading-relaxed">• {issue}</li>
              ))}
            </ul>
            <p className="text-xs text-red-600 mt-3">Please upload the missing items and resubmit.</p>
          </div>
        )}

        {/* Upload guidance note */}
        <div className="bg-certify-sand/15 border border-certify-sand/40 rounded-2xl px-5 py-4 mb-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-certify-dark-grey">Important</p>
          <p className="text-xs text-certify-dark-grey leading-relaxed">
            The quality of your uploaded documents directly impacts the quality of the output. Incomplete or difficult to read documents will compromise the result.
          </p>
          <p className="text-xs text-certify-dark-grey leading-relaxed">
            Upload only the documents listed below. Do not upload complete drawing sets. Too much information can reduce output quality.
          </p>
          <p className="text-xs text-certify-dark-grey leading-relaxed">
            Individual files are limited to 25 MB. The total upload per credit order is limited to 100 MB.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center mb-5 transition-all duration-200 ${
            isUploading
              ? "border-certify-blue/40 bg-certify-blue/5 pointer-events-none"
              : dragOver
              ? "border-certify-blue bg-certify-blue/5"
              : "border-certify-cool-grey/25 hover:border-certify-blue/40"
          }`}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
            disabled={isUploading}
            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          <div className="w-12 h-12 rounded-2xl bg-certify-blue/10 flex items-center justify-center mx-auto mb-3">
            <Upload size={22} className="text-certify-blue" />
          </div>
          <p className="font-semibold text-certify-deep mb-1 text-sm">Drop files here or click to browse</p>
          <p className="text-xs text-certify-cool-grey">PDF, DOCX, XLSX, JPG, PNG up to 25 MB each</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-white border border-certify-white rounded-2xl shadow-card p-4 mb-5 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center">
                  <FileText size={14} className="text-certify-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-certify-deep truncate">{f.name}</p>
                  <p className="text-xs text-certify-cool-grey">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                {!isUploading && (
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <X size={14} className="text-certify-cool-grey hover:text-certify-deep transition-colors" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload progress bar */}
        {isUploading && (
          <div className="mb-5">
            <div className="flex justify-between text-xs text-certify-cool-grey mb-1.5">
              <span>Uploading…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-certify-white rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
              />
            </div>
          </div>
        )}

        {/* Previous orders note */}
        {hasPreviousOrders && !isGapAnalysis && (
          <div className="flex items-start gap-2.5 bg-certify-blue/5 border border-certify-blue/15 rounded-xl px-4 py-3 mb-5">
            <Info size={14} className="text-certify-blue shrink-0 mt-0.5" />
            <p className="text-xs text-certify-deep leading-relaxed">
              <span className="font-semibold">Previous orders on this project</span> — Documents submitted for earlier credits on this project may already be available. Upload only the documents required for this specific credit.
            </p>
          </div>
        )}

        {/* Document checklist */}
        <div className="bg-certify-beige border border-certify-sand/30 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-certify-dark-grey mb-3">Required documents checklist</p>
          <ul className="space-y-2">
            {requiredDocs.map((doc, i) => {
              const uploaded = i < files.length;
              return (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className={`shrink-0 mt-0.5 ${uploaded ? "text-certify-sage" : "text-certify-cool-grey/30"}`} />
                  <span className={`text-xs leading-relaxed ${uploaded ? "text-certify-teal" : "text-certify-cool-grey"}`}>{doc}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2.5 bg-certify-white border border-certify-cool-grey/20 rounded-xl px-4 py-3 mb-6">
          <Info size={14} className="text-certify-cool-grey shrink-0 mt-0.5" />
          <p className="text-xs text-certify-cool-grey leading-relaxed">
            Liminal produces output based exclusively on the files and information you provide. The quality of the output depends entirely on the quality of the information you provide. We will provide feedback on any outstanding issues and allow you to upload additional information before processing.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-red-700 whitespace-pre-line">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isUploading || isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Uploading {progress}%…
            </>
          ) : isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Submitting…
            </>
          ) : files.length === 0
            ? "Proceed to processing"
            : `Submit ${files.length} file${files.length !== 1 ? "s" : ""} for processing`
          }
        </button>
      </div>
    </div>
  );
}
