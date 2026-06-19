/**
 * GLB Serve Endpoint — GET /api/ar/glb/[id]
 *
 * Serves a previously uploaded GLB file by its UUID.
 * This URL is fetched by Google Scene Viewer on Android when the user
 * taps "View in AR".
 *
 * The GLB was generated client-side (with the current swapped materials applied)
 * and uploaded via POST /api/ar/upload-glb.
 *
 * Returns:
 *  - 200: GLB binary with Content-Type: model/gltf-binary
 *  - 404: GLB not found (expired or invalid ID)
 *  - 410: GLB has expired (was stored more than 30 minutes ago)
 */

import { NextRequest, NextResponse } from "next/server";
import { glbStore } from "../../upload-glb/route";

const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes (must match upload-glb/route.ts)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const entry = glbStore.get(id);

  if (!entry) {
    return NextResponse.json(
      { error: "GLB not found. It may have expired or the ID is invalid." },
      { status: 404 }
    );
  }

  // Check expiry
  const age = Date.now() - entry.createdAt;
  if (age > EXPIRY_MS) {
    glbStore.delete(id);
    return NextResponse.json(
      { error: "GLB has expired. Please regenerate and re-upload." },
      { status: 410 }
    );
  }

  const sizeMB = (entry.buffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`[GLB Serve] Serving GLB: id=${id}, size=${sizeMB} MB`);

  // Return the GLB binary
  return new NextResponse(entry.buffer, {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": entry.buffer.byteLength.toString(),
      "Content-Disposition": `inline; filename="sofa-ar.glb"`,
      // Cache for the lifetime of the entry (Scene Viewer may re-fetch)
      "Cache-Control": "public, max-age=1800, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const dynamic = "force-dynamic";
