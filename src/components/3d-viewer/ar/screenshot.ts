/**
 * Screenshot Utility
 * Captures PNG screenshots from the WebGL canvas.
 *
 * Works in both normal viewer mode and AR mode (WebXR).
 * For AR Quick Look / Scene Viewer, screenshots are taken BEFORE launching
 * (since the AR session is owned by the native app, not the browser).
 */

/**
 * Capture a PNG screenshot from a WebGL canvas.
 *
 * @param canvas - The WebGL canvas element (or null to auto-detect)
 * @param options - Capture options
 * @returns Promise resolving to a data URL (PNG)
 */
export function captureCanvasScreenshot(
  canvas: HTMLCanvasElement | null = null,
  options: {
    /** Scale factor for higher resolution (default: 1) */
    scale?: number;
    /** Background color (default: transparent) */
    background?: string;
  } = {}
): string | null {
  const { scale = 1, background } = options;

  // Find the WebGL canvas if not provided
  const targetCanvas =
    canvas ||
    document.querySelector("canvas") as HTMLCanvasElement | null;

  if (!targetCanvas) {
    console.error("[Screenshot] No canvas found");
    return null;
  }

  // Preserve the drawing buffer — must be done before render
  // but R3F manages this; we call toDataURL with preserveDrawingBuffer hint
  try {
    // Get the WebGL context with preserveDrawingBuffer
    const gl = targetCanvas.getContext("webgl2") || targetCanvas.getContext("webgl");
    if (!gl) {
      console.error("[Screenshot] No WebGL context");
      return null;
    }

    // Force a render frame to populate the buffer
    // (R3F's default loop should have already drawn)
    // Force a draw call synchronization
    gl.finish();

    // Create a 2D canvas to compose the final image
    const outCanvas = document.createElement("canvas");
    outCanvas.width = targetCanvas.width * scale;
    outCanvas.height = targetCanvas.height * scale;

    const ctx = outCanvas.getContext("2d");
    if (!ctx) return null;

    // Fill background if specified
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    }

    // Draw the WebGL canvas onto the 2D canvas
    ctx.drawImage(targetCanvas, 0, 0, outCanvas.width, outCanvas.height);

    // Convert to PNG data URL
    return outCanvas.toDataURL("image/png");
  } catch (err) {
    console.error("[Screenshot] Capture failed:", err);
    return null;
  }
}

/**
 * Download a data URL as a file.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
  }, 100);
}

/**
 * Capture and download a screenshot in one call.
 */
export function captureAndDownload(
  filename: string = `ar-screenshot-${Date.now()}.png`,
  canvas?: HTMLCanvasElement | null
): boolean {
  const dataUrl = captureCanvasScreenshot(canvas);
  if (!dataUrl) return false;
  downloadDataUrl(dataUrl, filename);
  return true;
}
