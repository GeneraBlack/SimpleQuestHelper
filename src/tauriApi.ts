import { invoke } from "@tauri-apps/api/core";
import { ModpackData } from "./types";

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

export async function safeInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isTauriEnvironment()) {
    return await invoke<T>(cmd, args);
  }
  throw new Error("NOT_IN_TAURI");
}

// 1. Directory Picker (Native in Tauri, HTML5 input / prompt fallback in Browser)
export async function pickDirectory(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const res = await invoke<string | null>("pick_directory");
      if (res) return res;
    } catch (e) {
      console.warn("Tauri pick_directory error:", e);
    }
  }

  // Browser Fallback: Use directory picker input or prompt
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "true");
    input.setAttribute("directory", "true");
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = (e: any) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const firstFile = files[0];
        const relativePath = firstFile.webkitRelativePath || "";
        const folderName = relativePath.split("/")[0] || "SelectedFolder";
        document.body.removeChild(input);
        resolve(folderName);
      } else {
        document.body.removeChild(input);
        resolve(null);
      }
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    try {
      input.click();
    } catch {
      const manual = window.prompt("Enter Minecraft Instance Folder Path (e.g. C:/Users/Name/AppData/Roaming/.minecraft):");
      resolve(manual || null);
    }
  });
}

// 2. Image Picker
export async function pickImageFile(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const res = await invoke<string | null>("pick_image_file");
      if (res) return res;
    } catch (e) {
      console.warn("Tauri pick_image_file error:", e);
    }
  }

  // Browser fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      if (file) {
        resolve(file.name);
      } else {
        resolve(null);
      }
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    input.click();
  });
}

// 3. Project File Save (.json)
export async function saveProjectJson(data: ModpackData): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const filePath = await invoke<string | null>("save_json_project_file");
      if (filePath) {
        await invoke("export_project_file", { filePath, data });
        return filePath;
      }
    } catch (e) {
      console.warn("Tauri save_json_project_file error:", e);
    }
  }

  // Browser Fallback: Direct file download
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my_modpack_project.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return "my_modpack_project.json (Downloaded)";
}

// 4. Project File Load (.json)
export async function loadProjectJson(): Promise<ModpackData | null> {
  if (isTauriEnvironment()) {
    try {
      const filePath = await invoke<string | null>("pick_json_project_file");
      if (filePath) {
        return await invoke<ModpackData>("import_project_file", { filePath });
      }
    } catch (e) {
      console.warn("Tauri pick_json_project_file error:", e);
    }
  }

  // Browser Fallback: FileReader
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json, application/json";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result as string);
            document.body.removeChild(input);
            resolve(parsed);
          } catch (err) {
            alert("Invalid JSON project file: " + err);
            document.body.removeChild(input);
            resolve(null);
          }
        };
        reader.readAsText(file);
      } else {
        document.body.removeChild(input);
        resolve(null);
      }
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    input.click();
  });
}

// 5. Autosave handler
export async function saveAutosave(data: ModpackData): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke("save_autosave", { data });
      return;
    } catch (e) {
      console.warn("Tauri save_autosave error:", e);
    }
  }
  localStorage.setItem("sqh_autosave_data", JSON.stringify(data));
}

export async function loadAutosave(): Promise<ModpackData | null> {
  if (isTauriEnvironment()) {
    try {
      const saved = await invoke<ModpackData | null>("load_autosave");
      if (saved) return saved;
    } catch (e) {
      console.warn("Tauri load_autosave error:", e);
    }
  }
  const local = localStorage.getItem("sqh_autosave_data");
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      return null;
    }
  }
  return null;
}

// 6. Logic Linter with JS fallback
export async function runModpackLinter(data: ModpackData): Promise<any[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<any[]>("lint_modpack_logic", { data });
    } catch (e) {
      console.warn("Tauri lint_modpack_logic error:", e);
    }
  }

  // Client-side linter logic fallback
  const issues: any[] = [];

  for (const recipe of data.recipes) {
    if (recipe.inputs.length === 0) {
      issues.push({
        level: "warning",
        message: `Recipe of type '${recipe.recipe_type}' has no inputs (ingredients).`,
        context: recipe.recipe_type,
      });
    }
    if (recipe.outputs.length === 0) {
      issues.push({
        level: "warning",
        message: `Recipe of type '${recipe.recipe_type}' has no outputs (results).`,
        context: recipe.recipe_type,
      });
    }
  }

  for (const item of data.items) {
    if (!item.texture_path) {
      issues.push({
        level: "info",
        message: `Custom Item '${item.name}' (${item.id}) does not have a .png texture assigned yet.`,
        context: item.id,
      });
    }
  }

  for (const chapter of data.chapters) {
    for (const quest of chapter.quests) {
      if (quest.tasks.length === 0) {
        issues.push({
          level: "info",
          message: `Quest '${quest.title}' in chapter '${chapter.title}' has no tasks (conditions).`,
          context: quest.title,
        });
      }
    }
  }

  return issues;
}

export async function getItemTexture(exportPath: string, itemId: string): Promise<string | null> {
  if (isTauriEnvironment() && exportPath && itemId) {
    try {
      const res = await invoke<string | null>("get_item_texture", {
        exportPath,
        itemId,
      });
      return res || null;
    } catch (e) {
      console.warn("Error resolving item texture:", e);
    }
  }
  return null;
}

export async function getSystemLogs(): Promise<string[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<string[]>("get_system_logs");
    } catch (e) {
      console.warn("Error fetching logs:", e);
    }
  }
  return [];
}

export async function clearSystemLogs(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke("clear_system_logs");
    } catch (e) {
      console.warn("Error clearing logs:", e);
    }
  }
}


