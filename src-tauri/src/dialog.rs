#[tauri::command]
pub fn pick_directory() -> Option<String> {
    let folder = rfd::FileDialog::new().pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_image_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("PNG Images", &["png"])
        .pick_file();
    file.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_json_project_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("JSON Project", &["json"])
        .pick_file();
    file.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_json_project_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("JSON Project", &["json"])
        .set_file_name("my_modpack_project.json")
        .save_file();
    file.map(|p| p.to_string_lossy().to_string())
}
