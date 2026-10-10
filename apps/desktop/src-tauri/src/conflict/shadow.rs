//! Compatibility cleanup for the former sync-base cache.

use std::fs;
use std::path::{Path, PathBuf};

pub struct ShadowStore {
    dir: PathBuf,
}

impl ShadowStore {
    pub fn new(root: &Path) -> Self {
        Self {
            dir: root.join(".markdown-notes").join("sync-base"),
        }
    }

    pub fn forget(&self, rel: &str) {
        for suffix in ["", ".pair"] {
            if let Some(path) = self.entry_path(rel, suffix) {
                let _ = fs::remove_file(path);
            }
        }
    }

    pub fn record_move(&self, from: &str, to: &str) {
        for suffix in ["", ".pair"] {
            let (Some(source), Some(target)) =
                (self.entry_path(from, suffix), self.entry_path(to, suffix))
            else {
                continue;
            };
            if !source.exists() {
                continue;
            }
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::rename(source, target);
        }
    }

    fn entry_path(&self, rel: &str, suffix: &str) -> Option<PathBuf> {
        crate::fs::ensure_relative(rel).ok()?;
        Some(self.dir.join(format!("{rel}{suffix}")))
    }
}
