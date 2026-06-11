"use client";

import { useState } from "react";
import { useViewerStore } from "./store";
import { Moon, Sun, RotateCw, Move, MousePointer2, View } from "lucide-react";

function getIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
      navigator.userAgent
    ) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function HelpPanel() {
  const { isDark, toggleDark } = useViewerStore();
  const [isMobile] = useState(getIsMobile);

  const handleAR = () => {
    const event = new CustomEvent("enter-ar");
    window.dispatchEvent(event);
  };

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
      >
        {isDark ? (
          <Sun size={20} className="text-amber-300" />
        ) : (
          <Moon size={20} className="text-gray-600" />
        )}
      </button>

      {/* AR button - shown on all devices */}
      <button
        onClick={handleAR}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
        style={{ opacity: 0.8 }}
        title={
          isMobile
            ? "View in AR"
            : "AR requires a mobile device (Safari on iOS or Chrome on Android)"
        }
      >
        <View size={20} className="text-emerald-500" />
      </button>

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
