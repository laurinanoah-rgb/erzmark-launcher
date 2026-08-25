//! Tauri-Commands für den Skin-Wechsler (nutzt Mojangs Skin-API direkt).

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

use crate::auth::skin;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SkinError {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinVaultEntry {
    pub id: String,
    pub name: String,
    pub variant: String,
    pub file_name: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_data_url: Option<String>,
}

fn vault_dir() -> Result<PathBuf, SkinError> {
    Ok(crate::game::paths::launcher_root()
        .map_err(SkinError::from)?
        .join("skins"))
}

fn vault_metadata_path() -> Result<PathBuf, SkinError> { Ok(vault_dir()?.join("vault.json")) }

fn read_vault() -> Result<Vec<SkinVaultEntry>, SkinError> {
    let path = vault_metadata_path()?;
    if !path.exists() { return Ok(Vec::new()); }
    let data = std::fs::read_to_string(path).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    serde_json::from_str(&data).map_err(anyhow::Error::from).map_err(SkinError::from)
}

fn write_vault(entries: &[SkinVaultEntry]) -> Result<(), SkinError> {
    let dir = vault_dir()?;
    std::fs::create_dir_all(&dir).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    let path = dir.join("vault.json");
    let temporary = dir.join("vault.json.tmp");
    std::fs::write(&temporary, serde_json::to_vec_pretty(entries).map_err(anyhow::Error::from).map_err(SkinError::from)?)
        .map_err(anyhow::Error::from).map_err(SkinError::from)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    }
    std::fs::rename(temporary, path).map_err(anyhow::Error::from).map_err(SkinError::from)
}

fn validate_skin(file_bytes: &[u8], variant: &str) -> Result<(), SkinError> {
    if !matches!(variant, "classic" | "slim") { return Err(SkinError { message: "Unbekanntes Skin-Modell".into() }); }
    if file_bytes.is_empty() || file_bytes.len() > 2 * 1024 * 1024 { return Err(SkinError { message: "Die Skin-Datei ist leer oder größer als 2 MB".into() }); }
    let image = image::load_from_memory_with_format(file_bytes, image::ImageFormat::Png)
        .map_err(|_| SkinError { message: "Die Datei ist kein gültiger PNG-Skin".into() })?;
    let dimensions = image.dimensions();
    if !matches!(dimensions, (64, 64) | (64, 32)) {
        return Err(SkinError { message: format!("Minecraft-Skins müssen 64×64 oder 64×32 Pixel groß sein (gefunden: {}×{})", dimensions.0, dimensions.1) });
    }
    Ok(())
}

impl From<anyhow::Error> for SkinError {
    fn from(e: anyhow::Error) -> Self {
        SkinError {
            message: e.to_string(),
        }
    }
}

fn read_access_token(state: &AppState) -> Result<String, SkinError> {
    let guard = state.session.lock().unwrap();
    guard
        .as_ref()
        .map(|s| s.mc_access_token.clone())
        .ok_or_else(|| SkinError {
            message: "Keine aktive Session – bitte zuerst einloggen".to_string(),
        })
}

/// Erneuert die Session bei Bedarf und liefert einen frischen Access-Token.
async fn fresh_access_token(state: &AppState) -> Result<String, SkinError> {
    crate::commands::ensure_fresh_session_internal(state)
        .await
        .map_err(|e| SkinError {
            message: e.to_string(),
        })?;
    read_access_token(state)
}

#[tauri::command]
pub async fn get_current_skin_url(state: State<'_, AppState>) -> Result<Option<String>, SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    let profile = crate::auth::minecraft::fetch_profile(&access_token)
        .await
        .map_err(SkinError::from)?;
    Ok(skin::active_skin_url(&profile.skins))
}

#[tauri::command]
pub async fn set_skin_url(
    state: State<'_, AppState>,
    variant: String,
    url: String,
) -> Result<(), SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    skin::set_skin_from_url(&access_token, &variant, &url)
        .await
        .map_err(SkinError::from)
}

#[tauri::command]
pub async fn upload_skin_file(
    state: State<'_, AppState>,
    variant: String,
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<(), SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    skin::upload_skin(&access_token, &variant, file_bytes, &file_name)
        .await
        .map_err(SkinError::from)
}

#[tauri::command]
pub async fn reset_skin(state: State<'_, AppState>) -> Result<(), SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    skin::reset_skin(&access_token).await.map_err(SkinError::from)
}

#[tauri::command]
pub fn list_skin_vault() -> Result<Vec<SkinVaultEntry>, SkinError> {
    let dir = vault_dir()?;
    let mut entries = read_vault()?;
    for entry in &mut entries {
        let path = dir.join(&entry.file_name);
        entry.preview_data_url = std::fs::read(path).ok().map(|bytes| format!("data:image/png;base64,{}", STANDARD.encode(bytes)));
    }
    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(entries)
}

#[tauri::command]
pub fn save_skin_to_vault(file_bytes: Vec<u8>, display_name: String, variant: String) -> Result<SkinVaultEntry, SkinError> {
    validate_skin(&file_bytes, &variant)?;
    let clean_name: String = display_name.trim().chars().filter(|c| !c.is_control()).take(40).collect();
    let id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{id}.png");
    let dir = vault_dir()?;
    std::fs::create_dir_all(&dir).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    std::fs::write(dir.join(&file_name), &file_bytes).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    let mut entries = read_vault()?;
    let entry = SkinVaultEntry { id, name: if clean_name.is_empty() { "Unbenannter Skin".into() } else { clean_name }, variant, file_name, created_at: chrono::Utc::now().to_rfc3339(), preview_data_url: Some(format!("data:image/png;base64,{}", STANDARD.encode(&file_bytes))) };
    entries.push(SkinVaultEntry { preview_data_url: None, ..entry.clone() });
    if let Err(error) = write_vault(&entries) { let _ = std::fs::remove_file(dir.join(&entry.file_name)); return Err(error); }
    Ok(entry)
}

#[tauri::command]
pub async fn apply_vault_skin(state: State<'_, AppState>, id: String) -> Result<(), SkinError> {
    let entry = read_vault()?.into_iter().find(|entry| entry.id == id).ok_or_else(|| SkinError { message: "Skin nicht in der Schmiede gefunden".into() })?;
    let bytes = std::fs::read(vault_dir()?.join(&entry.file_name)).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    validate_skin(&bytes, &entry.variant)?;
    let access_token = fresh_access_token(state.inner()).await?;
    skin::upload_skin(&access_token, &entry.variant, bytes, &entry.file_name).await.map_err(SkinError::from)
}

#[tauri::command]
pub fn delete_vault_skin(id: String) -> Result<(), SkinError> {
    let mut entries = read_vault()?;
    let Some(index) = entries.iter().position(|entry| entry.id == id) else { return Err(SkinError { message: "Skin nicht in der Schmiede gefunden".into() }); };
    let entry = entries.remove(index);
    let _ = std::fs::remove_file(vault_dir()?.join(entry.file_name));
    write_vault(&entries)
}

#[tauri::command]
pub fn open_skin_vault_folder() -> Result<(), SkinError> {
    let dir = vault_dir()?;
    std::fs::create_dir_all(&dir).map_err(anyhow::Error::from).map_err(SkinError::from)?;
    open::that(dir).map_err(anyhow::Error::from).map_err(SkinError::from)
}
