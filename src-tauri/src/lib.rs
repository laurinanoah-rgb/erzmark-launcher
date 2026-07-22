mod auth;
mod bugreport;
mod bugreport_commands;
mod commands;
mod config;
mod events;
mod events_commands;
mod friend_skin;
mod friends;
mod friends_commands;
mod game;
mod game_commands;
mod news;
mod news_commands;
mod profiles;
mod profiles_commands;
mod settings;
mod settings_commands;
mod skin_commands;
mod social;
mod social_commands;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::login,
            commands::try_restore_session,
            commands::ensure_fresh_session,
            commands::logout,
            game_commands::get_play_status,
            game_commands::install_or_update,
            game_commands::launch_game,
            game_commands::list_screenshots,
            game_commands::open_screenshots_folder,
            game_commands::open_screenshot,
            news_commands::get_news,
            news_commands::open_external_url,
            settings_commands::get_settings,
            settings_commands::save_settings,
            settings_commands::get_launcher_version,
            settings_commands::open_game_folder,
            settings_commands::open_log_file,
            settings_commands::reset_installation,
            events_commands::get_boss_event,
            friends_commands::get_friends,
            friends_commands::get_friend_skin_url,
            social_commands::get_friend_requests,
            social_commands::respond_friend_request,
            social_commands::remove_friend,
            social_commands::get_profile_media,
            social_commands::upload_profile_photo,
            social_commands::remove_profile_photo,
            social_commands::upload_profile_cover,
            social_commands::remove_profile_cover,
            profiles_commands::get_character_profiles,
            skin_commands::get_current_skin_url,
            skin_commands::set_skin_url,
            skin_commands::upload_skin_file,
            skin_commands::reset_skin,
            bugreport_commands::get_bug_report_context,
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Erzmark-Launcher-Anwendung");
}
