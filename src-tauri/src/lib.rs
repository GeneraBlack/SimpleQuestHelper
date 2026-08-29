pub mod models;
pub mod generator;
pub mod sync;
pub mod project;
pub mod linter;
pub mod dialog;
pub mod importer;
pub mod textures;
pub mod logger;

use models::ModpackData;
use std::fs;
use std::path::Path;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn generate_modpack_files(export_path: String, project_data: ModpackData) -> Result<String, String> {
    let path = Path::new(&export_path);
    if !path.exists() {
        return Err(format!("Pfad existiert nicht: {}", export_path));
    }

    // Erstelle Ordnerstruktur
    let kubejs_startup = path.join("kubejs").join("startup_scripts");
    let kubejs_server = path.join("kubejs").join("server_scripts");
    let kubejs_client = path.join("kubejs").join("client_scripts");
    let ftbquests = path.join("config").join("ftbquests").join("quests");

    let item_textures = path.join("kubejs").join("assets").join("kubejs").join("textures").join("item");
    let block_textures = path.join("kubejs").join("assets").join("kubejs").join("textures").join("block");
    let kubejs_lang = path.join("kubejs").join("assets").join("kubejs").join("lang");
    fs::create_dir_all(&kubejs_startup).map_err(|e| e.to_string())?;
    fs::create_dir_all(&kubejs_server).map_err(|e| e.to_string())?;
    fs::create_dir_all(&kubejs_client).map_err(|e| e.to_string())?;
    fs::create_dir_all(&ftbquests).map_err(|e| e.to_string())?;
    fs::create_dir_all(&item_textures).map_err(|e| e.to_string())?;
    fs::create_dir_all(&block_textures).map_err(|e| e.to_string())?;
    fs::create_dir_all(&kubejs_lang).map_err(|e| e.to_string())?;

    for item in &project_data.items {
        if let Some(tex_path) = &item.texture_path {
            if Path::new(tex_path).exists() {
                let dest = item_textures.join(format!("{}.png", item.id));
                fs::copy(tex_path, dest).map_err(|e| format!("Konnte Textur {} nicht kopieren: {}", tex_path, e))?;
            }
        }
    }

    for block in &project_data.blocks {
        if let Some(tex_path) = &block.texture_path {
            if Path::new(tex_path).exists() {
                let dest = block_textures.join(format!("{}.png", block.id));
                fs::copy(tex_path, dest).map_err(|e| format!("Konnte Textur {} nicht kopieren: {}", tex_path, e))?;
            }
        }
    }

    // Generiere KubeJS Startup (Items/Blocks)
    let startup_script = generator::generate_kubejs_startup(&project_data);
    fs::write(kubejs_startup.join("simplequesthelper_startup.js"), startup_script).map_err(|e| e.to_string())?;

    // Generiere KubeJS Lang (en_us.json)
    let lang_json = generator::generate_kubejs_lang(&project_data);
    fs::write(kubejs_lang.join("en_us.json"), lang_json).map_err(|e| e.to_string())?;

    // Generiere KubeJS Server (Recipes)
    let server_script = generator::generate_kubejs_server(&project_data);
    fs::write(kubejs_server.join("simplequesthelper_recipes.js"), server_script).map_err(|e| e.to_string())?;

    // Generiere KubeJS Client (JEI Hiding)
    let client_script = generator::generate_kubejs_client(&project_data);
    fs::write(kubejs_client.join("simplequesthelper_client.js"), client_script).map_err(|e| e.to_string())?;

    // Generiere FTB Quests SNBT Chapters
    let ftb_chapters_dir = ftbquests.join("chapters");
    fs::create_dir_all(&ftb_chapters_dir).map_err(|e| e.to_string())?;

    let chapter_exports = generator::generate_ftbquests_chapters(&project_data);
    for ch in chapter_exports {
        fs::write(ftb_chapters_dir.join(&ch.filename), &ch.content)
            .map_err(|e| format!("Konnte Chapter {} nicht schreiben: {}", ch.filename, e))?;
    }

    // Generiere FTB Quests Reward Tables
    if !project_data.reward_tables.is_empty() {
        let ftb_reward_tables_dir = ftbquests.join("reward_tables");
        fs::create_dir_all(&ftb_reward_tables_dir).map_err(|e| e.to_string())?;

        let table_exports = generator::generate_ftbquests_reward_tables(&project_data);
        for tbl in table_exports {
            fs::write(ftb_reward_tables_dir.join(&tbl.filename), &tbl.content)
                .map_err(|e| format!("Konnte Reward Table {} nicht schreiben: {}", tbl.filename, e))?;
        }
    }

    // Erstelle Standard FTB Quests data.snbt falls noch nicht vorhanden
    let data_snbt_path = ftbquests.join("data.snbt");
    if !data_snbt_path.exists() {
        let default_data_snbt = r#"{
	default_autopin_cache: false
	default_consume_items: false
	default_quest_disable_jei: false
	default_quest_shape: "circle"
	default_reward_team: false
	drop_book_on_death: false
	emergency_items_cooldown: 300
	grid_scale: 0.5d
	lock_message: ""
	max_stage: 8
	pause_game: false
	version: 13
}
"#;
        let _ = fs::write(data_snbt_path, default_data_snbt);
    }

    Ok(format!("Files generated successfully! ({} Custom Items, {} Recipes, {} Quest Chapters)", 
        project_data.items.len(), 
        project_data.recipes.len(), 
        project_data.chapters.len()
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logger::init_logger();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            generate_modpack_files, 
            sync::setup_autosync,
            sync::get_synced_data,
            sync::import_modpack_project,
            project::save_autosave,
            project::load_autosave,
            project::export_project_file,
            project::import_project_file,
            linter::lint_modpack_logic,
            dialog::pick_directory,
            dialog::pick_image_file,
            dialog::pick_json_project_file,
            dialog::save_json_project_file,
            textures::get_item_texture,
            textures::get_bulk_textures,
            logger::get_system_logs,
            logger::clear_system_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
