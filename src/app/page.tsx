"use client";

import dynamic from "next/dynamic";

const TimeDateApp = dynamic(() => import("@/components/TimeDateApp"), { ssr: false });

export default function Home() {
  return <TimeDateApp />;
}
