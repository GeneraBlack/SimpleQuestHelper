# 🗺️ SimpleQuestHelper

<div align="center">

![SimpleQuestHelper Banner](public/tauri.svg)

### Der moderne visuelle All-in-One Editor für Minecraft Modpacks, FTB Quests & KubeJS

[![Build Status](https://github.com/GeneraBlack/SimpleQuestHelper/actions/workflows/build.yml/badge.svg)](https://github.com/GeneraBlack/SimpleQuestHelper/actions)
[![Minecraft Versions](https://img.shields.io/badge/Minecraft-1.21.1%20%7C%201.26%2B%20%7C%201.20.1-brightgreen.svg)](https://github.com/GeneraBlack/SimpleQuestHelper)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-blue.svg)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[**Download Release (.exe)**](https://github.com/GeneraBlack/SimpleQuestHelper/releases) • [**Dokumentation**](#-benutzerhandbuch--anleitung) • [**Features**](#-features) • [**Entwickler-Guide**](#-entwickler-anleitung)

</div>

---

## 📖 Über SimpleQuestHelper

**SimpleQuestHelper** ist eine hochperformante Desktop-Anwendung (entwickelt mit **Rust & React/Tauri**), die Modpack-Entwicklern das Erstellen, Bearbeiten, Visualisieren und Ausbalancieren von Minecraft-Modpacks revolutionär vereinfacht.

Nie wieder manuell fehleranfällige `.snbt`-Dateien oder Hunderte Zeilen KubeJS-JavaScript schreiben: SimpleQuestHelper synchronisiert sich direkt mit deiner Minecraft-Instanz, extrahiert Texturen und Rezepte aus über 200+ Mod-JARs und generiert sauberen, standardkonformen Code.

---

## ✨ Features

* **🎨 Visueller Quest-Tree Editor:** Interaktiver Knoten-Graph (mit Zoom, Drag & Drop, Pfeilverbindungen) für FTB Quests.
* **📥 1-Klick Modpack Reverse-Import:** Liest bestehende Modpacks komplett ein (Quests, Lokalisierung aus `lang/en_us.snbt`, Reward-Tables, KubeJS-Items und Rezepte).
* **🖼️ Blitzschneller Live-Textur-Indexer ($O(1)$):** Extrahiert Item- und Block-Texturen direkt aus installierten Mod-JARs (`mods/*.jar`), KubeJS-Assets und Resourcepacks ohne UI-Lags.
* **⚙️ Unterstützung für Mod-Crafting-Mechaniken:**
  * **Oritech:** `oritech:pulverizer`, `oritech:foundry`, `oritech:assembler`, `oritech:atomic_forge`, `oritech:laser`, `oritech:centrifuge` etc.
  * **AE2:** `ae2:inscriber`, `replaceInput`
  * **Draconic Evolution:** `draconicevolution:fusion_crafting`
  * **Powah:** `powah:energizing`
  * **Mystical Agriculture:** `mysticalagriculture:infusion`, `awakening`
  * **Vanilla & Standard:** 3x3 Shaped Crafting, Shapeless, Smelting, Blasting, Smoking, Stonecutting.
* **🛡️ Game Stages & Progression-Sperren:** Rezepte, Items und Blöcke an Fortschrittsstufen (z. B. `age_of_copper`, `age_of_space`) koppeln.
* **🧠 Deadlock & Logic Linter:** Erkennt automatisch unerreichbare Quests, zirkuläre Abhängigkeiten (Zyklen/Deadlocks) und fehlende Rezepte.
* **🎮 Multi-Version Syntax Generator:** Schreibt wahlweise optimierten Code für:
  * `Minecraft 1.21.1` *(KubeJS 21 / NeoForge / `#c:` Common Tags)*
  * `Minecraft 1.26+` *(KubeJS 26 / Strikte Namespaces / Data Components)*
  * `Minecraft 1.20.1` *(Legacy Forge / KubeJS 6 / `#forge:` Tags)*
* **🔄 Live Auto-Sync & Ingame-Reload:** Änderungen werden in Echtzeit in deine Minecraft-Instanz übertragen – ein `/reload` im Spiel genügt!
* **🪵 System-Logging & Debug-Konsole:** Echtzeit-Log-Stream (`simplequesthelper.log`) mit In-App Viewer (`🐛 System Logs`) und separater Terminal-Konsole.

---

## 🚀 Schnelleinstieg

### Für Endnutzer (Windows)

1. Lade die neueste `SimpleQuestHelper.exe` von den [GitHub Releases](https://github.com/GeneraBlack/SimpleQuestHelper/releases) herunter.
2. Starte die Anwendung.
3. Wähle im Tab **Export & Sync** den Ordner deiner Minecraft-Instanz (z. B. CurseForge / Prism Launcher / Modrinth).
4. Klicke auf **"📥 Import Modpack into Editor"** oder beginne direkt mit dem Erstellen eigener Quests und Rezepte!

---

## 📚 Benutzerhandbuch & Anleitung

### 1. Modpack-Instanz verknüpfen
1. Wechsle in den Tab **Export**.
2. Klicke auf **"Select Folder"** und wähle das Hauptverzeichnis deiner Minecraft-Instanz (z. B. `.../Instances/MyModpack/`).
3. Die App erkennt automatisch die **Minecraft-Version (z. B. 1.21.1)**, den **Modloader (NeoForge/Forge)** und alle **installierten Mods**.

---

### 2. Bestehendes Modpack importieren
Wenn du ein bestehendes Modpack bearbeiten möchtest:
1. Klicke im Tab **Export** auf **"📥 Import Modpack into Editor"**.
2. SimpleQuestHelper liest automatisch ein:
   * Alle Quest-Kapitel & Aufgaben aus `config/ftbquests/quests/chapters/`
   * Titel & formatierte Beschreibungen aus `config/ftbquests/quests/lang/en_us.snbt`
   * Belohnungstabellen & Loot-Crates aus `config/ftbquests/quests/reward_tables/`
   * Eigene KubeJS Items & Blöcke aus `kubejs/startup_scripts/`
   * Alle Handwerks- und Mod-Rezepte aus `kubejs/server_scripts/`

---

### 3. Visueller Quest-Tree Editor (`Quest Tree`)
* **Kapitel-Auswahl:** Wechsle zwischen Kapiteln über das Dropdown oben links oder erstelle neue Kapitel.
* **Quest hinzufügen:** Klicke auf **"+ Add Quest"** – es wird ein neuer Knoten im Graph platziert.
* **Abhängigkeiten verbinden:** Ziehe mit der Maus eine Verbindung von einem grünen Punkt (Source) zum Ziel-Knoten (Target). SimpleQuestHelper zeichnet saubere Verbindungspfeile.
* **Quest bearbeiten:** Klicke auf einen Quest-Knoten, um in der rechten Seitenleiste:
  * Titel, Untertitel und mehrzeilige Beschreibung anzupassen.
  * **Tasks (Bedingungen):** Items oder Checkmarks hinzufügen.
  * **Rewards (Belohnungen):** Items, Game-Stage-Freischaltungen oder Reward-Table-Zuweisungen zu vergeben.

---

### 4. Rezepte & Handwerksmechaniken (`Recipes`)
* **3x3 Shaped Crafting:** Klicke auf die 9 Slots des interaktiven Handwerksgitters, um Gegenstände grafisch zu platzieren.
* **Mod-Maschinen:** Wähle aus über 20+ Mechaniken (z. B. `oritech:pulverizer`, `draconicevolution:fusion_crafting`, `powah:energizing`).
* **Recipe Blacklist (Entfernungen):** Deaktiviere unerwünschte Vanilla- oder Mod-Rezepte nach Item-Output, Mod-ID oder Rezept-Typ.

---

### 5. Custom Items & Blöcke (`Items & Blocks`)
* Erstelle eigene Items und Blöcke für KubeJS.
* Weise Texturen zu und hinterlege Tooltips.
* SimpleQuestHelper generiert automatisch:
  * `kubejs/startup_scripts/sqh_items.js`
  * `kubejs/assets/kubejs/lang/en_us.json` (automatische Lokalisierung)
  * `kubejs/client_scripts/sqh_tooltips.js`

---

### 6. Logic Linter (Logik-Prüfung)
* Klicke in der Seitenleiste auf **"🧠 Check Logic"**.
* Der Linter analysiert dein gesamtes Modpack auf:
  * ❌ Zirkuläre Abhängigkeiten (Quest A verlangt Quest B, welche Quest A verlangt $\rightarrow$ Deadlock)
  * ⚠️ Quests ohne Aufgaben oder Belohnungen
  * ⚠️ Rezepte ohne Eingabe- oder Ausgabestücke

---

### 7. Export & Live Auto-Sync
* **Generate & Export:** Schreibt alle Dateien sauber formatiert in deine Minecraft-Instanz.
* **Setup Auto-Sync:** Richtet einen automatischen Datei-Watcher ein. Bei Änderungen in SimpleQuestHelper reicht ein einfaches `/reload` im Minecraft-Chat, um alle Quests und Rezepte ohne Neustart des Spiels zu aktualisieren.

---

### 8. Logging & Debugging (`🐛 System Logs`)
* Klicke auf **`🐛 System Logs`** in der Seitenleiste, um den Live-Logstream einzusehen.
* Alle Logs werden persistent in **`simplequesthelper.log`** gespeichert.
* Zum Debuggen während der Entwicklung kann die App mit **`start_debug.bat`** in einer sichtbaren Konsole ausgeführt werden.

---

## 🕹️ Minecraft Versions-Kompatibilität

| Feature | Minecraft 1.21.1 (NeoForge) | Minecraft 1.26+ (Modern) | Minecraft 1.20.1 (Forge) |
| :--- | :---: | :---: | :---: |
| **KubeJS Version** | KubeJS 21 | KubeJS 26 | KubeJS 6 |
| **Tag-Standard** | `#c:ingots/...` | `#c:ingots/...` | `#forge:ingots/...` |
| **Data Structure** | Data Components | Strict Data Components | Classic NBT |
| **FTB Quests Filter** | `ftbfiltersystem:smart_filter` | `ftbfiltersystem:smart_filter` | Item Tags |
| **Registry Syntax** | `StartupEvents.registry('item')` | `StartupEvents.registry('minecraft:item')` | `StartupEvents.registry('item')` |

---

## 💻 Entwickler-Anleitung

### Voraussetzungen
* [Node.js](https://nodejs.org/) (Version 18 oder neuer)
* [Rust & Cargo](https://rustup.rs/) (Stable Toolchain)
* C++ Build Tools (z. B. Visual Studio Build Tools auf Windows)

### Installation & Lokale Ausführung

```bash
# 1. Repository klonen
git clone https://github.com/GeneraBlack/SimpleQuestHelper.git
cd SimpleQuestHelper

# 2. Frontend-Abhängigkeiten installieren
npm install

# 3. Desktop-App im Entwicklungsmodus starten
npm run tauri dev
```

### Produktions-Build erstellen (.exe)

```bash
# Baut die optimierte Standalone-Anwendung
npm run build
npx tauri build --no-bundle
```
Die erzeugte `.exe` liegt anschließend unter:
`src-tauri/target/release/tauri-app.exe`

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert – siehe die [LICENSE](LICENSE)-Datei für Details.
