/**
 * iOS AR Quick Look Launcher
 *
 * Quick Look uses the USDZ format and ARKit to render AR experiences
 * directly in Safari on iOS 12+.
 *
 * The launch mechanism is an anchor tag with:
 *   - rel="ar"
 *   - href pointing to a USDZ file (blob: or https: URL)
 *   - a child <img> element (required by Safari)
 *
 * When the user taps the anchor, Safari presents the AR Quick Look UI.
 *
 * Docs: https://developer.apple.com/augmented-reality/quick-look/
 */

/**
 * Launch iOS AR Quick Look with a USDZ file URL.
 *
 * @param usdzUrl - URL to the USDZ file (can be blob: URL or https:)
 * @param options - Optional configuration
 */
export function launchQuickLook(
  usdzUrl: string,
  options: {
    /** Called after the anchor is clicked (for cleanup) */
    onLaunched?: () => void;
    /** Whether to allow scaling the model (default: true) */
    allowsContentScaling?: boolean;
  } = {}
): void {
  const { onLaunched } = options;

  // Create the anchor element with rel="ar"
  // Safari requires this exact attribute to trigger Quick Look
  const a = document.createElement("a");
  a.rel = "ar";

  // Set the href to the USDZ URL
  a.href = usdzUrl;

  // iOS Safari requires the anchor to contain an <img> element
  // Using a transparent 1x1 GIF keeps it invisible
  const img = document.createElement("img");
  img.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  img.style.visibility = "hidden";
  img.style.width = "1px";
  img.style.height = "1px";
  img.alt = "View in AR";
  a.appendChild(img);

  // The anchor must be in the DOM for the click to trigger Quick Look
  document.body.appendChild(a);

  // Trigger the click programmatically
  a.click();

  // Callback for post-launch logic
  if (onLaunched) {
    setTimeout(onLaunched, 100);
  }

  // Cleanup after a delay (gives Safari time to start the Quick Look session)
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
  }, 5000);
}

/**
 * Check if a URL is a valid USDZ file URL.
 * Quick Look only works with .usdz files.
 */
export function isUSDZUrl(url: string): boolean {
  return /\.usdz(\?|$)/i.test(url);
}

/**
 * Download a blob and return its object URL.
 * Useful for fetching server-generated USDZ files.
 */
export async function fetchUSDZBlob(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch USDZ: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();

  // Verify MIME type is USDZ
  if (blob.type && !blob.type.includes("usdz") && !blob.type.includes("octet-stream")) {
    console.warn(`[QuickLook] Unexpected MIME type: ${blob.type}`);
  }

  // Create a blob URL with the correct MIME type
  const usdzBlob = new Blob([blob], { type: "model/vnd.usdz+zip" });
  return URL.createObjectURL(usdzBlob);
}
