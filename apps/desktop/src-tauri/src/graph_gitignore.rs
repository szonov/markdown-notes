//! Ignore local indexes and common operating-system/editor files in note folders.

const DEFAULT_GROUPS: &[(&str, &[&str])] = &[
    ("Markdown Notes index + caches", &["/.markdown-notes/"]),
    ("macOS Finder metadata", &[".DS_Store", "._*"]),
    (
        "Windows Explorer metadata",
        &["Thumbs.db", "ehthumbs.db", "Desktop.ini"],
    ),
    ("Editor swap and backup files", &["*.swp", "*.swo", "*~"]),
];

pub(crate) fn default_contents() -> String {
    let mut contents = String::new();
    for &(heading, patterns) in DEFAULT_GROUPS {
        if !contents.is_empty() {
            contents.push('\n');
        }
        contents.push_str("# ");
        contents.push_str(heading);
        contents.push('\n');
        for pattern in patterns {
            contents.push_str(pattern);
            contents.push('\n');
        }
    }
    contents
}
