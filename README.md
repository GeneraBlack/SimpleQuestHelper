# 🗺️ SimpleQuestHelper

<div align="center">

![SimpleQuestHelper Banner](public/tauri.svg)

### The Modern Visual All-in-One Editor for Minecraft Modpacks, FTB Quests & KubeJS

[![Build Status](https://github.com/GeneraBlack/SimpleQuestHelper/actions/workflows/build.yml/badge.svg)](https://github.com/GeneraBlack/SimpleQuestHelper/actions)
[![Minecraft Versions](https://img.shields.io/badge/Minecraft-1.21.1%20%7C%201.26%2B%20%7C%201.20.1-brightgreen.svg)](https://github.com/GeneraBlack/SimpleQuestHelper)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-blue.svg)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[**Download Executable (.exe)**](https://github.com/GeneraBlack/SimpleQuestHelper/releases) • [**User Manual**](#-user-manual--guide) • [**Features**](#-features) • [**Developer Guide**](#-developer-guide)

</div>

---

## 📖 Overview

**SimpleQuestHelper** is a blazing-fast desktop application (built with **Rust & React/Tauri**) designed to streamline creating, editing, visualizing, and balancing Minecraft modpacks.

Forget manually writing error-prone `.snbt` quest files or hundreds of lines of KubeJS JavaScript: SimpleQuestHelper directly hooks into your Minecraft instance, indexes textures and custom recipes across 200+ mod JARs in milliseconds, and outputs clean, standards-compliant code.

---

## ✨ Features

* **🎨 Visual Quest Tree Builder:** Interactive node graph (featuring zoom, pan, drag & drop, dependency curves) for FTB Quests.
* **📥 1-Click Modpack Reverse-Importer:** Parses existing modpacks completely (chapters, task conditions, rich descriptions from `lang/en_us.snbt`, reward tables, custom KubeJS items, and recipes).
* **🖼️ Blazing Fast Live Texture Indexer ($O(1)$):** Extracts item and block textures directly from installed mod JARs (`mods/*.jar`), KubeJS assets, and resource packs with zero UI latency.
* **⚙️ Built-in Mod Crafting Mechanics:**
  * **Oritech:** `oritech:pulverizer`, `oritech:foundry`, `oritech:assembler`, `oritech:atomic_forge`, `oritech:laser`, `oritech:centrifuge`, etc.
  * **Applied Energistics 2 (AE2):** `ae2:inscriber`, `replaceInput`
  * **Draconic Evolution:** `draconicevolution:fusion_crafting`
  * **Powah:** `powah:energizing`
  * **Mystical Agriculture:** `mysticalagriculture:infusion`, `awakening`
  * **Standard Crafting:** 3x3 Shaped Crafting, Shapeless, Smelting, Blasting, Smoking, Stonecutting.
* **🛡️ Game Stages & Progression Locks:** Gate recipes, items, and blocks behind progression stages (e.g., `age_of_copper`, `age_of_space`).
* **🧠 Deadlock & Logic Linter:** Automatically scans your modpack for unreachable quests, circular dependencies (deadlocks/cycles), and missing recipe ingredients.
* **🎮 Multi-Version Syntax Generator:** Generates code tailored specifically for your target Minecraft version:
  * `Minecraft 1.21.1` *(KubeJS 21 / NeoForge / `#c:` Common Tags)*
  * `Minecraft 1.26+` *(KubeJS 26 / Strict Namespaces / Data Components)*
  * `Minecraft 1.20.1` *(Legacy Forge / KubeJS 6 / `#forge:` Tags)*
* **🔄 Live Auto-Sync & Ingame Reload:** Syncs changes in real-time to your Minecraft instance—a simple `/reload` ingame applies all changes immediately!
* **🪵 System Logging & Debug Console:** Persistent logging (`simplequesthelper.log`) with an in-app viewer (`🐛 System Logs`) and a live terminal console.

---

## 🚀 Quick Start

### For End Users (Windows)

1. Download the latest `SimpleQuestHelper.exe` from the [GitHub Releases](https://github.com/GeneraBlack/SimpleQuestHelper/releases) or the [Actions Artifacts](https://github.com/GeneraBlack/SimpleQuestHelper/actions).
2. Launch the application.
3. In the **Export & Sync** tab, select your Minecraft instance directory (e.g., CurseForge / Prism Launcher / Modrinth).
4. Click **"📥 Import Modpack into Editor"** or start creating new quests and recipes from scratch!

---

## 📚 User Manual & Guide

### 1. Linking your Minecraft Modpack Instance
1. Switch to the **Export** tab.
2. Click **"Select Folder"** and choose your Minecraft instance root directory (e.g., `.../Instances/MyModpack/`).
3. SimpleQuestHelper automatically identifies your **Minecraft Version (e.g., 1.21.1)**, **Modloader (NeoForge/Forge)**, and all **installed mods**.

---

### 2. Reverse-Importing an Existing Modpack
To edit an existing modpack:
1. Click **"📥 Import Modpack into Editor"** in the **Export** tab.
2. SimpleQuestHelper automatically parses:
   * All quest chapters and tasks from `config/ftbquests/quests/chapters/`
   * Titles and formatted descriptions from `config/ftbquests/quests/lang/en_us.snbt`
   * Reward tables and loot crates from `config/ftbquests/quests/reward_tables/`
   * Custom KubeJS items and blocks from `kubejs/startup_scripts/`
   * All custom recipes from `kubejs/server_scripts/`

---

### 3. Visual Quest Tree Editor (`Quest Tree`)
* **Chapter Navigation:** Switch between chapters via the dropdown or create new chapters.
* **Add Quest:** Click **"+ Add Quest"** to place a new node on the canvas.
* **Connect Dependencies:** Drag a connection line from a green source handle to a target quest node. SimpleQuestHelper automatically computes clean dependency arrows.
* **Edit Quest Properties:** Select any node to customize:
  * Title, subtitle, and multi-line formatted description.
  * **Tasks (Conditions):** Item detection or checkmarks.
  * **Rewards:** Items, Game Stage unlocks, or Reward Table crates.

---

### 4. Recipes & Custom Machine Mechanics (`Recipes`)
* **3x3 Shaped Crafting Grid:** Click slots to assign ingredients visually.
* **Mod Machine Crafting:** Select from 20+ specialized mechanics (e.g., `oritech:pulverizer`, `draconicevolution:fusion_crafting`, `powah:energizing`).
* **Recipe Blacklist (Removals):** Remove unwanted vanilla or mod recipes by output item, mod ID, or recipe type.

---

### 5. Custom Items & Blocks (`Items & Blocks`)
* Create new custom items and blocks for KubeJS.
* Assign textures and custom tooltips.
* SimpleQuestHelper generates:
  * `kubejs/startup_scripts/sqh_items.js`
  * `kubejs/assets/kubejs/lang/en_us.json` (auto-localization)
  * `kubejs/client_scripts/sqh_tooltips.js`

---

### 6. Progression Logic Linter
* Click **"🧠 Check Logic"** in the sidebar.
* The Linter checks your entire modpack for:
  * ❌ Circular dependencies (Quest A requires Quest B, which requires Quest A $\rightarrow$ Deadlock)
  * ⚠️ Quests without tasks or rewards
  * ⚠️ Recipes missing inputs or outputs

---

### 7. Export & Real-Time Auto-Sync
* **Generate & Export:** Writes formatted files directly into your Minecraft instance.
* **Setup Auto-Sync:** Starts a background folder watcher. When you make changes in SimpleQuestHelper, running `/reload` ingame updates your quests and recipes without restarting Minecraft.

---

### 8. Logging & Debugging (`🐛 System Logs`)
* Click **`🐛 System Logs`** in the sidebar to open the live log inspector.
* All events are recorded in **`simplequesthelper.log`**.
* Run **`start_debug.bat`** to start the app with a visible terminal console for development.

---

## 🕹️ Minecraft Version Compatibility

| Feature | Minecraft 1.21.1 (NeoForge) | Minecraft 1.26+ (Modern) | Minecraft 1.20.1 (Forge) |
| :--- | :---: | :---: | :---: |
| **KubeJS Version** | KubeJS 21 | KubeJS 26 | KubeJS 6 |
| **Tag Standard** | `#c:ingots/...` | `#c:ingots/...` | `#forge:ingots/...` |
| **Data Structure** | Data Components | Strict Data Components | Classic NBT |
| **FTB Quests Filter** | `ftbfiltersystem:smart_filter` | `ftbfiltersystem:smart_filter` | Item Tags |
| **Registry Syntax** | `StartupEvents.registry('item')` | `StartupEvents.registry('minecraft:item')` | `StartupEvents.registry('item')` |

---

## 💻 Developer Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Rust & Cargo](https://rustup.rs/) (Stable toolchain)
* C++ Build Tools (e.g. Visual Studio Build Tools on Windows)

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/GeneraBlack/SimpleQuestHelper.git
cd SimpleQuestHelper

# 2. Install frontend dependencies
npm install

# 3. Start Tauri Desktop in dev mode
npm run tauri dev
```

### Production Build (.exe)

```bash
# Build production bundle
npm run build
npx tauri build --no-bundle
```
The compiled `.exe` binary will be located at:
`src-tauri/target/release/tauri-app.exe`

---

## 📄 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
