// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![execute_sql])
        // .invoke_handler(tauri::generate_handler![execute_sql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



use serde_json::json;
use tauri::command;

#[command]
fn execute_sql(sql: String) -> Result<String, String> {
    println!("Executing SQL: {}", sql);
    
    // Return hardcoded results based on the SQL query
    let result = if sql.contains("SELECT * FROM users") {
        json!([
            {"id": 1, "name": "John Doe", "email": "john@example.com", "age": 30},
            {"id": 2, "name": "Jane Smith", "email": "jane@example.com", "age": 25},
            {"id": 3, "name": "Bob Johnson", "email": "bob@example.com", "age": 35},
            {"id": 4, "name": "Alice Brown", "email": "alice@example.com", "age": 28},
            {"id": 5, "name": "Charlie Wilson", "email": "charlie@example.com", "age": 32}
        ])
    } else if sql.contains("COUNT") {
        json!([{"user_count": 5}])
    } else if sql.contains("INSERT") {
        json!({"message": "Insert successful", "rows_affected": 1})
    } else if sql.contains("UPDATE") {
        json!({"message": "Update successful", "rows_affected": 1})
    } else if sql.contains("DELETE") {
        json!({"message": "Delete successful", "rows_affected": 1})
    } else if sql.contains("CREATE TABLE") {
        json!({"message": "Table created successfully"})
    } else if sql.trim().is_empty() {
        return Err("Empty SQL query".to_string());
    } else {
        json!({"error": "Query not supported in demo", "received_query": sql})
    };
    
    Ok(result.to_string())
}
