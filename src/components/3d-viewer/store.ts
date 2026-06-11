import { create } from "zustand";
import { MaterialOption } from "./materials";

interface ViewerState {
  isDark: boolean;
  toggleDark: () => void;
  selectedMaterials: Record<string, MaterialOption | null>;
  setSelectedMaterial: (groupId: string, option: MaterialOption) => void;
  isLoaded: boolean;
  setLoaded: (loaded: boolean) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  isDark: false,
  toggleDark: () => set((state) => ({ isDark: !state.isDark })),
  selectedMaterials: {},
  setSelectedMaterial: (groupId, option) =>
    set((state) => ({
      selectedMaterials: {
        ...state.selectedMaterials,
        [groupId]: option,
      },
    })),
  isLoaded: false,
  setLoaded: (loaded) => set({ isLoaded: loaded }),
}));
