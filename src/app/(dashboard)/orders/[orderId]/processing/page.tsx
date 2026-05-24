import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";

export default async function ProcessingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={2} />
        </div>

        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-full bg-certify-sage/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-certify-sage" />
          </div>
        </div>

        <h1 className="font-serif text-3xl text-certify-deep text-center mb-3">
          Submission received
        </h1>
        <p className="text-certify-cool-grey text-center text-sm mb-2">
          Order #{orderId.slice(-6).toUpperCase()}
        </p>
        <p className="text-certify-cool-grey text-center text-sm leading-relaxed mb-10">
          Your submission is being processed. You will receive an email when your output is ready.
        </p>

        <Link
          href="/dashboard"
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
