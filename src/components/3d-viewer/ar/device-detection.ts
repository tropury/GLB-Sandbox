/**
 * Device Detection Utility
 * Detects mobile platform, AR support, and browser type
 *
 * Cross-browser support matrix:
 *  - Safari iOS       → ARKit + Quick Look (USDZ)
 *  - Chrome Android   → ARCore + Scene Viewer (GLB)
 *  - Edge Android     → ARCore + Scene Viewer (GLB)
 *  - Samsung Internet → ARCore + Scene Viewer (GLB)
 *  - Firefox Android  → Fallback to WebXR (limited AR support)
 *  - Desktop browsers → AR hidden
 */

export type Platform = "ios" | "android" | "desktop";
export type Browser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "other";

/**
 * Detect if running on iOS (iPhone/iPad/iPod)
 * Includes iPadOS detection (which reports as MacIntel with touch)
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detect if running on Android
 */
export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detect if running on any mobile device (iOS or Android)
 */
export function isMobile(): boolean {
  return isIOS() || isAndroid();
}

/**
 * Get the current platform type
 */
export function getPlatform(): Platform {
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "desktop";
}

/**
 * Detect browser type
 * Order matters — Samsung/Edge include "Chrome" in their UA
 */
export function getBrowser(): Browser {
  if (typeof window === "undefined") return "other";
  const ua = navigator.userAgent;

  // Samsung Internet (Android, supports Scene Viewer)
  if (/SamsungBrowser/i.test(ua)) return "samsung";

  // Edge (Chromium-based, supports Scene Viewer on Android)
  if (/Edg/i.test(ua)) return "edge";

  // Firefox (limited AR — fallback to WebXR)
  if (/Firefox/i.test(ua)) return "firefox";

  // Chrome (must check after Edge and Samsung which spoof Chrome)
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua) && !/SamsungBrowser/i.test(ua)) {
    return "chrome";
  }

  // Safari (must be last — iOS browsers include Safari in UA)
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    return "safari";
  }

  return "other";
}

/**
 * Check if device supports AR via ARKit (iOS Safari + Quick Look)
 * ARKit requires Safari on iOS 12+ with USDZ support.
 * Chrome/Firefox on iOS use WKWebView but don't reliably support rel="ar".
 */
export function supportsARKit(): boolean {
  if (!isIOS()) return false;
  return getBrowser() === "safari";
}

/**
 * Check if device supports AR via ARCore (Android + Scene Viewer)
 * ARCore requires Chrome, Edge, or Samsung Internet on Android.
 * Firefox on Android has no Scene Viewer support (WebXR fallback only).
 */
export function supportsARCore(): boolean {
  if (!isAndroid()) return false;
  const browser = getBrowser();
  return browser === "chrome" || browser === "edge" || browser === "samsung";
}

/**
 * Check if AR is supported on this device via native APIs
 */
export function supportsAR(): boolean {
  return supportsARKit() || supportsARCore();
}

/**
 * Check if WebXR immersive-ar is available (fallback for Firefox Android)
 */
export async function supportsWebXR(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

/**
 * Get AR support info for UI display
 */
export function getARSupportInfo(): {
  supported: boolean;
  method: ARMethod;
  platform: Platform;
  browser: Browser;
} {
  const platform = getPlatform();
  const browser = getBrowser();

  if (supportsARKit()) {
    return { supported: true, method: "quick-look", platform, browser };
  }
  if (supportsARCore()) {
    return { supported: true, method: "scene-viewer", platform, browser };
  }
  return { supported: false, method: "none", platform, browser };
}

export type ARMethod = "quick-look" | "scene-viewer" | "webxr" | "none";
