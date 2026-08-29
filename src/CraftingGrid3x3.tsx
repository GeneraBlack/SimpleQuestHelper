import React, { useState } from "react";
import ItemPicker from "./ItemPicker";
import ItemIcon from "./ItemIcon";
import { CustomItem } from "./types";

interface CraftingGridProps {
  grid: string[];
  onChange: (newGrid: string[]) => void;
  customItems: CustomItem[];
  extraItems: string[];
  exportPath?: string;
}

const CraftingGrid3x3: React.FC<CraftingGridProps> = ({ grid, onChange, customItems, extraItems, exportPath = "" }) => {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const safeGrid = grid && grid.length === 9 ? grid : Array(9).fill("");

  const handleSetSlot = (index: number, val: string) => {
    const next = [...safeGrid];
    next[index] = val;
    onChange(next);
    setActiveSlot(null);
  };

  const handleClearSlot = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...safeGrid];
    next[index] = "";
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#15171c", padding: "12px", borderRadius: "8px", border: "1px solid #2d333f" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "0.85rem", color: "#e5e7eb" }}>🔲 3x3 Crafting Grid</strong>
        <button
          type="button"
          onClick={() => onChange(Array(9).fill(""))}
          style={{ background: "#374151", padding: "2px 6px", fontSize: "0.75rem" }}
        >
          Clear Grid
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 56px)", gap: "6px", justifyContent: "center" }}>
        {safeGrid.map((item, idx) => {
          const isSelected = activeSlot === idx;
          const shortName = item ? (item.includes(":") ? item.split(":")[1] : item) : "";

          return (
            <div
              key={idx}
              onClick={() => setActiveSlot(isSelected ? null : idx)}
              style={{
                width: "56px",
                height: "56px",
                background: isSelected ? "#3b82f633" : item ? "#1e293b" : "#0f172a",
                border: isSelected ? "2px solid #3b82f6" : item ? "1px solid #475569" : "1px dashed #334155",
                borderRadius: "6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
                padding: "2px",
                overflow: "hidden",
                transition: "all 0.15s ease"
              }}
              title={item || `Slot ${idx + 1} (Click to assign)`}
            >
              {item ? (
                <>
                  <ItemIcon item={item} exportPath={exportPath} size={26} />
                  <span style={{ fontSize: "0.6rem", color: "#93c5fd", textAlign: "center", wordBreak: "break-word", lineHeight: "1.0", marginTop: "2px" }}>
                    {shortName.length > 8 ? shortName.slice(0, 7) + "…" : shortName}
                  </span>
                  <button
                    onClick={(e) => handleClearSlot(idx, e)}
                    style={{
                      position: "absolute",
                      top: "1px",
                      right: "1px",
                      background: "transparent",
                      color: "#ef4444",
                      padding: 0,
                      fontSize: "0.75rem",
                      lineHeight: "1"
                    }}
                  >×</button>
                </>
              ) : (
                <span style={{ color: "#475569", fontSize: "0.75rem" }}>{idx + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {activeSlot !== null && (
        <div style={{ marginTop: "6px", padding: "8px", background: "#0b0f17", borderRadius: "6px", border: "1px solid #3b82f6" }}>
          <div style={{ fontSize: "0.75rem", color: "#93c5fd", marginBottom: "4px" }}>
            Select ingredient for <strong>Slot {activeSlot + 1}</strong>:
          </div>
          <ItemPicker
            value={safeGrid[activeSlot]}
            onChange={(val) => handleSetSlot(activeSlot, val)}
            customItems={customItems}
            extraItems={extraItems}
            exportPath={exportPath}
            placeholder="Select ingredient or @mod..."
          />
        </div>
      )}
    </div>
  );
};

export default CraftingGrid3x3;
