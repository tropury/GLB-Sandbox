/**
 * USDZ Generation API Endpoint
 *
 * Converts the sofa GLB model to USDZ format for iOS AR Quick Look.
 * Runs server-side using Three.js USDZExporter.
 *
 * Caches the result in memory to avoid regenerating on every request.
 *
 * Usage:
 *   GET /api/ar/usdz?model=sofa
 *   → Returns binary USDZ file with Content-Type: model/vnd.usdz+zip
 */

import { NextRequest, NextResponse } from "next/server";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import fs from "fs";
import path from "path";

// Polyfill `self` for Node.js environment
// USDZExporter and MeshoptDecoder reference `self` (Web Worker global)
// but Node.js doesn't have it. We provide a minimal polyfill.
if (typeof (globalThis as any).self === "undefined") {
  (globalThis as any).self = globalThis;
}

// In-memory cache for the generated USDZ
// (regenerating takes ~5-10 seconds; cache for the lifetime of the process)
let usdzCache: ArrayBuffer | null = null;
let usdzCacheKey: string | null = null;

// Configure loaders once (module-level singleton)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
dracoLoader.setDecoderConfig({ type: "js" });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelKey = searchParams.get("model") || "sofa";

    // Return cached version if available
    if (usdzCache && usdzCacheKey === modelKey) {
      console.log(
        `[USDZ API] Returning cached USDZ (${(usdzCache.byteLength / 1024 / 1024).toFixed(2)} MB)`
      );
      return new NextResponse(usdzCache, {
        status: 200,
        headers: {
          "Content-Type": "model/vnd.usdz+zip",
          "Content-Length": usdzCache.byteLength.toString(),
          "Content-Disposition": `inline; filename="${modelKey}.usdz"`,
          "Cache-Control": "public, max-age=86400, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Find the GLB file in public/
    const glbPath = path.join(process.cwd(), "public", "sofa.glb");
    if (!fs.existsSync(glbPath)) {
      return NextResponse.json({ error: "GLB model not found" }, { status: 404 });
    }

    console.log(`[USDZ API] Loading GLB: ${glbPath}`);
    const glbBuffer = fs.readFileSync(glbPath);

    // Parse the GLB with Three.js
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    const gltf = await new Promise<any>((resolve, reject) => {
      loader.parse(
        glbBuffer.buffer.slice(
          glbBuffer.byteOffset,
          glbBuffer.byteOffset + glbBuffer.byteLength
        ),
        "",
        resolve,
        reject
      );
    });

    console.log("[USDZ API] GLB loaded, preparing scene for USDZ export");

    // Prepare the scene for USDZ export
    const scene = gltf.scene;

    // Center and scale the model to unit size for AR
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    scene.position.sub(center);
    if (maxDim > 0) {
      const scale = 1 / maxDim;
      scene.scale.multiplyScalar(scale);
    }

    // Add lighting — USDZExporter bakes lights into the export
    const exportScene = new THREE.Scene();
    exportScene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 8, 5);
    exportScene.add(dirLight);
    exportScene.add(scene);

    // Traverse and ensure all materials are compatible with USDZ
    // USDZ prefers MeshStandardMaterial with proper textures
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    // Export to USDZ
    // USDZExporter.parse() uses callback style (onDone/onError)
    // We wrap it in a Promise for async/await usage
    console.log("[USDZ API] Exporting to USDZ...");
    const exporter = new USDZExporter();
    const usdzResult = await new Promise<any>((resolve, reject) => {
      exporter.parse(
        exportScene,
        (result: any) => resolve(result),
        (error: any) => reject(error)
      );
    });

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
      `[USDZ API] USDZ generated: ${(usdzBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
    );

    // Cache the result
    usdzCache = usdzBuffer;
    usdzCacheKey = modelKey;

    // Return the USDZ binary
    return new NextResponse(usdzBuffer, {
      status: 200,
      headers: {
        "Content-Type": "model/vnd.usdz+zip",
        "Content-Length": usdzBuffer.byteLength.toString(),
        "Content-Disposition": `inline; filename="${modelKey}.usdz"`,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("[USDZ API] Error generating USDZ:", error);
    return NextResponse.json(
      { error: "Failed to generate USDZ", details: error.message },
      { status: 500 }
    );
  }
}

// Allow long-running requests (USDZ generation can take ~10 seconds)
export const maxDuration = 60;
export const dynamic = "force-dynamic";
