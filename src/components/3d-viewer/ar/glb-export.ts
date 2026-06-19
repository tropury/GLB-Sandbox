/**
 * Client-Side GLB Export — Android Google Scene Viewer
 *
 * Exports the CURRENT Three.js scene (with the last applied texture/materials)
 * to GLB format directly in the browser, then uploads it to a server endpoint
 * to get a publicly accessible URL that Scene Viewer can load.
 *
 * Why client-side export?
 *  The browser already has all textures loaded in GPU memory and the scene's
 *  meshes already have the swapped materials applied. GLTFExporter works
 *  perfectly in the browser (uses HTMLCanvasElement for texture encoding).
 *
 * Why upload to server?
 *  Google Scene Viewer is launched as a separate app (Google Play Services
 *  for AR) and cannot access browser blob: URLs. It needs a publicly
 *  accessible HTTPS URL to fetch the GLB file.
 *
 * Flow:
 *  1. Clone the current scene (with swapped materials)
 *  2. Export to GLB binary using GLTFExporter (client-side)
 *  3. Upload the GLB blob to POST /api/ar/upload-glb
 *  4. Receive a public URL: /api/ar/glb/<uuid>
 *  5. Pass that URL to Scene Viewer
 */

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { getLoadedScene } from "../scene";

/**
 * Export the current scene (with swapped materials) to a GLB ArrayBuffer.
 *
 * @returns GLB binary data as an ArrayBuffer
 * @throws If the scene isn't loaded yet or export fails
 */
export async function exportCurrentSceneToGLB(): Promise<ArrayBuffer> {
  const sourceScene = getLoadedScene();
  if (!sourceScene) {
    throw new Error("3D model is still loading. Please wait and try again.");
  }

  console.log("[GLB Export] Cloning scene with current materials...");

  // Deep-clone the scene so we can modify it for AR without affecting the
  // live WebGL scene. The clone shares geometry references (memory-efficient).
  const exportScene = sourceScene.clone(true);

  // ── Center and scale to unit size for AR placement ──
  // Scene Viewer expects models normalized to ~1 meter for realistic scale.
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

  // ── Prepare materials for GLTF export ──
  // GLTFExporter handles MeshStandardMaterial natively.
  // Ensure textures are properly referenced.
  exportScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });

  // ── Export to GLB (binary glTF) ──
  // GLTFExporter.parse() uses callback style (onDone/onError).
  // We use binary: true for GLB output (single file with embedded textures).
  //
  // maxTextureSize: 1024 limits texture dimensions to 1024×1024.
  //   The original textures may be 2048×2048 (16MB each as raw RGBA in GLB).
  //   Capping at 1024 reduces each to ~4MB, keeping total GLB under ~30MB
  //   for acceptable mobile upload speed.
  console.log("[GLB Export] Exporting to GLB format (max texture: 1024px)...");
  const exporter = new GLTFExporter();

  const glbArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      exportScene,
      (result: any) => {
        // Binary mode returns an ArrayBuffer
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else if (result instanceof Uint8Array) {
          resolve(
            result.buffer.slice(
              result.byteOffset,
              result.byteOffset + result.byteLength
            ) as ArrayBuffer
          );
        } else {
          reject(new Error(`Unexpected GLB export result type: ${typeof result}`));
        }
      },
      (error: any) => reject(error),
      {
        binary: true, // GLB format (not JSON .gltf)
        embedImages: true, // Embed textures in the GLB
        onlyVisible: true,
        truncateDrawRange: true,
        maxTextureSize: 1024, // Limit textures to 1024×1024 for smaller GLB
      }
    );
  });

  console.log(
    `[GLB Export] ✅ GLB generated: ${(glbArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
  );

  return glbArrayBuffer;
}

/**
 * Export the current scene to GLB and upload it to the server.
 * Returns a publicly accessible URL that Scene Viewer can load.
 *
 * @returns Object URL path like "/api/ar/glb/<uuid>"
 * @throws If export or upload fails
 */
export async function exportAndUploadGLB(): Promise<string> {
  // Step 1: Export the current scene to GLB (client-side)
  const glbBuffer = await exportCurrentSceneToGLB();

  // Step 2: Upload the GLB to the server
  console.log("[GLB Export] Uploading GLB to server...");
  const formData = new FormData();
  const glbBlob = new Blob([glbBuffer], { type: "model/gltf-binary" });
  formData.append("file", glbBlob, "sofa-ar.glb");

  const response = await fetch("/api/ar/upload-glb", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to upload GLB: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const glbUrl = data.url as string;

  console.log("[GLB Export] ✅ GLB uploaded, URL:", glbUrl);
  return glbUrl;
}
