use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::Mutex;
use std::io::Read;
use base64::prelude::*;
use zip::ZipArchive;
use crate::logger::{log_info, log_warn, log_error};

// Cache for loaded base64 data URLs: "minecraft:iron_sword" -> "data:image/png;base64,..."
static TEXTURE_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

// Fast Index: "namespace:clean_name" -> (JarPath or FilePath, is_jar, ZipEntryPath)
#[derive(Clone)]
struct TextureLocation {
    path: PathBuf,
    is_jar: bool,
    zip_entry: Option<String>,
}

static TEXTURE_INDEX: Mutex<Option<HashMap<String, TextureLocation>>> = Mutex::new(None);
static LAST_INDEXED_PATH: Mutex<Option<String>> = Mutex::new(None);

pub fn ensure_textures_indexed(export_path: &str) {
    if export_path.is_empty() { return; }

    let mut needs_index = false;
    if let Ok(guard) = LAST_INDEXED_PATH.lock() {
        if guard.as_deref() != Some(export_path) {
            needs_index = true;
        }
    }

    if needs_index {
        build_texture_index(export_path);
    }
}

pub fn build_texture_index(export_path: &str) {
    let start_time = std::time::Instant::now();
    let base = Path::new(export_path);
    if !base.exists() {
        log_warn(&format!("Cannot index textures: directory does not exist: {}", export_path));
        return;
    }

    log_info(&format!("Building fast texture index for: {}", export_path));
    let mut index: HashMap<String, TextureLocation> = HashMap::new();

    // 1. Index KubeJS Assets
    let kubejs_assets = base.join("kubejs").join("assets");
    if kubejs_assets.exists() && kubejs_assets.is_dir() {
        index_directory_pngs(&kubejs_assets, &mut index);
    }

    // 2. Index Resourcepacks
    let rp_dir = base.join("resourcepacks");
    if rp_dir.exists() && rp_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&rp_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let assets = p.join("assets");
                    if assets.exists() {
                        index_directory_pngs(&assets, &mut index);
                    }
                }
            }
        }
    }

    // 3. Index Mod JAR headers
    let mods_dir = base.join("mods");
    let mut jar_count = 0;
    if mods_dir.exists() && mods_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map_or(false, |e| e == "jar") {
                    jar_count += 1;
                    if let Ok(file) = File::open(&p) {
                        if let Ok(mut archive) = ZipArchive::new(file) {
                            for i in 0..archive.len() {
                                if let Ok(entry) = archive.by_index_raw(i) {
                                    let name = entry.name().to_lowercase();
                                    if name.starts_with("assets/") && name.ends_with(".png") {
                                        // Pattern: assets/<namespace>/textures/(item|block)/<filename>.png
                                        let parts: Vec<&str> = name.split('/').collect();
                                        if parts.len() >= 4 && parts[2] == "textures" {
                                            let namespace = parts[1];
                                            let file_part = parts[parts.len() - 1].strip_suffix(".png").unwrap_or("");
                                            if !namespace.is_empty() && !file_part.is_empty() {
                                                let key = format!("{}:{}", namespace, file_part);
                                                index.entry(key).or_insert_with(|| TextureLocation {
                                                    path: p.clone(),
                                                    is_jar: true,
                                                    zip_entry: Some(entry.name().to_string()),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let count = index.len();
    let elapsed = start_time.elapsed().as_millis();

    if let Ok(mut guard) = TEXTURE_INDEX.lock() {
        *guard = Some(index);
    }
    if let Ok(mut guard) = LAST_INDEXED_PATH.lock() {
        *guard = Some(export_path.to_string());
    }

    log_info(&format!("Texture Index complete: {} textures indexed from {} mod JARs in {}ms!", count, jar_count, elapsed));
}

fn index_directory_pngs(dir: &Path, index: &mut HashMap<String, TextureLocation>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                index_directory_pngs(&p, index);
            } else if p.is_file() && p.extension().map_or(false, |e| e == "png") {
                let path_str = p.to_string_lossy().replace('\\', "/").to_lowercase();
                if let Some(assets_idx) = path_str.find("/assets/") {
                    let sub = &path_str[assets_idx + 8..];
                    let parts: Vec<&str> = sub.split('/').collect();
                    if parts.len() >= 3 {
                        let namespace = parts[0];
                        let file_part = parts[parts.len() - 1].strip_suffix(".png").unwrap_or("");
                        if !namespace.is_empty() && !file_part.is_empty() {
                            let key = format!("{}:{}", namespace, file_part);
                            index.insert(key, TextureLocation {
                                path: p.clone(),
                                is_jar: false,
                                zip_entry: None,
                            });
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn get_item_texture(export_path: String, item_id: String) -> Result<Option<String>, String> {
    if item_id.is_empty() {
        return Ok(None);
    }

    // 1. Check Memory Base64 Cache
    if let Ok(guard) = TEXTURE_CACHE.lock() {
        if let Some(ref map) = *guard {
            if let Some(data_url) = map.get(&item_id) {
                return Ok(Some(data_url.clone()));
            }
        }
    }

    // 2. Ensure index exists
    ensure_textures_indexed(&export_path);

    // 3. Resolve
    let result = resolve_from_index(&item_id);

    // 4. Save to Cache
    if let Some(ref data_url) = result {
        if let Ok(mut guard) = TEXTURE_CACHE.lock() {
            if guard.is_none() {
                *guard = Some(HashMap::new());
            }
            if let Some(ref mut map) = *guard {
                map.insert(item_id, data_url.clone());
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn get_bulk_textures(export_path: String, item_ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    ensure_textures_indexed(&export_path);
    let mut results = HashMap::new();

    for item_id in item_ids {
        if item_id.is_empty() { continue; }

        if let Ok(guard) = TEXTURE_CACHE.lock() {
            if let Some(ref map) = *guard {
                if let Some(data_url) = map.get(&item_id) {
                    results.insert(item_id.clone(), data_url.clone());
                    continue;
                }
            }
        }

        if let Some(texture_url) = resolve_from_index(&item_id) {
            if let Ok(mut guard) = TEXTURE_CACHE.lock() {
                if guard.is_none() {
                    *guard = Some(HashMap::new());
                }
                if let Some(ref mut map) = *guard {
                    map.insert(item_id.clone(), texture_url.clone());
                }
            }
            results.insert(item_id, texture_url);
        }
    }

    Ok(results)
}

fn resolve_from_index(item_id: &str) -> Option<String> {
    let (raw_namespace, raw_name) = if item_id.contains(':') {
        let mut parts = item_id.split(':');
        (parts.next().unwrap_or("minecraft"), parts.next().unwrap_or(item_id))
    } else {
        ("minecraft", item_id)
    };

    let namespace = raw_namespace.trim().to_lowercase();
    let name = raw_name.trim().to_lowercase();

    let clean_name = if name.contains('x') && name.split('x').next().map_or(false, |p| p.trim().chars().all(|c| c.is_ascii_digit())) {
        name.split('x').nth(1).unwrap_or(&name).trim().to_string()
    } else {
        name.clone()
    };

    let query_key = format!("{}:{}", namespace, clean_name);

    let location = {
        if let Ok(guard) = TEXTURE_INDEX.lock() {
            if let Some(ref index) = *guard {
                index.get(&query_key).cloned()
            } else {
                None
            }
        } else {
            None
        }
    }?;

    if !location.is_jar {
        if let Ok(bytes) = fs::read(&location.path) {
            return Some(format!("data:image/png;base64,{}", BASE64_STANDARD.encode(&bytes)));
        }
    } else if let Some(ref entry_name) = location.zip_entry {
        if let Ok(file) = File::open(&location.path) {
            if let Ok(mut archive) = ZipArchive::new(file) {
                if let Ok(mut zip_file) = archive.by_name(entry_name) {
                    let mut bytes = Vec::new();
                    if zip_file.read_to_end(&mut bytes).is_ok() && !bytes.is_empty() {
                        return Some(format!("data:image/png;base64,{}", BASE64_STANDARD.encode(&bytes)));
                    }
                }
            }
        }
    }

    None
}
