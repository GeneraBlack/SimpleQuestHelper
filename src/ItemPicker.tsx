import React, { useState, useMemo, useRef, useEffect } from 'react';
import { STARTER_ITEMS } from './starterItems';
import ItemIcon from './ItemIcon';
import { CustomItem } from './types';

interface ItemPickerProps {
  value: string;
  onChange: (val: string) => void;
  customItems?: CustomItem[];
  extraItems?: string[];
  placeholder?: string;
  exportPath?: string;
  style?: React.CSSProperties;
}

export default function ItemPicker({
  value,
  onChange,
  customItems = [],
  extraItems = [],
  placeholder = "Item ID (e.g. create:wrench)",
  exportPath = "",
  style,
}: ItemPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Merge all available items: Custom items + Extra synced items + Starter items
  const allItems = useMemo(() => {
    const list = new Set<string>();
    
    // Add custom items
    customItems.forEach(ci => list.add(`kubejs:${ci.id}`));
    
    // Add extra/synced items
    extraItems.forEach(item => list.add(item));
    
    // Add starter items
    STARTER_ITEMS.forEach(item => list.add(item));

    return Array.from(list);
  }, [customItems, extraItems]);

  // Filter items based on user input
  const filtered = useMemo(() => {
    if (!query || query.trim() === '') return allItems.slice(0, 30);

    const q = query.toLowerCase().trim();

    // Mod filter syntax: e.g. "@create"
    if (q.startsWith('@')) {
      const modPrefix = q.slice(1);
      return allItems
        .filter(item => item.split(':')[0].toLowerCase().includes(modPrefix))
        .slice(0, 40);
    }

    // Tag filter syntax: e.g. "#ingots"
    if (q.startsWith('#')) {
      const tagQuery = q.slice(1);
      return allItems
        .filter(item => item.toLowerCase().includes(tagQuery))
        .slice(0, 40);
    }

    // Standard search: matches ID or name part
    return allItems
      .filter(item => item.toLowerCase().includes(q))
      .slice(0, 40);
  }, [allItems, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: string) => {
    onChange(item);
    setQuery(item);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, ...style }}>
      <div style={{ position: 'absolute', left: '8px', zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
        <ItemIcon item={query || value} exportPath={exportPath} size={20} />
      </div>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '8px 10px 8px 34px',
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '4px',
          fontSize: '0.85rem'
        }}
      />
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: '220px',
          overflowY: 'auto',
          background: '#20242c',
          border: '1px solid #3b82f6',
          borderRadius: '0 0 6px 6px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
          zIndex: 1000,
          marginTop: '2px',
        }}>
          <div style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#888', background: '#181b20', borderBottom: '1px solid #2d333f' }}>
            Tip: Filter by <code>@modname</code> (e.g. <code>@create</code>) or <code>#tag</code>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#999' }}>
              No item found (Press Enter to use custom ID)
            </div>
          ) : (
            filtered.map((item) => {
              const [mod, name] = item.includes(':') ? item.split(':') : ['', item];
              return (
                <div
                  key={item}
                  onClick={() => handleSelect(item)}
                  style={{
                    padding: '6px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    borderBottom: '1px solid #282c34',
                    background: query === item ? '#2c3e50' : 'transparent',
                    color: '#e5e7eb'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.background = query === item ? '#2c3e50' : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ItemIcon item={item} size={20} />
                    <span style={{ fontWeight: 500 }}>{name}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#3b82f6', background: '#1e293b', padding: '1px 6px', borderRadius: '3px' }}>
                    {mod}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
