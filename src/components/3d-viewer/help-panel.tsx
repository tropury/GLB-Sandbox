"use client";

import { useState } from "react";
import { useViewerStore } from "./store";
import {
  Moon,
  Sun,
  RotateCw,
  Move,
  MousePointer2,
  View,
  Camera,
} from "lucide-react";
import { useAR } from "./ar/useAR";
import { getARSupportInfo } from "./ar/device-detection";

export default function HelpPanel() {
  const { isDark, toggleDark } = useViewerStore();
  const ar = useAR();

  // Get AR support info once on mount
  const [arInfo] = useState(() => getARSupportInfo());

  // Screenshot handler
  const handleScreenshot = () => {
    const success = ar.screenshot();
    if (!success) {
      alert("Could not capture screenshot. Please try again.");
    }
  };

  // AR button tooltip text
  const arTooltip = arInfo.supported
    ? arInfo.method === "quick-look"
      ? "View in AR (Quick Look)"
      : arInfo.method === "scene-viewer"
        ? "View in AR (Scene Viewer)"
        : "View in AR (WebXR)"
    : "AR requires Safari on iOS or Chrome on Android";

  return (
    <div
      className="absolute top-5 right-5 z-20 flex flex-col gap-2.5 p-2.5 rounded-xl backdrop-blur-md transition-all duration-700"
      style={{
        background: "var(--viewer-bar-bg)",
      }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleDark}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
        style={{ opacity: 0.8 }}
        title={isDark ? "Light Mode" : "Dark Mode"}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Sun size={20} className="text-amber-300" />
        ) : (
          <Moon size={20} className="text-gray-600" />
        )}
      </button>

      {/* Screenshot button — always available */}
      <button
        onClick={handleScreenshot}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
        style={{ opacity: 0.8 }}
        title="Capture Screenshot (PNG)"
        aria-label="Capture screenshot"
      >
        <Camera size={20} className="text-blue-500" />
      </button>

      {/* AR button — only on supported mobile devices */}
      {arInfo.supported && (
        <button
          onClick={() => ar.launch("/sofa.glb", { title: "3D Sofa" })}
          disabled={ar.loading}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer disabled:opacity-50"
          style={{ opacity: 0.8 }}
          title={ar.loading ? ar.loadingMessage : arTooltip}
          aria-label="View in AR"
        >
          {ar.loading ? (
            <svg
              className="animate-spin text-emerald-500"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <View size={20} className="text-emerald-500" />
          )}
        </button>
      )}

      {/* AR loading overlay — shows progress during USDZ/GLB export */}
      {ar.loading && ar.loadingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl backdrop-blur-md shadow-xl"
            style={{
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
            }}
          >
            <svg
              className="animate-spin text-emerald-400"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            <span className="text-sm font-medium tracking-wide">
              {ar.loadingMessage}
            </span>
          </div>
        </div>
      )}

      {/* Help items - hidden on mobile */}
      <div className="hidden md:flex flex-col gap-2.5">
        <div
          className="flex items-center gap-2.5 transition-all duration-200 hover:translate-x-[-2px]"
          style={{ opacity: 0.85 }}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg">
            <RotateCw size={18} className="text-gray-500 dark:text-gray-400" />
          </div>
          <span
            className="text-xs font-medium whitespace-nowrap transition-colors duration-700"
            style={{ color: "var(--viewer-text)" }}
          >
            Drag to Orbit
          </span>
        </div>

        <div
          className="flex items-center gap-2.5 transition-all duration-200 hover:translate-x-[-2px]"
          style={{ opacity: 0.85 }}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg">
            <Move size={18} className="text-gray-500 dark:text-gray-400" />
          </div>
          <span
            className="text-xs font-medium whitespace-nowrap transition-colors duration-700"
            style={{ color: "var(--viewer-text)" }}
          >
            Scroll to Zoom
          </span>
        </div>

        <div
          className="flex items-center gap-2.5 transition-all duration-200 hover:translate-x-[-2px]"
          style={{ opacity: 0.85 }}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg">
            <MousePointer2
              size={18}
              className="text-gray-500 dark:text-gray-400"
            />
          </div>
          <span
            className="text-xs font-medium whitespace-nowrap transition-colors duration-700"
            style={{ color: "var(--viewer-text)" }}
          >
            Click & Drag
          </span>
        </div>
      </div>
    </div>
  );
}
