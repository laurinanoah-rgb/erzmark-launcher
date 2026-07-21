//! Tauri-Command: Brücke zwischen React-Frontend und `bugreport.rs`.

#[tauri::command]
pub fn get_bug_report_context() -> crate::bugreport::BugReportContext {
    crate::bugreport::collect()
}
