/**
 * useAR Hook — Reactive AR state management
 *
 * Detects device capabilities and provides launch methods for:
 *  - iOS: AR Quick Look (USDZ) — client-side export captures current texture
 *  - Android: Scene Viewer (GLB) — client-side export + upload captures current texture
 *  - WebXR: fallback for Firefox Android — already applies current materials
 *  - Desktop: AR hidden
 *
 * KEY BEHAVIOR:
 *  The last texture applied in the web viewer is preserved in AR mode.
 *  This is achieved by exporting the CURRENT Three.js scene (which has the
 *  swapped materials already applied to its meshes) rather than using the
 *  original model file.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getARSupportInfo,
  supportsWebXR,
  type ARMethod,
  type Platform,
  type Browser,
} from "./device-detection";
import { launchSceneViewer, getAbsoluteUrl } from "./scene-viewer";
import { launchQuickLook } from "./quick-look";
import { captureCanvasScreenshot } from "./screenshot";
import { exportCurrentSceneToUSDZ } from "./usdz-export";
import { exportAndUploadGLB } from "./glb-export";

export interface ARState {
  /** Whether AR is supported on this device */
  supported: boolean;
  /** AR method to use */
  method: ARMethod;
  /** Device platform */
  platform: Platform;
  /** Browser type */
  browser: Browser;
  /** Whether WebXR is available as fallback (async check) */
  webxrAvailable: boolean;
  /** Whether AR is currently being prepared (export, upload, etc.) */
  loading: boolean;
  /** Progress message during AR preparation */
  loadingMessage: string;
  /** Error message if AR launch failed */
  error: string | null;
}

export interface ARActions {
  /** Launch AR with the current method (preserves the last applied texture) */
  launch: (modelPath: string, options?: ARLaunchOptions) => Promise<void>;
  /** Capture a screenshot of the current canvas */
  screenshot: (filename?: string) => boolean;
}

export interface ARLaunchOptions {
  /** Title shown in AR viewer UI */
  title?: string;
  /** Website link shown in AR viewer */
  link?: string;
  /** Model scale */
  scale?: string;
}

export function useAR(): ARState & ARActions {
  const [state, setState] = useState<ARState>(() => ({
    supported: false,
    method: "none",
    platform: "desktop",
    browser: "other",
    webxrAvailable: false,
    loading: false,
    loadingMessage: "",
    error: null,
  }));

  // Detect device capabilities on mount
  useEffect(() => {
    const info = getARSupportInfo();

    // Async check for WebXR (Firefox Android fallback)
    supportsWebXR().then((webxr) => {
      setState((prev) => ({
        ...prev,
        supported: info.supported || webxr,
        method: info.supported ? info.method : webxr ? "webxr" : "none",
        platform: info.platform,
        browser: info.browser,
        webxrAvailable: webxr,
      }));
    });

    setState((prev) => ({
      ...prev,
      supported: info.supported,
      method: info.method,
      platform: info.platform,
      browser: info.browser,
    }));
  }, []);

  // Launch AR — preserves the last applied texture
  const launch = useCallback(
    async (modelPath: string, options: ARLaunchOptions = {}) => {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        loadingMessage: "Preparing AR...",
      }));

      try {
        const info = getARSupportInfo();

        // ── iOS: Quick Look with client-side USDZ export ──
        // Exports the CURRENT scene (with swapped materials) to USDZ.
        // This ensures the last applied texture persists in AR.
        if (info.method === "quick-look") {
          setState((prev) => ({
            ...prev,
            loadingMessage: "Exporting model with current texture...",
          }));

          console.log("[AR] Exporting current scene to USDZ (client-side)...");
          const usdzBlobUrl = await exportCurrentSceneToUSDZ();

          setState((prev) => ({
            ...prev,
            loadingMessage: "Launching AR Quick Look...",
          }));

          launchQuickLook(usdzBlobUrl, {
            onLaunched: () => {
              // Revoke the blob URL after Quick Look closes
              setTimeout(() => URL.revokeObjectURL(usdzBlobUrl), 60000);
            },
          });
          return;
        }

        // ── Android: Scene Viewer with client-side GLB export ──
        // Exports the CURRENT scene (with swapped materials) to GLB,
        // uploads it to the server for a public URL, then launches
        // Scene Viewer with that URL.
        if (info.method === "scene-viewer") {
          setState((prev) => ({
            ...prev,
            loadingMessage: "Exporting model with current texture...",
          }));

          console.log("[AR] Exporting current scene to GLB (client-side)...");
          const glbUrl = await exportAndUploadGLB();

          setState((prev) => ({
            ...prev,
            loadingMessage: "Launching AR Scene Viewer...",
          }));

          // Convert the relative URL to absolute (Scene Viewer requires absolute URLs)
          const absoluteGlbUrl = getAbsoluteUrl(glbUrl);
          console.log("[AR] Launching Scene Viewer with", absoluteGlbUrl);

          launchSceneViewer({
            file: absoluteGlbUrl,
            title: options.title || "3D Model",
            link: options.link,
            scale: options.scale,
            fallbackUrl: window.location.href,
          });
          return;
        }

        // ── WebXR fallback (Firefox Android, etc.) ──
        // WebXR uses the live scene directly, which already has swapped materials.
        if (info.method === "none") {
          const webxr = await supportsWebXR();
          if (webxr) {
            // Trigger WebXR AR mode via custom event
            // (handled by scene.tsx which has the WebGL context)
            window.dispatchEvent(new CustomEvent("enter-webxr-ar"));
            return;
          }
        }

        throw new Error(
          "AR is not supported on this device. Please use Safari on iOS or Chrome on Android."
        );
      } catch (err: any) {
        console.error("[AR] Launch failed:", err);
        setState((prev) => ({ ...prev, error: err.message }));
        alert(`AR Error: ${err.message}`);
      } finally {
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMessage: "",
        }));
      }
    },
    []
  );

  // Screenshot
  const screenshot = useCallback((filename?: string): boolean => {
    const fname =
      filename || `sofa-ar-${new Date().toISOString().slice(0, 19)}.png`;
    return captureAndDownloadWrapper(fname);
  }, []);

  return { ...state, launch, screenshot };
}

// Wrapper to avoid importing the download function directly
function captureAndDownloadWrapper(filename: string): boolean {
  // Lazy import to keep the module size small
  const dataUrl = captureCanvasScreenshot();
  if (!dataUrl) return false;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
  }, 100);

  return true;
}
