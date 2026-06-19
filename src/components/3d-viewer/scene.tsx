"use client";

import { useRef, useEffect, useState, Suspense } from "react";
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
import { useViewerStore } from "./store";
import { materialGroups } from "./materials";

// ─── Lazy Loader Configuration ───
// Draco decoder for Draco-compressed GLBs (CDN-loaded, cached)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
);
dracoLoader.setDecoderConfig({ type: "js" });

// GLTFLoader with Draco + Meshopt support (covers all compression types)
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// ─── Global reference to the loaded GLTF scene (for AR export + WebXR fallback) ───
// This scene has the CURRENTLY SWAPPED materials applied to its meshes.
// AR export (USDZ for iOS, GLB for Android) reads from this reference to
// ensure the last applied texture persists in AR mode.
let loadedGltfScene: THREE.Group | null = null;
let loadedGltfMaterials: Map<string, THREE.Material> = new Map();

/**
 * Get the current Three.js scene with the last applied texture/materials.
 * Used by AR export (USDZ for iOS, GLB for Android) so that the texture
 * the user selected in the web viewer is preserved in AR mode.
 *
 * @returns The live scene object (do NOT modify — clone before exporting)
 */
export function getLoadedScene(): THREE.Group | null {
  return loadedGltfScene;
}

// ─── Loader Component (Lazy Loading progress indicator) ───
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

// ─── Sofa Model (Lazy Loaded via React Suspense) ───
function SofaModel() {
  // useLoader is lazy — only loads when the component mounts
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

  // Step 1: Extract mesh-material pairs and preload ALL textures (color + normal)
  useEffect(() => {
    if (!gltf.scene) return;

    // Store global reference for WebXR AR fallback
    loadedGltfScene = gltf.scene;

    // Collect ALL target material names (textured + solid-color)
    const allTargetNames = new Set<string>();
    materialGroups.forEach((group) => {
      group.options.forEach((opt) => {
        opt.targetMaterials.forEach((name) => allTargetNames.add(name));
        if (opt.solidColorTargets) {
          opt.solidColorTargets.forEach((name) => allTargetNames.add(name));
        }
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

          if (allTargetNames.has(mat.name)) {
            meshMaterialsRef.current.set(mat.name, {
              mesh,
              originalMaterial: mat,
            });
            // Store original material globally for WebXR AR
            loadedGltfMaterials.set(mat.name, mat);
          }
        }
      }
    });

    console.log("[SofaModel] All materials found:", materialNames);
    setLoaded(true);
  }, [gltf, setLoaded]);

  // Step 2: When user selects a material, create NEW materials and assign them
  useEffect(() => {
    const entries = Object.entries(selectedMaterials);
    if (entries.length === 0) return;

    entries.forEach(([, option]) => {
      if (!option) return;

      const rx = option.repeatX ?? 1;
      const ry = option.repeatY ?? 1;

      // ── Load texture FRESH (not clone) to avoid GPU sync issues ──
      // The browser caches the image, so this is instant after first load.
      const texLoader = new THREE.TextureLoader();

      // Create the material immediately with null map, then fill it in
      const newMaterial = new THREE.MeshStandardMaterial({
        map: null,
        color: 0xffffff,
        normalMap: null,
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

      // Load the color texture
      texLoader.load(
        option.texture,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.repeat.set(rx, ry);
          newMaterial.map = tex;
          newMaterial.needsUpdate = true;
        },
        undefined,
        (err) =>
          console.error(
            `[SofaModel] Color texture load failed: ${option.texture}`,
            err
          )
      );

      // Load the normal map if available
      if (option.normalMap) {
        texLoader.load(
          option.normalMap,
          (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.flipY = false;
            tex.colorSpace = THREE.LinearSRGBColorSpace;
            tex.repeat.set(rx, ry);
            newMaterial.normalMap = tex;
            newMaterial.needsUpdate = true;
          },
          undefined,
          (err) =>
            console.error(
              `[SofaModel] Normal map load failed: ${option.normalMap}`,
              err
            )
        );
      }

      // Apply textured material to meshes WITH UVs
      let texturedCount = 0;
      option.targetMaterials.forEach((matName) => {
        const entry = meshMaterialsRef.current.get(matName);
        if (entry) {
          const mesh = entry.mesh as THREE.Mesh;
          const hasUVs = mesh.geometry.getAttribute("uv") !== undefined;
          if (hasUVs) {
            mesh.material = newMaterial;
            texturedCount++;
          } else {
            // Fallback: apply solid color if mesh unexpectedly has no UVs
            console.warn(
              `[SofaModel] Mesh "${matName}" has no UVs — applying solid color fallback`
            );
            const solidMat = new THREE.MeshStandardMaterial({
              color: option.solidColor
                ? parseInt(option.solidColor, 16)
                : 0xcccccc,
              roughness: option.roughness,
              metalness: option.metalness,
              side: THREE.DoubleSide,
            });
            mesh.material = solidMat;
          }
        }
      });

      // ── Solid color material (for meshes WITHOUT UVs, e.g. stitching) ──
      let solidCount = 0;
      if (option.solidColorTargets && option.solidColorTargets.length > 0) {
        const solidMaterial = new THREE.MeshStandardMaterial({
          color: option.solidColor
            ? parseInt(option.solidColor, 16)
            : 0xcccccc,
          roughness: option.roughness,
          metalness: option.metalness,
          side: THREE.DoubleSide,
        });

        option.solidColorTargets.forEach((matName) => {
          const entry = meshMaterialsRef.current.get(matName);
          if (entry) {
            entry.mesh.material = solidMaterial;
            solidCount++;
          }
        });
      }

      console.log(
        `[SofaModel] ✅ Applied "${option.name}": ${texturedCount} textured + ${solidCount} solid-color meshes` +
          (option.normalMap ? " (with normal map)" : "") +
          ` | repeat=(${rx}, ${ry})`
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

      {/* Lazy-loaded sofa model */}
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

// ─── WebXR AR Session Manager (fallback for Firefox Android) ───
async function startWebXRSession(
  setArActive: (v: boolean) => void
): Promise<void> {
  if (!navigator.xr) {
    alert("WebXR is not available on this device.");
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) {
      alert(
        "AR is not supported on this browser. Try Chrome on Android or Safari on iOS."
      );
      return;
    }

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.getElementById("ar-overlay")! },
    });
    setArActive(true);

    // Create a separate canvas for the AR session
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
    // Preserve drawing buffer for screenshots
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

    // Clone the loaded scene for AR
    if (!loadedGltfScene) {
      alert("Model is still loading. Please wait and try again.");
      session.end();
      return;
    }

    const sofa = loadedGltfScene.clone(true);
    sofa.scale.set(0.5, 0.5, 0.5);
    sofa.visible = false;
    scene.add(sofa);

    // Apply current material selection
    const currentMaterials = useViewerStore.getState().selectedMaterials;
    Object.entries(currentMaterials).forEach(([, option]) => {
      if (!option) return;
      const rx = option.repeatX ?? 1;
      const ry = option.repeatY ?? 1;

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
        tex.repeat.set(rx, ry);
        newMat.map = tex;
        newMat.needsUpdate = true;
      });

      option.targetMaterials.forEach((matName) => {
        sofa.traverse((child: any) => {
          if (child.isMesh && child.material?.name === matName) {
            const hasUVs = child.geometry.getAttribute("uv") !== undefined;
            if (hasUVs) {
              child.material = newMat;
            } else {
              child.material = new THREE.MeshStandardMaterial({
                color: option.solidColor
                  ? parseInt(option.solidColor, 16)
                  : 0xcccccc,
                roughness: option.roughness,
                metalness: option.metalness,
                side: THREE.DoubleSide,
              });
            }
          }
        });
      });

      if (option.solidColorTargets && option.solidColorTargets.length > 0) {
        const solidMat = new THREE.MeshStandardMaterial({
          color: option.solidColor
            ? parseInt(option.solidColor, 16)
            : 0xcccccc,
          roughness: option.roughness,
          metalness: option.metalness,
          side: THREE.DoubleSide,
        });
        option.solidColorTargets.forEach((matName) => {
          sofa.traverse((child: any) => {
            if (child.isMesh && child.material?.name === matName) {
              child.material = solidMat;
            }
          });
        });
      }
    });

    // Hit-test reticle
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
      console.warn("[WebXR AR] Hit test not available");
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
    console.error("[WebXR AR] Failed:", e);
    setArActive(false);
    alert(`AR Error: ${e.message}`);
  }
}

// ─── AR Overlay (WebXR session UI) ───
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

// ─── Main Scene Export ───
export default function Scene() {
  const isDark = useViewerStore((s) => s.isDark);
  const bgColor = isDark ? "#212425" : "#f2f2f2";
  const [arActive, setArActive] = useState(false);

  // Listen for WebXR AR requests (fallback for Firefox Android)
  useEffect(() => {
    const handler = () => startWebXRSession(setArActive);
    window.addEventListener("enter-webxr-ar", handler);
    return () => window.removeEventListener("enter-webxr-ar", handler);
  }, []);

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
          // Preserve drawing buffer for screenshots
          preserveDrawingBuffer: true,
        }}
      >
        <SceneContent />
      </Canvas>

      {/* WebXR AR overlay */}
      <AROverlay arActive={arActive} />
    </>
  );
}
