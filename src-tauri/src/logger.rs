use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Local;

static LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());
static LOG_FILE_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn init_logger() {
    let log_path = PathBuf::from("simplequesthelper.log");
    if let Ok(mut guard) = LOG_FILE_PATH.lock() {
        *guard = Some(log_path.clone());
    }

    // Write initial startup marker
    log_info("=== SimpleQuestHelper Started ===");
}

pub fn log_info(msg: &str) {
    append_log("INFO", msg);
}

pub fn log_warn(msg: &str) {
    append_log("WARN", msg);
}

pub fn log_error(msg: &str) {
    append_log("ERROR", msg);
}

fn append_log(level: &str, msg: &str) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let formatted = format!("[{}] [{}] {}", timestamp, level, msg);

    println!("{}", formatted);

    // Append to memory buffer
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        if buffer.len() > 500 {
            buffer.remove(0);
        }
        buffer.push(formatted.clone());
    }

    // Append to file
    if let Ok(guard) = LOG_FILE_PATH.lock() {
        if let Some(ref path) = *guard {
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                let _ = writeln!(file, "{}", formatted);
            }
        }
    }
}

#[tauri::command]
pub fn get_system_logs() -> Result<Vec<String>, String> {
    if let Ok(buffer) = LOG_BUFFER.lock() {
        Ok(buffer.clone())
    } else {
        Ok(vec!["Error reading log buffer".to_string()])
    }
}

#[tauri::command]
pub fn clear_system_logs() -> Result<(), String> {
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.clear();
    }
    if let Ok(guard) = LOG_FILE_PATH.lock() {
        if let Some(ref path) = *guard {
            let _ = fs::write(path, "");
        }
    }
    log_info("Logs cleared by user.");
    Ok(())
}
