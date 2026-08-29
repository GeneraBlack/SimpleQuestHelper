import { useState, useEffect } from 'react';
import { getItemTexture } from './tauriApi';

interface ItemIconProps {
  item?: string;
  size?: number;
  exportPath?: string;
  style?: React.CSSProperties;
  fallbackEmoji?: string;
}

const textureMemoryCache: Record<string, string> = {};

export default function ItemIcon({
  item,
  size = 24,
  exportPath = "",
  style,
  fallbackEmoji,
}: ItemIconProps) {
  const [textureUrl, setTextureUrl] = useState<string | null>(
    item && textureMemoryCache[item] ? textureMemoryCache[item] : null
  );

  useEffect(() => {
    if (!item) {
      setTextureUrl(null);
      return;
    }

    if (textureMemoryCache[item]) {
      setTextureUrl(textureMemoryCache[item]);
      return;
    }

    let isCancelled = false;

    getItemTexture(exportPath, item)
      .then(url => {
        if (!isCancelled && url) {
          textureMemoryCache[item] = url;
          setTextureUrl(url);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [item, exportPath]);

  if (textureUrl) {
    return (
      <img
        src={textureUrl}
        alt={item || "item"}
        style={{
          width: size,
          height: size,
          imageRendering: "pixelated",
          objectFit: "contain",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  // Fallback visual icon
  const getIconFallback = (id?: string) => {
    if (fallbackEmoji) return fallbackEmoji;
    if (!id) return "📦";
    const lower = id.toLowerCase();
    if (lower.includes("sword") || lower.includes("blade")) return "🗡️";
    if (lower.includes("pickaxe") || lower.includes("drill")) return "⛏️";
    if (lower.includes("axe")) return "🪓";
    if (lower.includes("shovel")) return "🧹";
    if (lower.includes("ingot") || lower.includes("ore") || lower.includes("dust") || lower.includes("raw")) return "🪙";
    if (lower.includes("gem") || lower.includes("crystal") || lower.includes("diamond") || lower.includes("emerald")) return "💎";
    if (lower.includes("book") || lower.includes("guide")) return "📖";
    if (lower.includes("block") || lower.includes("stone") || lower.includes("wood") || lower.includes("log")) return "🧱";
    if (lower.includes("energy") || lower.includes("battery") || lower.includes("cell") || lower.includes("generator") || lower.includes("solar")) return "⚡";
    if (lower.includes("fluid") || lower.includes("water") || lower.includes("lava") || lower.includes("oil") || lower.includes("acid")) return "🧪";
    if (lower.includes("chest") || lower.includes("crate") || lower.includes("storage")) return "📦";
    if (lower.includes("gear") || lower.includes("core") || lower.includes("machine") || lower.includes("pulverizer") || lower.includes("assembler")) return "⚙️";
    return "🔹";
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        fontSize: `${Math.max(12, size * 0.7)}px`,
        flexShrink: 0,
        ...style,
      }}
      title={item}
    >
      {getIconFallback(item)}
    </span>
  );
}
