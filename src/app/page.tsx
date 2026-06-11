"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import MaterialToolbar from "@/components/3d-viewer/toolbar";
import HelpPanel from "@/components/3d-viewer/help-panel";
import { useViewerStore } from "@/components/3d-viewer/store";

const Scene = dynamic(() => import("@/components/3d-viewer/scene"), {
  ssr: false,
});

export default function Home() {
  const isDark = useViewerStore((s) => s.isDark);

  // Apply CSS variables based on theme
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.style.setProperty("--viewer-bg", "#212425");
      root.style.setProperty("--viewer-text", "#f2f2f2");
      root.style.setProperty("--viewer-bar-bg", "rgba(40,40,40,0.35)");
      root.style.setProperty("--viewer-selected-border", "rgba(255,255,255,0.7)");
    } else {
      root.style.setProperty("--viewer-bg", "#f2f2f2");
      root.style.setProperty("--viewer-text", "#2a2a2a");
      root.style.setProperty("--viewer-bar-bg", "rgba(255,255,255,0.26)");
      root.style.setProperty("--viewer-selected-border", "rgba(0,0,0,0.5)");
    }
  }, [isDark]);

  return (
    <main
      className="fixed inset-0 overflow-hidden transition-colors duration-700"
      style={{ background: "var(--viewer-bg)" }}
    >
      {/* Vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            "radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* DOF fake overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          backdropFilter: "blur(1.5px)",
          WebkitMaskImage:
            "radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0) 55%, rgba(0,0,0,0) 100%)",
          maskImage:
            "radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0) 55%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* 3D Scene */}
      <Scene />

      {/* Help panel and theme toggle */}
      <HelpPanel />

      {/* Material toolbar */}
      <MaterialToolbar />

      {/* Brand */}
      <div
        className="absolute top-5 left-5 z-20 flex items-center gap-2 transition-colors duration-700"
        style={{ color: "var(--viewer-text)" }}
      >
        <span className="text-sm font-bold tracking-widest uppercase opacity-60">
          Web3D
        </span>
      </div>
    </main>
  );
}
