"use client";

import dynamic from "next/dynamic";

const DevNav = dynamic(() => import("./DevNav"), { ssr: false });

export default function DevNavLoader() {
  return <DevNav />;
}
