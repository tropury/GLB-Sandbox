/**
 * Client-Side USDZ Export — iOS AR Quick Look
 *
 * Exports the CURRENT Three.js scene (with the last applied texture/materials)
 * to USDZ format directly in the browser. This ensures the texture the user
 * selected in the web viewer is preserved when entering AR mode on iOS.
 *
 * The export is done client-side (not server-side) because:
 *  1. The browser already has all textures loaded in GPU memory
 *  2. The scene's meshes already have the swapped materials applied
 *  3. USDZExporter works perfectly in the browser (uses Web Workers internally)
 *  4. No server round-trip needed — instant for the user
 *
 * The result is a blob: URL that Safari's AR Quick Look can open via rel="ar".
 */

import * as THREE from "three";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { getLoadedScene } from "../scene";

/**
 * Export the current scene (with swapped materials) to a USDZ blob URL.
 *
 * @returns A blob: URL pointing to the USDZ file, ready for AR Quick Look
 * @throws If the scene isn't loaded yet or export fails
 */
export async function exportCurrentSceneToUSDZ(): Promise<string> {
  const sourceScene = getLoadedScene();
  if (!sourceScene) {
    throw new Error("3D model is still loading. Please wait and try again.");
  }

  console.log("[USDZ Export] Cloning scene with current materials...");

  // Deep-clone the scene so we can modify it for AR without affecting the
  // live WebGL scene. The clone shares geometry references (memory-efficient)
  // but gets its own transform hierarchy.
  const exportScene = sourceScene.clone(true);

  // ── Center and scale to unit size for AR placement ──
  // AR Quick Look expects models normalized to ~1 meter for realistic scale.
  const box = new THREE.Box3().setFromObject(exportScene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Re-center the model at the origin
  exportScene.position.sub(center);

  // Scale so the longest dimension = 1 unit (1 meter in AR)
  if (maxDim > 0) {
    const scale = 1 / maxDim;
    exportScene.scale.multiplyScalar(scale);
  }

  // ── Wrap in a parent scene with lighting ──
  // USDZExporter bakes scene lights into the export for proper AR appearance.
  const wrappedScene = new THREE.Scene();
  wrappedScene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(5, 8, 5);
  wrappedScene.add(dirLight);
  wrappedScene.add(exportScene);

  // ── Export to USDZ ──
  // USDZExporter.parse() uses callback style (onDone/onError).
  // We wrap it in a Promise for async/await usage.
  console.log("[USDZ Export] Exporting to USDZ format...");
  const exporter = new USDZExporter();

  const usdzResult = await new Promise<ArrayBuffer | Uint8Array>(
    (resolve, reject) => {
      exporter.parse(
        wrappedScene,
        (result: any) => resolve(result),
        (error: any) => reject(error)
      );
    }
  );

  // Normalize result to ArrayBuffer
  let usdzBuffer: ArrayBuffer;
  if (usdzResult instanceof ArrayBuffer) {
    usdzBuffer = usdzResult;
  } else if (usdzResult instanceof Uint8Array) {
    usdzBuffer = usdzResult.buffer.slice(
      usdzResult.byteOffset,
      usdzResult.byteOffset + usdzResult.byteLength
    ) as ArrayBuffer;
  } else if (usdzResult && typeof usdzResult === "object") {
    const anyResult = usdzResult as any;
    if (anyResult.buffer instanceof ArrayBuffer) {
      usdzBuffer = anyResult.buffer;
    } else if (anyResult.byteLength !== undefined) {
      usdzBuffer = (anyResult as ArrayBuffer).slice(0);
    } else {
      throw new Error(`Unexpected USDZ result type: ${typeof usdzResult}`);
    }
  } else {
    throw new Error(`Unexpected USDZ result type: ${typeof usdzResult}`);
  }

  console.log(
    `[USDZ Export] ✅ USDZ generated: ${(usdzBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
  );

  // Create a blob URL with the correct USDZ MIME type
  // Safari's AR Quick Look requires the model/vnd.usdz+zip MIME type
  const blob = new Blob([usdzBuffer], { type: "model/vnd.usdz+zip" });
  return URL.createObjectURL(blob);
}
