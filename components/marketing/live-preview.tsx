"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useInView } from "framer-motion";

const LiveDashboard = dynamic(
  () => import("./live-dashboard").then((m) => m.LiveDashboard),
  {
    ssr: false,
    loading: () => <div className="h-[460px] rounded-2xl surface-premium" />,
  }
);

export function LivePreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <div ref={ref}>
      {inView ? (
        <LiveDashboard />
      ) : (
        <div className="h-[460px] rounded-2xl surface-premium" />
      )}
    </div>
  );
}