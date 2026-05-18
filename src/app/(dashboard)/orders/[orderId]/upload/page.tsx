"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Upload, X, CheckCircle2, FileText, Info } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import { MOCK_CREDITS } from "@/lib/mock-data";

interface UploadedFile { name: string; size: string }

function UploadScreen({ orderId }: { orderId: string }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const creditId     = searchParams.get("credit_id") ?? "credit_ltc5";
  const isGapAnalysis= searchParams.get("type") === "gap-analysis";

  const credit = isGapAnalysis ? null : MOCK_CREDITS.find((c) => c.id === creditId) ?? MOCK_CREDITS[0];
  const requiredDocs  = credit?.required_customer_documents ?? [
    { text: "Project drawings (site plan, floor plans)" },
    { text: "Current project specifications" },
    { text: "Geotechnical or site assessment report" },
    { text: "Mechanical / HVAC system narrative" },
    { text: "Landscape plan or site coverage diagram" },
  ];

  const [files,       setFiles]       = useState<UploadedFile[]>([]);
  const [dragOver,    setDragOver]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  function addFile(file: File) {
    const sizeKB = (file.size / 1024).toFixed(0);
    setFiles((prev) => [...prev, { name: file.name, size: `${sizeKB} KB` }]);
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    router.push(`/orders/${orderId}/processing`);
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={1} />
        </div>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Upload your documents</h1>
        <p className="text-certify-cool-grey mb-1">Order #{orderId.slice(-6).toUpperCase()}</p>
        {credit && (
          <p className="text-sm font-semibold text-certify-deep mb-6">{credit.credit_code}: {credit.credit_name}</p>
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
            Array.from(e.dataTransfer.files).forEach(addFile);
          }}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center mb-5 transition-all duration-200 ${
            dragOver ? "border-certify-blue bg-certify-blue/5" : "border-certify-cool-grey/25 hover:border-certify-blue/40"
          }`}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => { Array.from(e.target.files ?? []).forEach(addFile); }}
          />
          <div className="w-12 h-12 rounded-2xl bg-certify-blue/10 flex items-center justify-center mx-auto mb-3">
            <Upload size={22} className="text-certify-blue" />
          </div>
          <p className="font-semibold text-certify-deep mb-1 text-sm">Drop files here or click to browse</p>
          <p className="text-xs text-certify-cool-grey">PDF, DOCX, XLSX, JPG, PNG up to 25 MB each</p>
        </div>

        {/* Uploaded files */}
        {files.length > 0 && (
          <div className="bg-white border border-certify-white rounded-2xl shadow-card p-4 mb-5 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-certify-blue/10 flex items-center justify-center">
                  <FileText size={14} className="text-certify-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-certify-deep truncate">{f.name}</p>
                  <p className="text-xs text-certify-cool-grey">{f.size}</p>
                </div>
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                  <X size={14} className="text-certify-cool-grey hover:text-certify-deep transition-colors" />
                </button>
              </div>
            ))}
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
                  <div>
                    <span className={`text-xs leading-relaxed ${uploaded ? "text-certify-teal" : "text-certify-cool-grey"}`}>{doc.text}</span>
                    {doc.condition && (
                      <p className="text-[10px] text-certify-sand mt-0.5">{doc.condition}</p>
                    )}
                  </div>
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

        <button
          onClick={handleSubmit}
          disabled={files.length === 0 || submitting}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          {submitting ? (
            <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>
          ) : `Submit ${files.length} file${files.length !== 1 ? "s" : ""} for processing`}
        </button>
        {files.length === 0 && (
          <p className="text-center text-xs text-certify-cool-grey mt-2">Upload at least one file to continue</p>
        )}
      </div>
    </div>
  );
}

export default function UploadPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-certify-white flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-certify-blue border-t-transparent rounded-full" /></div>}>
      <UploadScreen orderId={orderId} />
    </Suspense>
  );
}
