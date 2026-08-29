use std::fs;
use std::path::PathBuf;
use crate::models::ModpackData;

fn get_autosave_path() -> PathBuf {
    std::env::temp_dir().join("simplequesthelper_autosave.json")
}

#[tauri::command]
pub fn save_autosave(data: ModpackData) -> Result<String, String> {
    let path = get_autosave_path();
    let json_str = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json_str).map_err(|e| format!("Failed to write autosave file: {}", e))?;
    Ok("Autosave successful".to_string())
}

#[tauri::command]
pub fn load_autosave() -> Result<Option<ModpackData>, String> {
    let path = get_autosave_path();
    if !path.exists() {
        return Ok(None);
    }

    let json_str = fs::read_to_string(&path).map_err(|e| format!("Failed to read autosave file: {}", e))?;
    let data: ModpackData = serde_json::from_str(&json_str).map_err(|e| format!("Error parsing autosave JSON: {}", e))?;
    Ok(Some(data))
}

#[tauri::command]
pub fn export_project_file(file_path: String, data: ModpackData) -> Result<String, String> {
    let json_str = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&file_path, json_str).map_err(|e| format!("Failed to save project file: {}", e))?;
    Ok("Project file saved successfully".to_string())
}

#[tauri::command]
pub fn import_project_file(file_path: String) -> Result<ModpackData, String> {
    let json_str = fs::read_to_string(&file_path).map_err(|e| format!("Failed to open project file: {}", e))?;
    let data: ModpackData = serde_json::from_str(&json_str).map_err(|e| format!("Invalid project file format: {}", e))?;
    Ok(data)
}
