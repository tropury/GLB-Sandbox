export interface MaterialOption {
  id: string;
  name: string;
  thumb: string;
  texture: string;
  normalMap?: string;
  normalScale?: number;
  // Tiling repeat — multiplies UV coordinates.
  // The model's M_Fabric_Sand UVs span ~12 units, so:
  //   repeat=1   → tiles 12× (too dense, looks like tiny squares)
  //   repeat=0.25 → tiles 3×  (good for fabric weave)
  repeatX?: number;
  repeatY?: number;
  roughness: number;
  metalness: number;
  // Apply full textured material to these meshes (must have UVs)
  targetMaterials: string[];
  // Apply matching solid color to these meshes (no UVs available)
  solidColorTargets?: string[];
  // Hex color for solid-color targets (e.g. "8a7a60")
  solidColor?: string;
}

export interface MaterialGroup {
  id: string;
  label: string;
  options: MaterialOption[];
}

// Material names found in sanctuary_modular-v3.glb:
// "M_Fabric_Sand"    → Main sofa fabric body (104K vertices) — HAS UVs, range ~12 units
// "M_StitchHole"     → Stitching holes (47K vertices) — NO UVs
// "M_Stitch"         → Stitching threads (105K vertices) — NO UVs
// "M_Rubber"         → Rubber feet (4K vertices) — NO UVs, keep as-is

// Only M_Fabric_Sand has UV coordinates, so only it can receive texture maps.
// M_StitchHole and M_Stitch get a matching solid color instead.

const TEXTURED_TARGETS = ["M_Fabric_Sand"];
const SOLID_COLOR_TARGETS = ["M_StitchHole", "M_Stitch"];

// Shared normal map for all fabric options
const FABRIC_NORMAL_MAP = "/textures/fabric/Fabric_NormalMap-01.png";

export const materialGroups: MaterialGroup[] = [
  {
    id: "estofado",
    label: "Fabric",
    options: [
      {
        id: "fabric-1",
        name: "Sand",
        thumb: "/textures/fabric/fabric-1.png",
        texture: "/textures/fabric/fabric-2.png",
        normalMap: FABRIC_NORMAL_MAP,
        normalScale: 1.0,
        // With UV range ~12, repeat=0.25 → ~3 tiles across surface (natural fabric density)
        repeatX: 0.25,
        repeatY: 0.25,
        roughness: 0.75,
        metalness: 0.0,
        targetMaterials: TEXTURED_TARGETS,
        solidColorTargets: SOLID_COLOR_TARGETS,
        solidColor: "c4b49a",
      },
      {
        id: "fabric-2",
        name: "Charcoal",
        thumb: "/textures/fabric/fabric-3.png",
        texture: "/textures/fabric/fabric-4.png",
        normalMap: FABRIC_NORMAL_MAP,
        normalScale: 1.0,
        repeatX: 0.25,
        repeatY: 0.25,
        roughness: 0.75,
        metalness: 0.0,
        targetMaterials: TEXTURED_TARGETS,
        solidColorTargets: SOLID_COLOR_TARGETS,
        solidColor: "4a4a4a",
      },
    ],
  },
];
