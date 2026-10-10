//! Schema and migrations for `<graph>/.reflect/index.sqlite`.
//!
//! `rusqlite_migration` tracks the applied version in SQLite's `user_version`
//! pragma. Append a new `M::up(include_str!(...))` (never edit a shipped one)
//! as later plans add tables — and bump [`LATEST_SCHEMA_VERSION`] with it.
//!
//! Every table is a rebuildable projection of the Markdown folder.

/// Directory inside a graph that holds the index (and marks a dir as a graph).
pub const REFLECT_DIR: &str = ".reflect";

/// The index database's filename inside [`REFLECT_DIR`].
pub const INDEX_FILE: &str = "index.sqlite";

/// `user_version` after every migration has run. Read-only consumers compare
/// this against `PRAGMA user_version` to detect an index written by a newer
/// (or older) app than they were built for.
pub const LATEST_SCHEMA_VERSION: usize = 23;

/// The `index_meta` key holding the TS-owned projection version (the rows'
/// derivation version, distinct from the schema version above).
pub const PROJECTION_VERSION_KEY: &str = "projection_version";

mod schema {
    use std::fmt;
    use std::path::Path;
    use std::sync::LazyLock;

    use rusqlite::Connection;
    use rusqlite_migration::{Migrations, M};

    /// Ordered schema migrations, loaded from `migrations/*.sql`.
    static MIGRATIONS: LazyLock<Migrations<'static>> = LazyLock::new(|| {
        Migrations::new(vec![
            M::up(include_str!("../migrations/0001_initial.sql")),
            M::up(include_str!("../migrations/0002_embeddings.sql")),
            M::up(include_str!("../migrations/0003_cosine_vectors.sql")),
            M::up(include_str!("../migrations/0004_pinned.sql")),
            M::up(include_str!("../migrations/0005_note_list_projection.sql")),
            M::up(include_str!("../migrations/0006_conflicts.sql")),
            M::up(include_str!("../migrations/0007_note_id_index.sql")),
            M::up(include_str!("../migrations/0008_chat.sql")),
            M::up(include_str!("../migrations/0009_gist.sql")),
            M::up(include_str!("../migrations/0010_tag_search_indexes.sql")),
            M::up(include_str!("../migrations/0011_tasks.sql")),
            M::up(include_str!("../migrations/0012_task_due_date.sql")),
            M::up(include_str!("../migrations/0013_perf_indexes.sql")),
            M::up(include_str!("../migrations/0014_note_kind.sql")),
            M::up(include_str!("../migrations/0015_note_kind_invariant.sql")),
            M::up(include_str!("../migrations/0016_note_emails.sql")),
            M::up(include_str!("../migrations/0017_task_breadcrumbs.sql")),
            M::up(include_str!("../migrations/0018_note_key_precedence.sql")),
            M::up(include_str!("../migrations/0019_note_claims.sql")),
            M::up(include_str!(
                "../migrations/0020_backlink_name_fallback.sql"
            )),
            M::up(include_str!("../migrations/0021_note_has_content.sql")),
            M::up(include_str!("../migrations/0022_drop_note_text.sql")),
            M::up(include_str!("../migrations/0023_task_ast_path.sql")),
        ])
    });

    /// Why a schema operation failed; `Display` carries the full story.
    #[derive(Debug)]
    pub enum SchemaError {
        Sqlite(rusqlite::Error),
        Migration(String),
        Io(std::io::Error),
    }

    impl fmt::Display for SchemaError {
        fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            match self {
                SchemaError::Sqlite(err) => write!(formatter, "{err}"),
                SchemaError::Migration(message) => write!(formatter, "migration failed: {message}"),
                SchemaError::Io(err) => write!(formatter, "{err}"),
            }
        }
    }

    impl std::error::Error for SchemaError {}

    impl From<rusqlite::Error> for SchemaError {
        fn from(err: rusqlite::Error) -> Self {
            SchemaError::Sqlite(err)
        }
    }

    impl From<std::io::Error> for SchemaError {
        fn from(err: std::io::Error) -> Self {
            SchemaError::Io(err)
        }
    }

    /// Opens an in-memory connection used by schema tests.
    pub fn open_in_memory() -> Result<Connection, SchemaError> {
        Ok(Connection::open_in_memory()?)
    }

    /// Bring the connection up to the latest schema version (no-op if current).
    pub fn migrate(conn: &mut Connection) -> Result<(), SchemaError> {
        MIGRATIONS
            .to_latest(conn)
            .map_err(|err| SchemaError::Migration(err.to_string()))
    }

    /// Stop at schema `version`, so schema-evolution tests can stage data in an
    /// older shape and assert what a later migration does with it.
    pub fn migrate_to(conn: &mut Connection, version: usize) -> Result<(), SchemaError> {
        MIGRATIONS
            .to_version(conn, version)
            .map_err(|err| SchemaError::Migration(format!("to version {version}: {err}")))
    }

    /// Open (creating if needed) and migrate `<root>/.reflect/index.sqlite`.
    pub fn open_index_at(root: &Path) -> Result<Connection, SchemaError> {
        let dir = root.join(super::REFLECT_DIR);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(super::INDEX_FILE);
        let mut conn = Connection::open(&path)?;
        let has_removed_ai_tables: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name IN ('embedding_chunks', 'embedding_vectors', 'chat_conversations', 'chat_messages'))",
            [],
            |row| row.get(0),
        )?;
        if has_removed_ai_tables {
            drop(conn);
            for candidate in [
                path.clone(),
                path.with_extension("sqlite-wal"),
                path.with_extension("sqlite-shm"),
            ] {
                match std::fs::remove_file(candidate) {
                    Ok(()) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => return Err(error.into()),
                }
            }
            conn = Connection::open(&path)?;
        }
        // Another PROCESS can hold this database too — a second app flavor on
        // the same graph, or the `reflect` CLI (which sets its own timeout).
        // Wait briefly for a cross-process lock to clear instead of failing
        // writes instantly with SQLITE_BUSY ("database is locked").
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        migrate(&mut conn)?;
        Ok(conn)
    }

    /// Open `<root>/.reflect/index.sqlite` **read-only** (no create, no
    /// migrate) — a second connection for query traffic, so a long read never
    /// holds the writer's lock. WAL readers see the last committed state, and
    /// the writer connection (opened first via [`open_index_at`]) owns the
    /// file's existence and schema.
    pub fn open_index_read_only_at(root: &Path) -> Result<Connection, SchemaError> {
        let path = root.join(super::REFLECT_DIR).join(super::INDEX_FILE);
        let conn = Connection::open_with_flags(
            path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY
                | rusqlite::OpenFlags::SQLITE_OPEN_URI
                | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        Ok(conn)
    }

    /// Check the migration set itself (each `up` parses and applies in order).
    pub fn validate() -> Result<(), SchemaError> {
        MIGRATIONS
            .validate()
            .map_err(|err| SchemaError::Migration(format!("invalid migration set: {err}")))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn migrations_are_valid() {
            validate().unwrap();
        }

        #[test]
        fn latest_schema_version_matches_migrations() {
            let mut conn = open_in_memory().unwrap();
            migrate(&mut conn).unwrap();
            let version: i64 = conn
                .query_row("PRAGMA user_version", [], |row| row.get(0))
                .unwrap();
            assert_eq!(version, crate::LATEST_SCHEMA_VERSION as i64);
        }
    }
}

pub use schema::{
    migrate, migrate_to, open_in_memory, open_index_at, open_index_read_only_at, validate,
    SchemaError,
};
