/**
 * Google Scene Viewer URL Generator
 *
 * Scene Viewer launches an AR experience on Android devices using ARCore.
 * It supports two modes:
 *   1. AR mode — places the model in the real world via hit-test
 *   2. 3D mode — rotates the model in object space (fallback when AR unsupported)
 *
 * Docs: https://developers.google.com/ar/develop/scene-viewer
 *
 * Two URL schemes are supported:
 *   - intent:// (preferred — opens in AR directly if Google Play Services for AR is installed)
 *   - https://arvr.google.com/scene-viewer/1.1 (fallback — web-based launcher)
 */

import type { ARMethod } from "./device-detection";

export interface SceneViewerParams {
  /** URL to the GLB model file */
  file: string;
  /** URL to fallback 3D viewer page (required for intent scheme) */
  fallbackUrl?: string;
  /** Title shown in Scene Viewer UI */
  title?: string;
  /** External model link for "View on website" button */
  link?: string;
  /** Initial scale of the model (default: "1") */
  scale?: string;
  /** Enable sound (default: "0") */
  sound?: string;
  /** Whether to display in AR-only mode (no 3D fallback) */
  arOnly?: boolean;
  /** Mode selector: "3d_preferred" | "ar_preferred" | "ar_only" */
  mode?: "3d_preferred" | "ar_preferred" | "ar_only";
}

/**
 * Generate the Scene Viewer intent:// URL for Android.
 * This is the preferred method — launches AR directly if ARCore is installed.
 *
 * Example output:
 *   intent://arvr.google.com/scene-viewer/1.1?file=https://example.com/sofa.glb&title=Sofa#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=https://example.com;end;
 */
export function buildSceneViewerIntent(params: SceneViewerParams): string {
  const {
    file,
    fallbackUrl,
    title = "3D Model",
    link,
    scale,
    sound,
    arOnly,
  } = params;

  // Build the query string for Scene Viewer
  const queryParams = new URLSearchParams({
    file,
    title,
    mode: arOnly ? "ar_only" : "ar_preferred",
  });

  if (link) queryParams.set("link", link);
  if (scale) queryParams.set("rescale", scale);
  if (sound) queryParams.set("sound", sound);

  // The intent URL points to the Scene Viewer endpoint
  const sceneViewerPath = `arvr.google.com/scene-viewer/1.1?${queryParams.toString()}`;

  // Build intent components
  const intentParts = [
    `intent://${sceneViewerPath}#Intent`,
    `scheme=https`,
    `package=com.google.ar.core`,
    `action=android.intent.action.VIEW`,
  ];

  // Fallback URL — shown if Google Play Services for AR is missing
  const fallback = fallbackUrl || window.location.href;
  intentParts.push(`S.browser_fallback_url=${encodeURIComponent(fallback)}`);

  intentParts.push("end");

  return intentParts.join(";");
}

/**
 * Generate the Scene Viewer HTTPS URL (web fallback).
 * Use this when the intent:// scheme fails (e.g., from inside an iframe).
 *
 * This URL launches a web page that then triggers the intent.
 */
export function buildSceneViewerUrl(params: SceneViewerParams): string {
  const {
    file,
    title = "3D Model",
    link,
    scale,
    sound,
    arOnly,
  } = params;

  const queryParams = new URLSearchParams({
    file,
    title,
    mode: arOnly ? "ar_only" : "ar_preferred",
  });

  if (link) queryParams.set("link", link);
  if (scale) queryParams.set("rescale", scale);
  if (sound) queryParams.set("sound", sound);

  return `https://arvr.google.com/scene-viewer/1.1?${queryParams.toString()}`;
}

/**
 * Launch Scene Viewer on Android.
 * Tries the intent:// scheme first (direct AR launch),
 * falls back to the HTTPS URL if needed.
 */
export function launchSceneViewer(params: SceneViewerParams): void {
  const intentUrl = buildSceneViewerIntent(params);

  // Create a hidden anchor with the intent URL
  // This is the recommended approach by Google
  const a = document.createElement("a");
  a.href = intentUrl;
  a.style.display = "none";
  document.body.appendChild(a);

  // Trigger click to launch intent
  a.click();

  // Cleanup after delay
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
  }, 1000);
}

/**
 * Get the absolute URL for the model file.
 * Converts relative paths like "/sofa.glb" to full URLs.
 * Scene Viewer requires absolute URLs.
 */
export function getAbsoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.href).toString();
}

/**
 * Convenience: detect which AR method to use, then build the right URL
 */
export function getARLaunchInfo(
  method: ARMethod,
  modelUrl: string,
  options?: Partial<SceneViewerParams>
): { type: "intent" | "https"; url: string } | null {
  const absoluteUrl = getAbsoluteUrl(modelUrl);

  if (method === "scene-viewer") {
    return {
      type: "intent",
      url: buildSceneViewerIntent({
        file: absoluteUrl,
        title: options?.title || "3D Model",
        ...options,
      }),
    };
  }

  if (method === "quick-look") {
    // For iOS Quick Look, the caller needs a USDZ URL — handled separately
    return null;
  }

  return null;
}
