"use client";

import { useRef, useEffect, useState, useCallback, Suspense } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Html,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { useViewerStore } from "./store";
import { materialGroups } from "./materials";

// Configure Draco loader (for Draco-compressed GLBs)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
);
dracoLoader.setDecoderConfig({ type: "js" });

// Configure GLTFLoader with both Draco AND Meshopt support
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// ─── Platform Detection ───
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
      navigator.userAgent
    ) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// ─── Global reference to the loaded GLTF scene ───
let loadedGltfScene: THREE.Group | null = null;

// ─── Loader Component ───
function Loader() {
  const { progress, active } = useProgress();
  if (!active && progress >= 100) return null;
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-black/40 dark:text-white/40 font-medium tracking-wider">
          Loading model... {Math.round(progress)}%
        </span>
      </div>
    </Html>
  );
}

// ─── Sofa Model ───
function SofaModel() {
  const gltf = useLoader(
    GLTFLoader,
    "/sofa.glb",
    (loader) => {
      const l = loader as GLTFLoader;
      l.setDRACOLoader(dracoLoader);
      l.setMeshoptDecoder(MeshoptDecoder);
    }
  );
  const modelRef = useRef<THREE.Group>(null);
  const selectedMaterials = useViewerStore((s) => s.selectedMaterials);
  const setLoaded = useViewerStore((s) => s.setLoaded);
  const meshMaterialsRef = useRef<
    Map<string, { mesh: THREE.Mesh; originalMaterial: THREE.Material }>
  >(new Map());
  const textureCache = useRef<Map<string, THREE.Texture>>(new Map());

  // Step 1: Extract mesh-material pairs and preload ALL textures (color + normal)
  useEffect(() => {
    if (!gltf.scene) return;

    // Store global reference for AR export
    loadedGltfScene = gltf.scene;

    // Collect all material names used by the sofa upholstery
    const upholsteryNames = new Set<string>();
    materialGroups.forEach((group) => {
      group.options.forEach((opt) => {
        opt.targetMaterials.forEach((name) => upholsteryNames.add(name));
      });
    });

    const materialNames: string[] = [];

    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;
        if (mat && mat.name) {
          materialNames.push(mat.name);

          if (upholsteryNames.has(mat.name)) {
            meshMaterialsRef.current.set(mat.name, {
              mesh,
              originalMaterial: mat,
            });
          }
        }
      }
    });

    console.log("[SofaModel] All materials found:", materialNames);

    // Preload ALL textures: color maps + normal maps
    const loader = new THREE.TextureLoader();
    const allTexturePaths = new Set<string>();
    materialGroups.forEach((group) => {
      group.options.forEach((opt) => {
        allTexturePaths.add(opt.texture);
        if (opt.normalMap) {
          allTexturePaths.add(opt.normalMap);
        }
      });
    });

    let loadedCount = 0;
    const totalTextures = allTexturePaths.size;

    if (totalTextures === 0) {
      setLoaded(true);
      return;
    }

    allTexturePaths.forEach((path) => {
      loader.load(
        path,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.flipY = false;

          // Normal maps use LinearSRGBColorSpace (no sRGB gamma)
          // Color/diffuse maps use SRGBColorSpace
          if (path.toLowerCase().includes("normal")) {
            tex.colorSpace = THREE.LinearSRGBColorSpace;
          } else {
            tex.colorSpace = THREE.SRGBColorSpace;
          }

          textureCache.current.set(path, tex);
          loadedCount++;
          if (loadedCount === totalTextures) {
            console.log("[SofaModel] ✅ All textures preloaded");
            setLoaded(true);
          }
        },
        undefined,
        (err) => {
          console.error(`[SofaModel] Texture preload failed: ${path}`, err);
          loadedCount++;
          if (loadedCount === totalTextures) {
            setLoaded(true);
          }
        }
      );
    });
  }, [gltf, setLoaded]);

  // Step 2: When user selects a material, create a NEW material with normal map and assign it
  useEffect(() => {
    const entries = Object.entries(selectedMaterials);
    if (entries.length === 0) return;

    entries.forEach(([, option]) => {
      if (!option) return;

      const texture = textureCache.current.get(option.texture);
      if (!texture) {
        console.warn(
          `[SofaModel] Texture "${option.texture}" not preloaded yet`
        );
        return;
      }

      // Load normal map texture if available
      let normalTexture: THREE.Texture | null = null;
      if (option.normalMap) {
        normalTexture = textureCache.current.get(option.normalMap) || null;
      }

      // Create a fresh material — avoids issues with baked textures,
      // near-black colors, alpha blending, etc.
      const newMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        normalMap: normalTexture,
        normalScale: new THREE.Vector2(
          option.normalScale ?? 1,
          option.normalScale ?? 1
        ),
        roughness: option.roughness,
        metalness: option.metalness,
        transparent: false,
        opacity: 1.0,
        depthWrite: true,
        side: THREE.DoubleSide,
      });

      // Apply the new material to ALL upholstery meshes
      let appliedCount = 0;
      option.targetMaterials.forEach((matName) => {
        const entry = meshMaterialsRef.current.get(matName);
        if (entry) {
          entry.mesh.material = newMaterial;
          appliedCount++;
        }
      });

      console.log(
        `[SofaModel] ✅ Applied "${option.name}" to ${appliedCount}/${option.targetMaterials.length} meshes` +
          (normalTexture ? " (with normal map)" : "")
      );
    });
  }, [selectedMaterials]);

  // Configure model shadows
  useEffect(() => {
    if (!gltf.scene) return;
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [gltf]);

  return <primitive ref={modelRef} object={gltf.scene} />;
}

// ─── Shadow Plane ───
function ShadowPlane() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[20, 20]} />
      <shadowMaterial opacity={0.15} />
    </mesh>
  );
}

// ─── Camera Setup ───
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(4, 3, 4);
    camera.lookAt(0, 0.5, 0);
  }, [camera]);
  return null;
}

// ─── Scene Content ───
function SceneContent() {
  return (
    <>
      <Environment files="/studio.hdr" background={false} />

      {/* Lighting that complements the HDR */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-near={0.1}
        shadow-bias={-0.0001}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />

      <CameraSetup />

      <Suspense fallback={<Loader />}>
        <SofaModel />
      </Suspense>
      <ShadowPlane />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={12}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0.5, 0]}
        enablePan={false}
      />
    </>
  );
}

// ─── iOS AR via USDZ + AR Quick Look ───
async function startIOSAR(
  setArLoading: (v: boolean) => void
): Promise<void> {
  setArLoading(true);

  try {
    if (!loadedGltfScene) {
      alert("Model is still loading. Please wait and try again.");
      setArLoading(false);
      return;
    }

    // Clone the sofa model with current materials
    const cloned = loadedGltfScene.clone(true);

    // Create a clean export scene with just the sofa + lighting
    const exportScene = new THREE.Scene();
    exportScene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 8, 5);
    exportScene.add(dirLight);
    exportScene.add(cloned);

    // Center and normalize the model scale
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1 / maxDim;
      cloned.scale.multiplyScalar(scale);
    }

    console.log("[AR iOS] Exporting scene to USDZ...");

    const exporter = new USDZExporter();
    const arraybuffer = await exporter.parse(exportScene);

    console.log(
      `[AR iOS] USDZ exported: ${(arraybuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
    );

    // Create blob with correct MIME type for AR Quick Look
    const blob = new Blob([arraybuffer], { type: "model/vnd.usdz+zip" });
    const url = URL.createObjectURL(blob);

    // Trigger AR Quick Look via <a rel="ar">
    const a = document.createElement("a");
    a.rel = "ar";
    a.href = url;
    const img = document.createElement("img");
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    img.style.visibility = "hidden";
    img.style.width = "1px";
    img.style.height = "1px";
    a.appendChild(img);
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 5000);

    setArLoading(false);
  } catch (e: any) {
    console.error("[AR iOS] USDZ export failed:", e);
    setArLoading(false);
    alert(
      `AR preparation failed: ${e.message || "Could not export model. Please try again."}`
    );
  }
}

// ─── Android AR via WebXR ───
async function startAndroidAR(
  setArActive: (v: boolean) => void
): Promise<void> {
  if (!navigator.xr) {
    alert("WebXR is not available on this device.");
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) {
      alert("AR is not supported on this browser. Try Chrome on Android.");
      return;
    }

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.getElementById("ar-overlay")! },
    });
    setArActive(true);

    const arCanvas = document.createElement("canvas");
    document.body.appendChild(arCanvas);
    arCanvas.style.position = "fixed";
    arCanvas.style.inset = "0";
    arCanvas.style.zIndex = "100";
    arCanvas.style.width = "100%";
    arCanvas.style.height = "100%";

    const renderer = new THREE.WebGLRenderer({
      canvas: arCanvas,
      antialias: true,
      alpha: true,
    });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    await renderer.xr.setSession(session);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      20
    );

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    const arLoader = new GLTFLoader();
    arLoader.setDRACOLoader(dracoLoader);
    arLoader.setMeshoptDecoder(MeshoptDecoder);
    const arGltf = await new Promise<any>((resolve, reject) => {
      arLoader.load("/sofa.glb", resolve, undefined, reject);
    });

    const sofa = arGltf.scene;
    sofa.scale.set(0.5, 0.5, 0.5);
    sofa.visible = false;
    scene.add(sofa);

    // Apply current material selection to AR sofa
    const currentMaterials = useViewerStore.getState().selectedMaterials;
    Object.entries(currentMaterials).forEach(([, option]) => {
      if (!option) return;
      const newMat = new THREE.MeshStandardMaterial({
        map: null,
        color: 0xffffff,
        roughness: option.roughness,
        metalness: option.metalness,
        side: THREE.DoubleSide,
      });
      const texLoader = new THREE.TextureLoader();
      texLoader.load(option.texture, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        newMat.map = tex;
        newMat.needsUpdate = true;
      });
      option.targetMaterials.forEach((matName) => {
        sofa.traverse((child: any) => {
          if (child.isMesh && child.material?.name === matName) {
            child.material = newMat;
          }
        });
      });
    });

    const reticleGeom = new THREE.RingGeometry(0.1, 0.12, 32);
    reticleGeom.rotateX(-Math.PI / 2);
    const reticle = new THREE.Mesh(
      reticleGeom,
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.8,
      })
    );
    reticle.visible = false;
    scene.add(reticle);

    let sofaPlaced = false;
    let hitTestSource: XRHitTestSource | null = null;

    const viewerSpace = await session.requestReferenceSpace("viewer");
    try {
      hitTestSource = await session.requestHitTestSource({
        space: viewerSpace,
      });
    } catch {
      console.warn(
        "[AR] Hit test not available, sofa will be placed in front of camera"
      );
    }

    const refSpace = await session.requestReferenceSpace("local");

    const onSelect = () => {
      if (sofaPlaced) return;
      if (hitTestSource && reticle.visible) {
        sofaPlaced = true;
        reticle.visible = false;
        sofa.position.copy(reticle.position);
        sofa.quaternion.copy(reticle.quaternion);
        sofa.visible = true;
      } else if (!hitTestSource) {
        sofaPlaced = true;
        reticle.visible = false;
        sofa.position.set(0, 0, -1.5);
        sofa.visible = true;
      }
    };
    session.addEventListener("select", onSelect);

    session.addEventListener("end", () => {
      setArActive(false);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      arCanvas.remove();
    });

    renderer.setAnimationLoop((_timestamp: number, frame?: XRFrame) => {
      if (!frame) return;

      if (hitTestSource && !sofaPlaced) {
        const results = frame.getHitTestResults(hitTestSource);
        if (results.length > 0) {
          const pose = results[0].getPose(refSpace);
          if (pose) {
            reticle.visible = true;
            reticle.position.set(
              pose.transform.position.x,
              pose.transform.position.y,
              pose.transform.position.z
            );
            reticle.quaternion.set(
              pose.transform.orientation.x,
              pose.transform.orientation.y,
              pose.transform.orientation.z,
              pose.transform.orientation.w
            );
          }
        } else {
          reticle.visible = false;
        }
      }

      renderer.render(scene, camera);
    });
  } catch (e: any) {
    console.error("[AR Android] Failed:", e);
    setArActive(false);
    alert(
      `AR Error: ${e.message || "Could not start AR. Use Chrome on Android."}`
    );
  }
}

// ─── AR Loading Overlay (iOS USDZ export) ───
function ARLoadingOverlay({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20">
        <svg
          className="animate-spin text-emerald-400"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">
            Preparing AR Experience
          </p>
          <p className="text-white/60 text-xs mt-1">
            Exporting 3D model for AR Quick Look...
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── AR Overlay (Android WebXR) ───
function AROverlay({ arActive }: { arActive: boolean }) {
  if (!arActive) return null;
  return (
    <div id="ar-overlay" className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div
          className="px-5 py-2.5 rounded-full backdrop-blur-md text-sm font-medium shadow-lg"
          style={{
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
          }}
        >
          Tap a surface to place the sofa
        </div>
      </div>
    </div>
  );
}

// ─── Mobile AR Button ───
function MobileARButton({
  arLoading,
  onAR,
}: {
  arLoading: boolean;
  onAR: () => void;
}) {
  return (
    <button
      onClick={onAR}
      disabled={arLoading}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md transition-all duration-200 hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      style={{
        background: "rgba(16, 185, 129, 0.15)",
        border: "1px solid rgba(16, 185, 129, 0.3)",
        color: "var(--viewer-text)",
      }}
    >
      {arLoading ? (
        <>
          <svg
            className="animate-spin"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span className="text-xs font-bold tracking-wider">
            PREPARING AR...
          </span>
        </>
      ) : (
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-xs font-bold tracking-wider">VIEW IN AR</span>
        </>
      )}
    </button>
  );
}

// ─── Main Scene Export ───
export default function Scene() {
  const isDark = useViewerStore((s) => s.isDark);
  const bgColor = isDark ? "#212425" : "#f2f2f2";
  const [arActive, setArActive] = useState(false);
  const [arLoading, setArLoading] = useState(false);
  const [isMobileDevice] = useState(isMobile);

  // Central AR handler — routes to iOS or Android AR
  const handleAR = useCallback(async () => {
    if (arLoading) return;

    if (isIOS()) {
      await startIOSAR(setArLoading);
    } else if (navigator.xr) {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      if (supported) {
        await startAndroidAR(setArActive);
      } else {
        alert(
          "AR is not supported on this browser. Please use Chrome on Android or Safari on iOS."
        );
      }
    } else if (isMobile()) {
      if (isIOS()) {
        await startIOSAR(setArLoading);
      } else {
        alert(
          "AR is not supported on this browser. Please try Chrome on Android."
        );
      }
    } else {
      alert(
        "AR requires a mobile device. Please open this page on your phone — Safari on iOS or Chrome on Android."
      );
    }
  }, [arLoading, setArActive]);

  // Listen for AR requests from help panel
  useEffect(() => {
    const handler = () => handleAR();
    window.addEventListener("enter-ar", handler);
    return () => window.removeEventListener("enter-ar", handler);
  }, [handleAR]);

  return (
    <>
      <Canvas
        shadows
        camera={{
          fov: 25,
          near: 0.1,
          far: 100,
          position: [4, 3, 4],
        }}
        style={{ background: bgColor, transition: "background 0.85s ease" }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 2.5,
        }}
      >
        <SceneContent />
      </Canvas>

      {/* AR overlay shown during Android WebXR AR session */}
      <AROverlay arActive={arActive} />

      {/* AR loading overlay for iOS USDZ export */}
      <ARLoadingOverlay loading={arLoading} />

      {/* AR button for mobile devices */}
      {isMobileDevice && (
        <MobileARButton arLoading={arLoading} onAR={handleAR} />
      )}
    </>
  );
}
