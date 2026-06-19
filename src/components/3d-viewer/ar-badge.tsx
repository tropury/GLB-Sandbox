"use client";

import { useState } from "react";
import { getARSupportInfo, type ARMethod } from "./ar/device-detection";

/**
 * AR Compatibility Badge
 * Shows which AR method is supported on this device:
 *  - iOS → "Quick Look"
 *  - Android Chrome → "Scene Viewer"
 *  - Firefox Android → "WebXR"
 *  - Desktop → hidden
 */
export default function ARBadge() {
  // Lazy initializer — runs once on client mount (SSR returns null safely)
  const [info] = useState<{
    supported: boolean;
    method: ARMethod;
    platform: string;
    browser: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    return getARSupportInfo();
  });

  // Hide on desktop or unsupported devices
  if (!info || !info.supported) return null;

  const label =
    info.method === "quick-look"
      ? "AR Quick Look"
      : info.method === "scene-viewer"
        ? "Scene Viewer"
        : "WebXR AR";

  return (
    <div
      className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md transition-all duration-700"
      style={{
        background: "var(--viewer-bar-bg)",
      }}
    >
      <span
        className="relative flex h-2 w-2"
        title={`${label} supported on ${info.platform} (${info.browser})`}
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span
        className="text-[10px] font-bold tracking-wider uppercase transition-colors duration-700"
        style={{ color: "var(--viewer-text)" }}
      >
        {label}
      </span>
    </div>
  );
}
