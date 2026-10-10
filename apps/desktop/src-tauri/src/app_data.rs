use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

const APP_CONFIG_DIR: &str = "com.zonov.markdown-notes";

pub(crate) fn config_file(name: &str) -> AppResult<PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| AppError::io("no OS config dir"))?;
    Ok(config_file_in(&base, name))
}

fn config_file_in(base: &Path, name: &str) -> PathBuf {
    base.join(APP_CONFIG_DIR).join(name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn uses_the_markdown_notes_application_directory() {
        let dir = tempdir().unwrap();
        assert_eq!(
            config_file_in(dir.path(), "settings.json"),
            dir.path().join(APP_CONFIG_DIR).join("settings.json")
        );
        assert_eq!(
            config_file_in(dir.path(), "recent-graphs.json"),
            dir.path().join(APP_CONFIG_DIR).join("recent-graphs.json")
        );
    }
}
