"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoSubmit({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/orders/${orderId}/ready`, { method: "POST" })
      .catch(() => null)
      .finally(() => router.push(`/orders/${orderId}/processing`));
  }, [orderId, router]);

  return (
    <div className="min-h-screen bg-certify-white flex items-center justify-center">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-certify-blue/20" />
        <div className="absolute inset-0 rounded-full border-4 border-certify-blue border-t-transparent animate-spin" />
      </div>
    </div>
  );
}
