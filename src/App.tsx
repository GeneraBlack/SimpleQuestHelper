import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ModpackData, Recipe, QuestNode } from "./types";
import {
  pickDirectory,
  pickImageFile,
  saveProjectJson,
  loadProjectJson,
  saveAutosave,
  loadAutosave,
  runModpackLinter,
  getSystemLogs,
  clearSystemLogs,
  isTauriEnvironment,
} from "./tauriApi";
import QuestBuilder from "./QuestBuilder";
import ItemPicker from "./ItemPicker";
import CraftingGrid3x3 from "./CraftingGrid3x3";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("items");
  const [exportPath, setExportPath] = useState("");
  const [status, setStatus] = useState("");
  const [detectedMods, setDetectedMods] = useState<string[]>([]);
  const [syncedItems, setSyncedItems] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("");

  const [data, setData] = useState<ModpackData>({
    items: [],
    blocks: [],
    recipes: [],
    removed_recipes: [],
    item_restrictions: [],
    reward_tables: [
      {
        id: "starter_minerals",
        title: "Choice: Starter Minerals",
        icon: "minecraft:chest",
        is_loot_crate: false,
        rewards: [
          { item: "minecraft:iron_ingot", count: 8, weight: 10 },
          { item: "minecraft:copper_ingot", count: 16, weight: 15 },
          { item: "minecraft:gold_ingot", count: 4, weight: 5 }
        ]
      }
    ],
    chapters: [
      { id: "chapter_1", title: "Main Progression", icon: "minecraft:book", quests: [] }
    ],
    tags: [],
    hidden_items: [],
    disable_vanilla_ores: false,
    custom_loot: [],
    starter_items: [
      { item: "minecraft:book", count: 1 }
    ],
    stages: [],
    custom_mechanics: [
      "minecraft:crafting_shaped",
      "minecraft:crafting_shapeless",
      "minecraft:smelting"
    ]
  });

  const [lintIssues, setLintIssues] = useState<any[]>([]);
  const [isLinterOpen, setIsLinterOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [detectedVersion, setDetectedVersion] = useState<string>("1.21.1");
  const [detectedLoader, setDetectedLoader] = useState<string>("NeoForge");

  const runLinter = async () => {
    try {
      const issues = await runModpackLinter(data);
      setLintIssues(issues);
      setIsLinterOpen(true);
    } catch (e) {
      console.error("Linter error:", e);
    }
  };

  const refreshLogs = async () => {
    try {
      const logs = await getSystemLogs();
      setSystemLogs(logs);
    } catch (e) {
      console.warn("Failed to fetch system logs:", e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isLogsOpen) {
      refreshLogs();
      interval = setInterval(refreshLogs, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLogsOpen]);

  // 1. Initial Load from Auto-Save on App Startup
  useEffect(() => {
    async function loadSavedState() {
      try {
        const saved = await loadAutosave();
        if (saved) {
          setData(saved);
          setStatus("✓ Restored previous project from autosave cache!");
          setLastSaved("Recently restored");
        }
      } catch (e) {
        console.warn("Failed to load autosave:", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSavedState();
  }, []);

  // 2. Debounced Auto-Save on any Data Change
  useEffect(() => {
    if (!isLoaded) return;

    const timer = setTimeout(async () => {
      try {
        await saveAutosave(data);
        const now = new Date().toLocaleTimeString();
        setLastSaved(now);
      } catch (e) {
        console.warn("Autosave error:", e);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [data, isLoaded]);

  const fetchSyncedData = async (path: string) => {
    if (!path || !isTauriEnvironment()) return;
    try {
      const synced = await invoke<{ 
        items: string[], 
        mechanics: string[], 
        detected_mods: string[],
        detected_version?: string,
        detected_loader?: string
      }>("get_synced_data", {
        exportPath: path,
      });

      if (synced) {
        setDetectedMods(synced.detected_mods);
        setSyncedItems(synced.items);
        if (synced.detected_version) setDetectedVersion(synced.detected_version);
        if (synced.detected_loader) setDetectedLoader(synced.detected_loader);
        
        setData(prev => {
          const mergedMechanics = Array.from(new Set([...prev.custom_mechanics, ...synced.mechanics]));
          return {
            ...prev,
            target_version: prev.target_version || synced.detected_version || "1.21.1",
            custom_mechanics: mergedMechanics,
          };
        });

        if (synced.detected_mods.length > 0 || synced.items.length > 0) {
          setStatus(`Sync successful! Minecraft ${synced.detected_version || '1.21.1'} (${synced.detected_loader || 'NeoForge'}), ${synced.detected_mods.length} mods, ${synced.items.length} items & ${synced.mechanics.length} mechanics loaded.`);
        }
      }
    } catch (e) {
      console.warn("Failed to load sync data:", e);
    }
  };

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    const unlisten = listen("sqh-sync-updated", async () => {
      setStatus("Auto-Sync: New Minecraft KubeJS dumps detected! Updating registry...");
      if (exportPath) {
        await fetchSyncedData(exportPath);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [exportPath]);

  // 3. Manual Project File Export / Import
  const handleExportProjectFile = async () => {
    try {
      const res = await saveProjectJson(data);
      if (res) {
        setStatus(`✓ Project file saved: ${res}`);
      }
    } catch (e) {
      setStatus(`Error saving project file: ${e}`);
    }
  };

  const handleImportProjectFile = async () => {
    try {
      const loaded = await loadProjectJson();
      if (loaded) {
        setData(loaded);
        setStatus(`✓ Project loaded successfully!`);
      }
    } catch (e) {
      setStatus(`Error opening project file: ${e}`);
    }
  };

  const createQuestFromRecipe = (recipe: Recipe) => {
    if (data.chapters.length === 0) {
      setStatus("Please create a chapter in the Quest Tree first!");
      return;
    }

    const firstOutput = recipe.outputs[0]?.item || "Custom Crafting";
    const cleanTitle = firstOutput.includes(':') ? firstOutput.split(':')[1].replace(/_/g, ' ') : firstOutput;

    const newQuest: QuestNode = {
      id: `quest_${Date.now()}`,
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      description: `Craft ${firstOutput} using ${recipe.recipe_type}.`,
      dependencies: [],
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      tasks: recipe.inputs.filter(i => i.item).map(i => ({
        task_type: "item",
        item: i.item,
        count: i.count || 1,
      })),
      rewards: [
        ...recipe.outputs.filter(o => o.item).map(o => ({
          reward_type: "item",
          item: o.item,
          count: o.count || 1,
        })),
        ...(recipe.stage_required ? [{
          reward_type: "stage",
          item: null,
          count: null,
          stage: recipe.stage_required,
        }] : [])
      ]
    };

    const newChapters = [...data.chapters];
    newChapters[0].quests.push(newQuest);
    setData({ ...data, chapters: newChapters });
    setStatus(`✓ Quest "${newQuest.title}" automatically created in chapter "${newChapters[0].title}"!`);
  };

  const addItem = () => {
    setData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: `custom_item_${prev.items.length + 1}`, name: "New Item", texture_path: null },
      ],
    }));
  };

  const selectTexture = async (index: number) => {
    try {
      const selected = await pickImageFile();
      if (selected) {
        const newItems = [...data.items];
        newItems[index].texture_path = selected;
        setData({ ...data, items: newItems });
      }
    } catch (e) {
      console.error("Texture selection error:", e);
      setStatus(`Error selecting texture: ${e}`);
    }
  };

  const handleImportExistingModpack = async () => {
    if (!exportPath) {
      setStatus("Please select your Minecraft Instance Folder first!");
      return;
    }
    try {
      setStatus("Reading existing FTB Quests, KubeJS scripts & Reward Tables...");
      const importedData = await invoke<ModpackData>("import_modpack_project", {
        exportPath: exportPath,
      });

      if (importedData) {
        setData(prev => ({
          ...importedData,
          custom_mechanics: Array.from(new Set([...prev.custom_mechanics, ...importedData.custom_mechanics])),
        }));
        await fetchSyncedData(exportPath);
        const questCount = importedData.chapters.reduce((acc, c) => acc + c.quests.length, 0);
        setStatus(`✓ Modpack successfully loaded! Imported ${importedData.chapters.length} Quest Chapters (${questCount} Quests), ${importedData.recipes.length} Custom Recipes, ${importedData.removed_recipes.length} Recipe Removals, and ${importedData.items.length} Custom Items.`);
      }
    } catch (e) {
      setStatus(`Error importing modpack: ${e}`);
    }
  };

  const selectExportDir = async () => {
    try {
      const selected = await pickDirectory();
      if (selected) {
        setExportPath(selected);
        await fetchSyncedData(selected);
      }
    } catch (e) {
      console.error("Directory picker error:", e);
      setStatus(`Error selecting folder: ${e}`);
    }
  };

  const handleExport = async () => {
    if (!isTauriEnvironment()) {
      setStatus("ℹ️ Direct file generation to Minecraft directories requires the Tauri desktop app (npm run tauri dev). You can save the project JSON via 'Save' button.");
      return;
    }
    try {
      setStatus("Generating files...");
      const response = await invoke<string>("generate_modpack_files", {
        exportPath: exportPath,
        projectData: data,
      });
      setStatus(response);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  const handleSetupSync = async () => {
    if (!isTauriEnvironment()) {
      setStatus("ℹ️ Auto-Sync with Minecraft requires the Tauri desktop app (npm run tauri dev).");
      return;
    }
    try {
      setStatus("Configuring Auto-Sync...");
      const response = await invoke<string>("setup_autosync", {
        exportPath: exportPath,
      });
      setStatus(response);
      await fetchSyncedData(exportPath);
    } catch (e) {
      setStatus(`Error setting up sync: ${e}`);
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>SimpleQuestHelper</h2>
        <div style={{ display: "flex", gap: "6px", marginBottom: "15px" }}>
          <button 
            onClick={handleExportProjectFile} 
            style={{ flex: 1, padding: "5px 6px", fontSize: "0.75rem", background: "#374151" }}
            title="Save project as .json file"
          >
            💾 Save
          </button>
          <button 
            onClick={handleImportProjectFile} 
            style={{ flex: 1, padding: "5px 6px", fontSize: "0.75rem", background: "#374151" }}
            title="Open saved .json project"
          >
            📂 Open
          </button>
        </div>

        <button onClick={() => setActiveTab("items")} className={activeTab === "items" ? "active" : ""}>Items & Blocks</button>
        <button onClick={() => setActiveTab("recipes")} className={activeTab === "recipes" ? "active" : ""}>Recipes</button>
        <button onClick={() => setActiveTab("quests")} className={activeTab === "quests" ? "active" : ""}>Quest Tree</button>
        <button onClick={() => setActiveTab("tables")} className={activeTab === "tables" ? "active" : ""}>Reward Tables</button>
        <button onClick={() => setActiveTab("advanced")} className={activeTab === "advanced" ? "active" : ""}>Advanced</button>
        <button onClick={() => setActiveTab("export")} className={activeTab === "export" ? "active" : ""}>Export</button>

        <button 
          onClick={runLinter} 
          style={{ marginTop: "15px", background: "#6366f1", fontWeight: "bold", fontSize: "0.82rem" }}
          title="Scans the entire modpack for deadlocks, circular dependencies, and missing assets"
        >
          🧠 Check Logic
        </button>

        <button 
          onClick={() => setIsLogsOpen(true)} 
          style={{ marginTop: "8px", background: "#374151", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          title="View live backend and frontend logs"
        >
          <span>🐛</span> System Logs
        </button>

        <div style={{ marginTop: "auto", padding: "10px", background: "#181b20", borderRadius: "6px", fontSize: "0.75rem", color: "#9ca3af", border: "1px solid #2d333f" }}>
          <div style={{ color: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>●</span> Auto-Save Active
          </div>
          {lastSaved && <div style={{ fontSize: "0.7rem", marginTop: "3px", color: "#6b7280" }}>Status: {lastSaved}</div>}
        </div>
      </div>
      <div className="main-content">
        {/* ITEMS TAB */}
        {activeTab === "items" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>Custom Items</h3>
              <button onClick={addItem} style={{ background: "#4caf50" }}>+ Add Item</button>
            </div>
            <div className="list">
              {data.items.length === 0 && <p style={{ color: "#aaa" }}>No custom items created yet.</p>}
              {data.items.map((item, idx) => (
                <div key={idx} className="card" style={{ position: "relative" }}>
                  <button 
                    onClick={() => {
                      const newItems = data.items.filter((_, i) => i !== idx);
                      setData({ ...data, items: newItems });
                    }}
                    style={{ position: "absolute", right: "10px", top: "10px", background: "#f44336", padding: "4px 8px", fontSize: "0.8rem" }}
                  >Delete</button>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      <input
                        value={item.id}
                        onChange={(e) => {
                          const newItems = [...data.items];
                          newItems[idx].id = e.target.value;
                          setData({ ...data, items: newItems });
                        }}
                        placeholder="Item ID (e.g. copper_gear)"
                        style={{ flex: 1 }}
                      />
                      <input
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...data.items];
                          newItems[idx].name = e.target.value;
                          setData({ ...data, items: newItems });
                        }}
                        placeholder="Display Name"
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div>
                      <input
                        value={item.tooltip || ""}
                        onChange={(e) => {
                          const newItems = [...data.items];
                          newItems[idx].tooltip = e.target.value;
                          setData({ ...data, items: newItems });
                        }}
                        placeholder="Item Tooltip / Lore (e.g. §7Used in Smeltery Phase 2)"
                        style={{ width: "100%", background: "#111", fontSize: "0.85rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button onClick={() => selectTexture(idx)} style={{ background: "#2196f3" }}>Select Texture</button>
                      <span className="texture-label">{item.texture_path || "No texture selected"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECIPES TAB */}
        {activeTab === "recipes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>Recipes</h3>
              <button onClick={() => {
                setData(prev => ({
                  ...prev,
                  recipes: [...prev.recipes, { recipe_type: "minecraft:crafting_shaped", inputs: [], outputs: [], additional_data: null, stage_required: undefined }]
                }));
              }} style={{ background: "#4caf50" }}>+ Add Recipe</button>
            </div>
            
            <div className="list">
              {data.recipes.length === 0 && <p style={{ color: "#aaa" }}>No recipes created yet.</p>}
              {data.recipes.map((recipe, rIdx) => (
                <div key={rIdx} className="card" style={{ flexDirection: "column", alignItems: "flex-start", position: "relative", padding: "20px" }}>
                  <div style={{ position: "absolute", right: "10px", top: "10px", display: "flex", gap: "8px" }}>
                    <button 
                      onClick={() => createQuestFromRecipe(recipe)}
                      style={{ background: "#8b5cf6", padding: "4px 10px", fontSize: "0.8rem" }}
                      title="Automatically creates a corresponding quest for this recipe in the quest tree"
                    >
                      ⚡ Quest from Recipe
                    </button>
                    <button 
                      onClick={() => {
                        const newRecipes = data.recipes.filter((_, i) => i !== rIdx);
                        setData({ ...data, recipes: newRecipes });
                      }}
                      style={{ background: "#f44336", padding: "4px 8px", fontSize: "0.8rem" }}
                    >Delete Recipe</button>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px", width: "100%", marginTop: "10px" }}>
                    <select
                      value={recipe.recipe_type}
                      onChange={(e) => {
                        const newRecipes = [...data.recipes];
                        newRecipes[rIdx].recipe_type = e.target.value;
                        setData({ ...data, recipes: newRecipes });
                      }}
                      style={{ background: "#1a1a1a", color: "white", padding: "8px", borderRadius: "4px", flex: 1 }}
                    >
                      {data.custom_mechanics.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={recipe.stage_required || ""}
                      onChange={(e) => {
                        const newRecipes = [...data.recipes];
                        newRecipes[rIdx].stage_required = e.target.value === "" ? undefined : e.target.value;
                        setData({ ...data, recipes: newRecipes });
                      }}
                      style={{ background: "#1a1a1a", color: "white", padding: "8px", borderRadius: "4px", flex: 1 }}
                    >
                      <option value="">No Stage Required</option>
                      {data.stages.map(s => (
                        <option key={s} value={s}>Stage: {s}</option>
                      ))}
                    </select>
                  </div>
                  
                  {recipe.recipe_type === "minecraft:crafting_shaped" ? (
                    <div style={{ display: "flex", gap: "20px", width: "100%", alignItems: "flex-start" }}>
                      <div style={{ flex: "0 0 200px" }}>
                        <CraftingGrid3x3 
                          grid={recipe.grid || Array(9).fill("")}
                          onChange={(newGrid) => {
                            const newRecipes = [...data.recipes];
                            newRecipes[rIdx].grid = newGrid;
                            setData({ ...data, recipes: newRecipes });
                          }}
                          customItems={data.items}
                          extraItems={syncedItems}
                          exportPath={exportPath}
                        />
                      </div>

                      <div style={{ flex: 1, background: "#1a1a1a", padding: "10px", borderRadius: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "5px", marginBottom: "10px" }}>
                          <strong>Output (Result)</strong>
                          <button style={{ padding: "2px 6px", fontSize: "0.75rem", background: "#4caf50" }} onClick={() => {
                            const newRecipes = [...data.recipes];
                            if (newRecipes[rIdx].outputs.length === 0) {
                              newRecipes[rIdx].outputs.push({ item: "", count: 1 });
                              setData({ ...data, recipes: newRecipes });
                            }
                          }}>+ Output</button>
                        </div>
                        
                        {recipe.outputs.length === 0 && <p style={{ fontSize: "0.8rem", color: "#666" }}>No outputs defined.</p>}
                        {recipe.outputs.map((output, oIdx) => (
                          <div key={oIdx} style={{ display: "flex", gap: "5px", marginBottom: "8px", alignItems: "center" }}>
                            <ItemPicker
                              value={output.item}
                              onChange={(val) => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].outputs[oIdx].item = val;
                                setData({ ...data, recipes: newRecipes });
                              }}
                              customItems={data.items}
                              extraItems={syncedItems}
                              exportPath={exportPath}
                              placeholder="Select result item or @mod..."
                            />
                            <input
                              type="number"
                              placeholder="Count"
                              value={output.count || 1}
                              onChange={(e) => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].outputs[oIdx].count = parseInt(e.target.value) || 1;
                                setData({ ...data, recipes: newRecipes });
                              }}
                              style={{ width: "55px", padding: "6px" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "20px", width: "100%" }}>
                      <div style={{ flex: 1, background: "#1a1a1a", padding: "10px", borderRadius: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "5px", marginBottom: "10px" }}>
                          <strong>Inputs (Ingredients)</strong>
                          <button style={{ padding: "2px 6px", fontSize: "0.75rem", background: "#4caf50" }} onClick={() => {
                            const newRecipes = [...data.recipes];
                            newRecipes[rIdx].inputs.push({ item: "", count: 1 });
                            setData({ ...data, recipes: newRecipes });
                          }}>+ Input</button>
                        </div>
                        
                        {recipe.inputs.length === 0 && <p style={{ fontSize: "0.8rem", color: "#666" }}>No inputs defined.</p>}
                        {recipe.inputs.map((input, iIdx) => (
                          <div key={iIdx} style={{ display: "flex", gap: "5px", marginBottom: "8px", alignItems: "center" }}>
                            <ItemPicker
                              value={input.item}
                              onChange={(val) => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].inputs[iIdx].item = val;
                                setData({ ...data, recipes: newRecipes });
                              }}
                              customItems={data.items}
                              extraItems={syncedItems}
                              exportPath={exportPath}
                              placeholder="Select ingredient or @mod..."
                            />
                            <input
                              type="number"
                              placeholder="Count"
                              value={input.count || 1}
                              onChange={(e) => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].inputs[iIdx].count = parseInt(e.target.value) || 1;
                                setData({ ...data, recipes: newRecipes });
                              }}
                              style={{ width: "55px", padding: "6px" }}
                            />
                            <button 
                              onClick={() => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].inputs.splice(iIdx, 1);
                                setData({ ...data, recipes: newRecipes });
                              }}
                              style={{ background: "transparent", color: "#f44336", padding: "0 5px", fontSize: "1.2rem", fontWeight: "bold" }}
                            >×</button>
                          </div>
                        ))}
                      </div>

                      <div style={{ flex: 1, background: "#1a1a1a", padding: "10px", borderRadius: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "5px", marginBottom: "10px" }}>
                          <strong>Outputs (Result)</strong>
                          <button style={{ padding: "2px 6px", fontSize: "0.75rem", background: "#4caf50" }} onClick={() => {
                            const newRecipes = [...data.recipes];
                            newRecipes[rIdx].outputs.push({ item: "", count: 1 });
                            setData({ ...data, recipes: newRecipes });
                          }}>+ Output</button>
                        </div>
                        
                        {recipe.outputs.length === 0 && <p style={{ fontSize: "0.8rem", color: "#666" }}>No outputs defined.</p>}
                        {recipe.outputs.map((output, oIdx) => (
                          <div key={oIdx} style={{ display: "flex", gap: "5px", marginBottom: "8px", alignItems: "center" }}>
                            <ItemPicker
                              value={output.item}
                              onChange={(val) => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].outputs[oIdx].item = val;
                                setData({ ...data, recipes: newRecipes });
                              }}
                              customItems={data.items}
                              extraItems={syncedItems}
                              placeholder="Select result item or @mod..."
                            />
                            <input
                              type="number"
                              placeholder="Count"
                              value={output.count || 1}
                              onChange={(e) => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].outputs[oIdx].count = parseInt(e.target.value) || 1;
                                setData({ ...data, recipes: newRecipes });
                              }}
                              style={{ width: "55px", padding: "6px" }}
                            />
                            <button 
                              onClick={() => {
                                const newRecipes = [...data.recipes];
                                newRecipes[rIdx].outputs.splice(oIdx, 1);
                                setData({ ...data, recipes: newRecipes });
                              }}
                              style={{ background: "transparent", color: "#f44336", padding: "0 5px", fontSize: "1.2rem", fontWeight: "bold" }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recipe Removals & Blacklist */}
            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginTop: "30px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <h4 style={{ margin: 0 }}>🪓 Disabled Recipes (Recipe Removals / Blacklist)</h4>
                  <p style={{ fontSize: "0.85rem", color: "#aaa", margin: "4px 0 0 0" }}>Disable vanilla or mod recipes (e.g. to restrict wooden tools or force custom machinery).</p>
                </div>
                <button onClick={() => {
                  setData({
                    ...data,
                    removed_recipes: [...data.removed_recipes, { target: "minecraft:wooden_pickaxe", removal_type: "output" }]
                  });
                }} style={{ background: "#ef4444" }}>+ Add Recipe Removal</button>
              </div>

              <div style={{ width: "100%", marginTop: "15px" }}>
                {data.removed_recipes.length === 0 && <p style={{ color: "#666", fontSize: "0.85rem" }}>No recipes disabled.</p>}
                {data.removed_recipes.map((rem, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <select
                      value={rem.removal_type}
                      onChange={(e) => {
                        const newRems = [...data.removed_recipes];
                        newRems[idx].removal_type = e.target.value as any;
                        setData({ ...data, removed_recipes: newRems });
                      }}
                      style={{ background: "#1a1a1a", color: "white", padding: "6px" }}
                    >
                      <option value="output">By Output Item</option>
                      <option value="type">By Recipe Type</option>
                      <option value="id">By Recipe ID</option>
                      <option value="mod">By Mod ID</option>
                    </select>

                    {rem.removal_type === "output" ? (
                      <ItemPicker
                        value={rem.target}
                        onChange={(val) => {
                          const newRems = [...data.removed_recipes];
                          newRems[idx].target = val;
                          setData({ ...data, removed_recipes: newRems });
                        }}
                        customItems={data.items}
                        extraItems={syncedItems}
                        exportPath={exportPath}
                        placeholder="Select item ID (e.g. minecraft:iron_sword)..."
                      />
                    ) : (
                      <input
                        value={rem.target}
                        onChange={(e) => {
                          const newRems = [...data.removed_recipes];
                          newRems[idx].target = e.target.value;
                          setData({ ...data, removed_recipes: newRems });
                        }}
                        placeholder="e.g. minecraft:smelting or create"
                        style={{ flex: 1, padding: "6px" }}
                      />
                    )}

                    <button 
                      onClick={() => {
                        const newRems = data.removed_recipes.filter((_, i) => i !== idx);
                        setData({ ...data, removed_recipes: newRems });
                      }}
                      style={{ background: "transparent", color: "#f44336", padding: "0 6px", fontSize: "1.2rem", fontWeight: "bold" }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* QUEST TREE TAB */}
        {activeTab === "quests" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <h3>Quest Tree</h3>
            <QuestBuilder data={data} setData={setData} exportPath={exportPath} />
          </div>
        )}

        {/* ADVANCED TAB */}
        {activeTab === "advanced" && (
          <div>
            <h3>Advanced Progression Features</h3>
            
            {/* Starter Items */}
            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <h4 style={{ margin: 0 }}>Starter Items (Initial Inventory)</h4>
                  <p style={{ fontSize: "0.85rem", color: "#aaa", margin: "4px 0 0 0" }}>Items given to the player upon their very first login to the world.</p>
                </div>
                <button onClick={() => {
                  setData({ ...data, starter_items: [...data.starter_items, { item: "minecraft:apple", count: 8 }] });
                }} style={{ background: "#4caf50" }}>+ Add Starter Item</button>
              </div>

              <div style={{ width: "100%", marginTop: "10px" }}>
                {data.starter_items.length === 0 && <p style={{ color: "#666", fontSize: "0.85rem" }}>No starter items configured.</p>}
                {data.starter_items.map((st, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                    <ItemPicker
                      value={st.item}
                      onChange={(val) => {
                        const newStarters = [...data.starter_items];
                        newStarters[idx].item = val;
                        setData({ ...data, starter_items: newStarters });
                      }}
                      customItems={data.items}
                      extraItems={syncedItems}
                      exportPath={exportPath}
                      placeholder="Select item..."
                    />
                    <input
                      type="number"
                      placeholder="Count"
                      value={st.count || 1}
                      onChange={(e) => {
                        const newStarters = [...data.starter_items];
                        newStarters[idx].count = parseInt(e.target.value) || 1;
                        setData({ ...data, starter_items: newStarters });
                      }}
                      style={{ width: "60px", padding: "6px" }}
                    />
                    <button 
                      onClick={() => {
                        const newStarters = data.starter_items.filter((_, i) => i !== idx);
                        setData({ ...data, starter_items: newStarters });
                      }}
                      style={{ background: "transparent", color: "#f44336", padding: "0 6px", fontSize: "1.2rem", fontWeight: "bold" }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Loot & Mob Drops */}
            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <h4 style={{ margin: 0 }}>Custom Loot Tables & Mob Drops</h4>
                  <p style={{ fontSize: "0.85rem", color: "#aaa", margin: "4px 0 0 0" }}>Configure custom drops and drop chances for mobs and broken blocks.</p>
                </div>
                <button onClick={() => {
                  setData({ ...data, custom_loot: [...data.custom_loot, { target: "minecraft:zombie", target_type: "entity", chance: 0.35, drops: [{ item: "minecraft:iron_nugget", count: 1 }] }] });
                }} style={{ background: "#4caf50" }}>+ Add Loot Rule</button>
              </div>

              <div style={{ width: "100%", marginTop: "10px" }}>
                {data.custom_loot.length === 0 && <p style={{ color: "#666", fontSize: "0.85rem" }}>No loot rules defined.</p>}
                {data.custom_loot.map((loot, idx) => (
                  <div key={idx} style={{ padding: "12px", background: "#1a1a1a", borderRadius: "6px", marginBottom: "10px", border: "1px solid #333" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                      <select
                        value={loot.target_type}
                        onChange={(e) => {
                          const newLoot = [...data.custom_loot];
                          newLoot[idx].target_type = e.target.value;
                          setData({ ...data, custom_loot: newLoot });
                        }}
                        style={{ background: "#111", color: "white", padding: "6px" }}
                      >
                        <option value="entity">Mob (Entity)</option>
                        <option value="block">Block</option>
                      </select>

                      <input
                        value={loot.target}
                        onChange={(e) => {
                          const newLoot = [...data.custom_loot];
                          newLoot[idx].target = e.target.value;
                          setData({ ...data, custom_loot: newLoot });
                        }}
                        placeholder="Target ID (e.g. minecraft:zombie)"
                        style={{ flex: 1, padding: "6px" }}
                      />

                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontSize: "0.8rem", color: "#aaa" }}>Chance:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          value={loot.chance !== undefined ? loot.chance : 1.0}
                          onChange={(e) => {
                            const newLoot = [...data.custom_loot];
                            newLoot[idx].chance = parseFloat(e.target.value) || 1.0;
                            setData({ ...data, custom_loot: newLoot });
                          }}
                          style={{ width: "65px", padding: "6px" }}
                        />
                      </div>

                      <button 
                        onClick={() => {
                          const newLoot = data.custom_loot.filter((_, i) => i !== idx);
                          setData({ ...data, custom_loot: newLoot });
                        }}
                        style={{ background: "#f44336", padding: "4px 8px", fontSize: "0.8rem" }}
                      >Delete</button>
                    </div>

                    <div style={{ paddingLeft: "10px", borderLeft: "2px solid #4f46e5" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "0.8rem", color: "#aaa" }}>Drops:</span>
                        <button style={{ padding: "2px 6px", fontSize: "0.75rem", background: "#4f46e5" }} onClick={() => {
                          const newLoot = [...data.custom_loot];
                          newLoot[idx].drops.push({ item: "", count: 1 });
                          setData({ ...data, custom_loot: newLoot });
                        }}>+ Drop Item</button>
                      </div>

                      {loot.drops.map((drop, dIdx) => (
                        <div key={dIdx} style={{ display: "flex", gap: "6px", marginBottom: "4px", alignItems: "center" }}>
                          <ItemPicker
                            value={drop.item}
                            onChange={(val) => {
                              const newLoot = [...data.custom_loot];
                              newLoot[idx].drops[dIdx].item = val;
                              setData({ ...data, custom_loot: newLoot });
                            }}
                            customItems={data.items}
                            extraItems={syncedItems}
                            exportPath={exportPath}
                            placeholder="Dropped item..."
                          />
                          <input
                            type="number"
                            value={drop.count || 1}
                            onChange={(e) => {
                              const newLoot = [...data.custom_loot];
                              newLoot[idx].drops[dIdx].count = parseInt(e.target.value) || 1;
                              setData({ ...data, custom_loot: newLoot });
                            }}
                            style={{ width: "55px", padding: "6px" }}
                          />
                          <button 
                            onClick={() => {
                              const newLoot = [...data.custom_loot];
                              newLoot[idx].drops.splice(dIdx, 1);
                              setData({ ...data, custom_loot: newLoot });
                            }}
                            style={{ background: "transparent", color: "#f44336", padding: "0 4px", fontSize: "1.1rem" }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Item & Block Restrictions */}
            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <h4 style={{ margin: 0 }}>🛡️ Item & Block Restrictions (Stage Locks)</h4>
                  <p style={{ fontSize: "0.85rem", color: "#aaa", margin: "4px 0 0 0" }}>Prevent using/right-clicking or placing items before unlocking the required stage.</p>
                </div>
                <button onClick={() => {
                  setData({
                    ...data,
                    item_restrictions: [...data.item_restrictions, { target: "minecraft:diamond_sword", stage: "age_of_iron", is_block: false }]
                  });
                }} style={{ background: "#4caf50" }}>+ Add Restriction</button>
              </div>

              <div style={{ width: "100%", marginTop: "10px" }}>
                {data.item_restrictions.length === 0 && <p style={{ color: "#666", fontSize: "0.85rem" }}>No item restrictions configured.</p>}
                {data.item_restrictions.map((res, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <select
                      value={res.is_block ? "block" : "item"}
                      onChange={(e) => {
                        const newR = [...data.item_restrictions];
                        newR[idx].is_block = e.target.value === "block";
                        setData({ ...data, item_restrictions: newR });
                      }}
                      style={{ background: "#1a1a1a", color: "white", padding: "6px" }}
                    >
                      <option value="item">Item (Restrict Usage)</option>
                      <option value="block">Block (Restrict Placement)</option>
                    </select>

                    <ItemPicker
                      value={res.target}
                      onChange={(val) => {
                        const newR = [...data.item_restrictions];
                        newR[idx].target = val;
                        setData({ ...data, item_restrictions: newR });
                      }}
                      customItems={data.items}
                      extraItems={syncedItems}
                      exportPath={exportPath}
                      placeholder="Select item/block ID..."
                    />

                    <select
                      value={res.stage}
                      onChange={(e) => {
                        const newR = [...data.item_restrictions];
                        newR[idx].stage = e.target.value;
                        setData({ ...data, item_restrictions: newR });
                      }}
                      style={{ background: "#1a1a1a", color: "white", padding: "6px" }}
                    >
                      <option value="">(Select Stage)</option>
                      {data.stages.map(s => <option key={s} value={s}>Stage: {s}</option>)}
                    </select>

                    <button 
                      onClick={() => {
                        const newR = data.item_restrictions.filter((_, i) => i !== idx);
                        setData({ ...data, item_restrictions: newR });
                      }}
                      style={{ background: "transparent", color: "#f44336", padding: "0 6px", fontSize: "1.2rem", fontWeight: "bold" }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <h4>Game Stages</h4>
              <p style={{ fontSize: "0.85rem", color: "#aaa", marginTop: 0 }}>Define "Ages" or progression milestones (e.g. age_of_copper). Can be used to lock recipes and items.</p>
              <textarea 
                style={{ width: "100%", height: "80px", background: "#1a1a1a", color: "white", padding: "8px", border: "1px solid #444" }}
                value={data.stages.join(", ")}
                onChange={(e) => setData({ ...data, stages: e.target.value.split(",").map(s => s.trim()).filter(s => s) })}
                placeholder="age_of_stone, age_of_copper, age_of_iron"
              />
            </div>

            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <h4>Mod Mechanics (Recipe Types)</h4>
              <p style={{ fontSize: "0.85rem", color: "#aaa", marginTop: 0 }}>Add recipe types supported by your installed mods.</p>
              <textarea 
                style={{ width: "100%", height: "120px", background: "#1a1a1a", color: "white", padding: "8px", border: "1px solid #444" }}
                value={data.custom_mechanics.join(", ")}
                onChange={(e) => setData({ ...data, custom_mechanics: e.target.value.split(",").map(s => s.trim()).filter(s => s) })}
                placeholder="minecraft:crafting_shaped, create:crushing, mekanism:metallurgic_infusing"
              />
            </div>

            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <h4>Ore Generation</h4>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input 
                  type="checkbox" 
                  checked={data.disable_vanilla_ores}
                  onChange={(e) => setData({ ...data, disable_vanilla_ores: e.target.checked })}
                />
                Disable all Vanilla / Mod Ores (WorldEvents.removeOres)
              </label>
            </div>

            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
              <h4>JEI Hider</h4>
              <p style={{ fontSize: "0.85rem", color: "#aaa", marginTop: 0 }}>Comma-separated list of item IDs to hide in JEI/REI.</p>
              <textarea 
                style={{ width: "100%", height: "80px", background: "#1a1a1a", color: "white", padding: "8px", border: "1px solid #444" }}
                value={data.hidden_items.join(", ")}
                onChange={(e) => setData({ ...data, hidden_items: e.target.value.split(",").map(s => s.trim()).filter(s => s) })}
                placeholder="minecraft:wooden_pickaxe, create:hand_crank"
              />
            </div>

            <div className="card" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h4>Tag Manager (Ore Dictionary)</h4>
                <button onClick={() => {
                  setData({ ...data, tags: [...data.tags, { tag: "forge:ingots/custom", items: [] }] });
                }} style={{ background: "#4caf50" }}>+ Add Tag Group</button>
              </div>
              
              {data.tags.length === 0 && <p style={{ color: "#aaa" }}>No tags defined.</p>}
              {data.tags.map((tg, idx) => (
                <div key={idx} style={{ position: "relative", marginTop: "10px", width: "100%", padding: "15px", background: "#1a1a1a", borderRadius: "4px" }}>
                  <button 
                    onClick={() => {
                      const newTags = data.tags.filter((_, i) => i !== idx);
                      setData({ ...data, tags: newTags });
                    }}
                    style={{ position: "absolute", right: "10px", top: "10px", background: "#f44336", padding: "4px 8px", fontSize: "0.8rem" }}
                  >Delete Tag</button>
                  <input 
                    value={tg.tag}
                    onChange={(e) => {
                      const newTags = [...data.tags];
                      newTags[idx].tag = e.target.value;
                      setData({ ...data, tags: newTags });
                    }}
                    placeholder="Tag (e.g., forge:ingots/copper)"
                    style={{ width: "calc(100% - 100px)", marginBottom: "10px" }}
                  />
                  <input 
                    value={tg.items.join(", ")}
                    onChange={(e) => {
                      const newTags = [...data.tags];
                      newTags[idx].items = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                      setData({ ...data, tags: newTags });
                    }}
                    placeholder="Items in Tag (comma-separated)"
                    style={{ width: "100%" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REWARD TABLES TAB */}
        {activeTab === "tables" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0 }}>FTB Quests Reward Tables (Loot Crates & Choice Pools)</h3>
                <p style={{ color: "#aaa", fontSize: "0.85rem", margin: "4px 0 0 0" }}>Create reward tables for choice rewards or weighted random loot crates.</p>
              </div>
              <button onClick={() => {
                const newId = `table_${Date.now()}`;
                setData({
                  ...data,
                  reward_tables: [
                    ...data.reward_tables,
                    {
                      id: newId,
                      title: "New Reward Table",
                      icon: "minecraft:chest",
                      is_loot_crate: false,
                      rewards: [{ item: "minecraft:iron_ingot", count: 4, weight: 10 }]
                    }
                  ]
                });
              }} style={{ background: "#4caf50" }}>+ Add Reward Table</button>
            </div>

            <div className="list">
              {data.reward_tables.length === 0 && <p style={{ color: "#aaa" }}>No reward tables created yet.</p>}
              {data.reward_tables.map((table, tIdx) => (
                <div key={tIdx} className="card" style={{ flexDirection: "column", alignItems: "flex-start", position: "relative", padding: "20px" }}>
                  <button 
                    onClick={() => {
                      const newT = data.reward_tables.filter((_, i) => i !== tIdx);
                      setData({ ...data, reward_tables: newT });
                    }}
                    style={{ position: "absolute", right: "10px", top: "10px", background: "#f44336", padding: "4px 8px", fontSize: "0.8rem" }}
                  >Delete Table</button>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "calc(100% - 90px)", marginBottom: "15px" }}>
                    <input
                      value={table.title}
                      onChange={(e) => {
                        const newT = [...data.reward_tables];
                        newT[tIdx].title = e.target.value;
                        setData({ ...data, reward_tables: newT });
                      }}
                      placeholder="Table Title (e.g. Choice: Starter Minerals)"
                      style={{ flex: 1, padding: "8px", fontWeight: "bold" }}
                    />
                    <input
                      value={table.id}
                      onChange={(e) => {
                        const newT = [...data.reward_tables];
                        newT[tIdx].id = e.target.value;
                        setData({ ...data, reward_tables: newT });
                      }}
                      placeholder="Table ID (e.g. starter_minerals)"
                      style={{ width: "180px", padding: "8px" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", background: "#111", padding: "6px 10px", borderRadius: "4px" }}>
                      <input
                        type="checkbox"
                        checked={table.is_loot_crate}
                        onChange={(e) => {
                          const newT = [...data.reward_tables];
                          newT[tIdx].is_loot_crate = e.target.checked;
                          setData({ ...data, reward_tables: newT });
                        }}
                      />
                      📦 Random Loot Crate
                    </label>
                  </div>

                  {/* Rewards list */}
                  <div style={{ width: "100%", background: "#1a1a1a", padding: "12px", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #333", paddingBottom: "6px" }}>
                      <strong style={{ fontSize: "0.85rem", color: "#aaa" }}>Contained Rewards / Drops</strong>
                      <button style={{ padding: "2px 8px", fontSize: "0.75rem", background: "#3b82f6" }} onClick={() => {
                        const newT = [...data.reward_tables];
                        newT[tIdx].rewards.push({ item: "", count: 1, weight: 1 });
                        setData({ ...data, reward_tables: newT });
                      }}>+ Add Item</button>
                    </div>

                    {table.rewards.map((entry, eIdx) => (
                      <div key={eIdx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                        <ItemPicker
                          value={entry.item}
                          onChange={(val) => {
                            const newT = [...data.reward_tables];
                            newT[tIdx].rewards[eIdx].item = val;
                            setData({ ...data, reward_tables: newT });
                          }}
                          customItems={data.items}
                          extraItems={syncedItems}
                          exportPath={exportPath}
                          placeholder="Select item..."
                        />
                        <input
                          type="number"
                          placeholder="Count"
                          value={entry.count || 1}
                          onChange={(e) => {
                            const newT = [...data.reward_tables];
                            newT[tIdx].rewards[eIdx].count = parseInt(e.target.value) || 1;
                            setData({ ...data, reward_tables: newT });
                          }}
                          style={{ width: "60px", padding: "6px" }}
                          title="Item Count"
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#aaa" }}>Weight:</span>
                          <input
                            type="number"
                            placeholder="Weight"
                            value={entry.weight || 1}
                            onChange={(e) => {
                              const newT = [...data.reward_tables];
                              newT[tIdx].rewards[eIdx].weight = parseInt(e.target.value) || 1;
                              setData({ ...data, reward_tables: newT });
                            }}
                            style={{ width: "60px", padding: "6px" }}
                            title="Drop Weight / Probability"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const newT = [...data.reward_tables];
                            newT[tIdx].rewards.splice(eIdx, 1);
                            setData({ ...data, reward_tables: newT });
                          }}
                          style={{ background: "transparent", color: "#f44336", padding: "0 6px", fontSize: "1.2rem", fontWeight: "bold" }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === "export" && (
          <div>
            <h3>Export & Synchronization</h3>
            <div className="export-form">
              <label>Minecraft Instance Directory</label>
              <div style={{ display: "flex", gap: "10px", margin: "10px 0" }}>
                <input
                  type="text"
                  value={exportPath}
                  onChange={(e) => {
                    setExportPath(e.target.value);
                  }}
                  placeholder="C:/Users/.../Instances/MyModpack"
                  style={{ flex: 1 }}
                />
                <button onClick={selectExportDir}>Select Folder</button>
              </div>

              {/* Detected Instance & Target Version Banner */}
              <div style={{ display: "flex", gap: "15px", alignItems: "center", margin: "15px 0", background: "#111827", padding: "12px 16px", borderRadius: "6px", border: "1px solid #374151", flexWrap: "wrap" }}>
                <div style={{ minWidth: "200px" }}>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Detected Instance</div>
                  <div style={{ fontWeight: "bold", color: "#60a5fa", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span>🎮</span> Minecraft {detectedVersion} ({detectedLoader})
                  </div>
                </div>
                <div style={{ width: "1px", height: "35px", background: "#374151", display: "none" }} />
                <div style={{ flex: 1, minWidth: "280px" }}>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Target Export Syntax & KubeJS Version
                  </div>
                  <select
                    value={data.target_version || "1.21.1"}
                    onChange={(e) => setData({ ...data, target_version: e.target.value })}
                    style={{ background: "#1f2937", color: "#fff", border: "1px solid #4b5563", padding: "6px 10px", borderRadius: "4px", width: "100%", fontSize: "0.85rem" }}
                  >
                    <option value="1.21.1">Minecraft 1.21.1 (KubeJS 21 / NeoForge / Common #c: Tags)</option>
                    <option value="1.26+">Minecraft 1.26+ (KubeJS 26 / Strict Namespaces / Data Components)</option>
                    <option value="1.20.1">Minecraft 1.20.1 (Legacy Forge / KubeJS 6 / #forge: Tags)</option>
                    <option value="1.18.2">Minecraft 1.18.2 (Legacy KubeJS 5 / onEvent)</option>
                  </select>
                </div>
              </div>

              {detectedMods.length > 0 && (
                <div style={{ padding: "12px", background: "#1f2937", borderRadius: "6px", marginBottom: "15px", border: "1px solid #374151" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ color: "#10b981" }}>✓ Detected Mods in Instance ({detectedMods.length}):</strong>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxHeight: "160px", overflowY: "auto", paddingRight: "4px" }}>
                    {detectedMods.map(m => (
                      <span key={m} style={{ background: "#374151", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8rem", color: "#e2e8f0" }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <button onClick={handleImportExistingModpack} style={{ background: "#8b5cf6", fontWeight: "bold" }}>
                  📥 Import Modpack into Editor
                </button>
                <button onClick={handleExport} style={{ background: "#10b981", fontWeight: "bold" }}>
                  🚀 Generate & Export
                </button>
                <button onClick={handleSetupSync} style={{ background: "#3b82f6" }}>
                  🔄 Setup Auto-Sync
                </button>
                <button onClick={() => fetchSyncedData(exportPath)} style={{ background: "#6b7280" }}>
                  🔍 Scan & Sync Items
                </button>
              </div>
              {status && <p className="status-msg">{status}</p>}
            </div>
          </div>
        )}
      </div>

      {/* LINTER MODAL */}
      {isLinterOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "#181b20",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            width: "600px",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2d333f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🧠</span> Modpack Progression Logic Check
              </h3>
              <button onClick={() => setIsLinterOpen(false)} style={{ background: "transparent", color: "#aaa", fontSize: "1.2rem" }}>✕</button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              {lintIssues.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🎉</div>
                  <h4 style={{ color: "#10b981", margin: 0 }}>All Clear! No logic errors detected.</h4>
                  <p style={{ color: "#aaa", fontSize: "0.85rem", marginTop: "6px" }}>All quests, recipes, and stage dependencies are consistent and deadlock-free.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {lintIssues.map((issue, idx) => (
                    <div 
                      key={idx} 
                      style={{
                        padding: "12px 16px",
                        borderRadius: "6px",
                        background: issue.level === "error" ? "#3b1317" : issue.level === "warning" ? "#332200" : "#132338",
                        borderLeft: `4px solid ${issue.level === "error" ? "#ef4444" : issue.level === "warning" ? "#f59e0b" : "#3b82f6"}`,
                        color: "#fff"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span>{issue.level === "error" ? "❌ Error (Deadlock/Cycle)" : issue.level === "warning" ? "⚠️ Warning" : "ℹ️ Info"}</span>
                        {issue.context && <span style={{ background: "#00000044", padding: "1px 6px", borderRadius: "3px", fontSize: "0.75rem" }}>{issue.context}</span>}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#e5e7eb" }}>{issue.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #2d333f", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setIsLinterOpen(false)} style={{ background: "#3b82f6" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM LOGS & DEBUG MODAL */}
      {isLogsOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: "8px",
            width: "800px",
            maxWidth: "92vw",
            height: "600px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#161b22" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.2rem" }}>🐛</span>
                <strong style={{ color: "#58a6ff" }}>SimpleQuestHelper System Logs</strong>
                <span style={{ fontSize: "0.75rem", background: "#21262d", padding: "2px 6px", borderRadius: "10px", color: "#8b949e" }}>
                  {systemLogs.length} events
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={refreshLogs} style={{ background: "#21262d", padding: "4px 8px", fontSize: "0.75rem" }}>
                  🔄 Refresh
                </button>
                <button onClick={() => {
                  navigator.clipboard.writeText(systemLogs.join("\n"));
                  alert("Logs copied to clipboard!");
                }} style={{ background: "#21262d", padding: "4px 8px", fontSize: "0.75rem" }}>
                  📋 Copy
                </button>
                <button onClick={async () => {
                  await clearSystemLogs();
                  setSystemLogs([]);
                }} style={{ background: "#3b1317", color: "#f85149", padding: "4px 8px", fontSize: "0.75rem" }}>
                  🗑 Clear
                </button>
                <button onClick={() => setIsLogsOpen(false)} style={{ background: "transparent", color: "#8b949e", fontSize: "1.2rem", marginLeft: "5px" }}>✕</button>
              </div>
            </div>

            <div style={{
              padding: "15px",
              overflowY: "auto",
              flex: 1,
              fontFamily: "Consolas, 'Courier New', monospace",
              fontSize: "0.8rem",
              background: "#090d13",
              color: "#c9d1d9",
              lineHeight: "1.4"
            }}>
              {systemLogs.length === 0 ? (
                <div style={{ textAlign: "center", color: "#484f58", padding: "40px 0" }}>
                  No logs recorded yet.
                </div>
              ) : (
                systemLogs.map((line, idx) => {
                  const isErr = line.includes("[ERROR]");
                  const isWarn = line.includes("[WARN]");
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        color: isErr ? "#f85149" : isWarn ? "#d29922" : "#8b949e",
                        marginBottom: "3px",
                        wordBreak: "break-all"
                      }}
                    >
                      {line}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: "10px 18px", borderTop: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#161b22", fontSize: "0.75rem", color: "#8b949e" }}>
              <span>Log file saved to: <code>simplequesthelper.log</code></span>
              <button onClick={() => setIsLogsOpen(false)} style={{ background: "#238636", color: "#fff", padding: "4px 12px" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
