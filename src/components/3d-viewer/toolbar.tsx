"use client";

import { materialGroups } from "./materials";
import { useViewerStore } from "./store";
import Image from "next/image";

export default function MaterialToolbar() {
  const selectedMaterials = useViewerStore((s) => s.selectedMaterials);
  const setSelectedMaterial = useViewerStore((s) => s.setSelectedMaterial);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-3 flex-wrap justify-center px-2 max-w-[95vw] sm:bottom-5">
      {materialGroups.map((group) => (
        <div key={group.id} className="flex flex-col items-center gap-1 sm:gap-1">
          <span
            className="text-[10px] sm:text-[13px] font-bold transition-colors duration-700"
            style={{ color: "var(--viewer-text)" }}
          >
            {group.label}
          </span>
          <div
            className="flex items-center gap-1.5 sm:gap-[5px] px-2 py-1.5 sm:p-[5px] rounded-lg backdrop-blur-md transition-all duration-700 max-w-[88vw] sm:max-w-none overflow-x-auto"
            style={{
              background: "var(--viewer-bar-bg)",
              boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
            }}
          >
            {group.options.map((option) => {
              const isSelected =
                selectedMaterials[group.id]?.id === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedMaterial(group.id, option)}
                  className="relative rounded-[10px] sm:rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-110 shrink-0 border-2"
                  style={{
                    width: 34,
                    height: 34,
                    borderColor: isSelected
                      ? "var(--viewer-selected-border)"
                      : "transparent",
                    boxShadow: isSelected
                      ? "0 0 10px rgba(16,185,129,0.4)"
                      : "none",
                  }}
                  title={option.name}
                >
                  <Image
                    src={option.thumb}
                    alt={option.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 34px, 40px"
                    loading="eager"
                    unoptimized
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
