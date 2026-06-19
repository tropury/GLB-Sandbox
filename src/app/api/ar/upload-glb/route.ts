/**
 * GLB Upload Endpoint — POST /api/ar/upload-glb
 *
 * Receives a GLB file (generated client-side with the current materials applied)
 * and stores it in memory. Returns a publicly accessible URL that Google
 * Scene Viewer can fetch on Android.
 *
 * Why this exists:
 *  Scene Viewer is launched as a separate app (Google Play Services for AR)
 *  and cannot access browser blob: URLs. It needs an HTTPS URL to fetch the
 *  GLB file. This endpoint provides that URL by temporarily storing the
 *  client-exported GLB.
 *
 * Storage: in-memory Map with UUID keys. Entries auto-expire after 30 minutes
 * to prevent memory leaks. Each GLB is typically 5-15 MB.
 *
 * Flow:
 *  1. Client exports current scene to GLB (with swapped textures)
 *  2. Client POSTs the GLB to this endpoint
 *  3. This endpoint stores it and returns { url: "/api/ar/glb/<uuid>" }
 *  4. Client passes that URL to Scene Viewer
 *  5. Scene Viewer fetches the GLB from GET /api/ar/glb/<uuid>
 */

import { NextRequest, NextResponse } from "next/server";

// ── In-memory storage for uploaded GLBs ──
// Key: UUID, Value: { buffer: ArrayBuffer, createdAt: number }
// Auto-expires after 30 minutes to prevent memory leaks.
export const glbStore = new Map<string, { buffer: ArrayBuffer; createdAt: number }>();

const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// ── Periodic cleanup of expired GLBs ──
// Runs on every request to clean up old entries.
function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, entry] of glbStore.entries()) {
    if (now - entry.createdAt > EXPIRY_MS) {
      glbStore.delete(id);
      console.log(`[GLB Upload] Expired and removed: ${id}`);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    cleanupExpired();

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded. Expected multipart form data with 'file' field." },
        { status: 400 }
      );
    }

    // Verify the file is a GLB
    const isGLB =
      file.type === "model/gltf-binary" ||
      file.name.endsWith(".glb");
    if (!isGLB) {
      return NextResponse.json(
        { error: `Expected GLB file, got: ${file.type} / ${file.name}` },
        { status: 400 }
      );
    }

    // Read the file into an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Generate a unique ID for this GLB
    const id = crypto.randomUUID();

    // Store in memory
    glbStore.set(id, {
      buffer: arrayBuffer,
      createdAt: Date.now(),
    });

    const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(
      `[GLB Upload] ✅ Stored GLB: id=${id}, size=${sizeMB} MB, ` +
        `total stored: ${glbStore.size} entries`
    );

    // Return the public URL for Scene Viewer to fetch
    const url = `/api/ar/glb/${id}`;
    return NextResponse.json(
      { url, id, size: arrayBuffer.byteLength },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GLB Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload GLB", details: error.message },
      { status: 500 }
    );
  }
}

// Allow larger request bodies (GLBs can be 10-15 MB)
export const maxDuration = 30;
export const dynamic = "force-dynamic";
