export interface MaterialOption {
  id: string;
  name: string;
  thumb: string;
  texture: string;
  normalMap?: string;
  normalScale?: number;
  roughness: number;
  metalness: number;
  // Apply to ALL these material names in the GLB
  targetMaterials: string[];
}

export interface MaterialGroup {
  id: string;
  label: string;
  options: MaterialOption[];
}

// Material names found in sanctuary_modular-v3.glb:
// "M_Fabric_Sand"    → Main sofa fabric body (104K vertices)
// "M_StitchHole"     → Stitching holes (47K vertices)
// "M_Stitch"         → Stitching threads (105K vertices)
// "M_Rubber"         → Rubber feet (4K vertices) - keep as-is

const SOFA_UPHOLSTERY_MATERIALS = [
  "M_Fabric_Sand",
  "M_StitchHole",
  "M_Stitch",
];

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
        roughness: 0.75,
        metalness: 0.0,
        targetMaterials: SOFA_UPHOLSTERY_MATERIALS,
      },
      {
        id: "fabric-2",
        name: "Charcoal",
        thumb: "/textures/fabric/fabric-3.png",
        texture: "/textures/fabric/fabric-4.png",
        normalMap: FABRIC_NORMAL_MAP,
        normalScale: 1.0,
        roughness: 0.75,
        metalness: 0.0,
        targetMaterials: SOFA_UPHOLSTERY_MATERIALS,
      },
    ],
  },
];
