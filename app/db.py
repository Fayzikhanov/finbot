from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

TRANSFER_OUT_CATEGORY = "transfer_internal_out"
TRANSFER_IN_CATEGORY = "transfer_internal_in"
TRANSFER_CATEGORIES = (TRANSFER_OUT_CATEGORY, TRANSFER_IN_CATEGORY)
SUPPORTED_LANGUAGE_CODES = {"ru", "uz", "en"}
SCHEDULED_REPORT_TYPES = {"daily", "weekly", "monthly"}
DEFAULT_REPORT_TIMEZONE = "Asia/Tashkent"
DEFAULT_DAILY_REPORT_HOUR = 21
DEFAULT_DAILY_REPORT_MINUTE = 0
DEFAULT_WEEKLY_REPORT_HOUR = 21
DEFAULT_WEEKLY_REPORT_MINUTE = 1
DEFAULT_WEEKLY_REPORT_WEEKDAY = 6  # Sunday (Python: Monday=0)
DEFAULT_MONTHLY_REPORT_HOUR = 21
DEFAULT_MONTHLY_REPORT_MINUTE = 2
DEFAULT_MONTHLY_REPORT_MONTHDAY = 31  # Interpreted as last day when month shorter


def _to_ts(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def _table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row[1]) for row in rows}


@dataclass(frozen=True)
class FinanceTransaction:
    chat_id: int
    telegram_user_id: int
    member_name: str
    kind: str
    amount: float
    currency: str
    category: str
    description: str
    is_family: bool
    source_type: str
    original_text: str
    message_id: int
    transcript: str | None = None
    workspace_id: int | None = None


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.last_migration_stats: dict[str, int] = {}

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def initialize(self) -> None:
        with self._connect() as conn:
            conn.execute("PRAGMA journal_mode = WAL;")
            self._ensure_users_table(conn)
            self._ensure_user_profile_history_table(conn)
            self._ensure_workspaces_tables(conn)
            self._ensure_workspace_report_schedules_table(conn)
            self._ensure_workspace_report_deliveries_table(conn)
            self._ensure_bot_reviews_table(conn)
            self._ensure_api_idempotency_keys_table(conn)
            self._ensure_members_table(conn)
            self._ensure_transactions_table(conn)
            self.last_migration_stats = self._run_workspace_migrations(conn)

    def _ensure_users_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                telegram_user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                display_name TEXT,
                phone TEXT,
                email TEXT,
                birth_date TEXT,
                created_at TEXT NOT NULL,
                last_active_at TEXT NOT NULL,
                has_added_transaction INTEGER NOT NULL DEFAULT 0,
                language TEXT DEFAULT 'ru',
                language_selected INTEGER NOT NULL DEFAULT 0,
                currency TEXT DEFAULT 'UZS'
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_users_last_active
            ON users(last_active_at)
            """
        )
        cols = _table_columns(conn, "users")
        if "phone" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN phone TEXT")
        if "email" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
        if "birth_date" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN birth_date TEXT")
        if "display_name" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
        if "language_selected" not in cols:
            conn.execute(
                "ALTER TABLE users ADD COLUMN language_selected INTEGER NOT NULL DEFAULT 0"
            )

    def _ensure_user_profile_history_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_profile_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_user_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_at TEXT NOT NULL
            )
            """
        )

    def _ensure_workspaces_tables(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK (type IN ('personal', 'family', 'business')),
                title TEXT,
                created_by INTEGER,
                plan TEXT NOT NULL DEFAULT 'free',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER NOT NULL,
                telegram_user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
            ON workspace_members(workspace_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_members_user
            ON workspace_members(telegram_user_id)
            """
        )
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_members_workspace_user
            ON workspace_members(workspace_id, telegram_user_id)
            """
        )
        workspace_member_cols = _table_columns(conn, "workspace_members")
        if "language" not in workspace_member_cols:
            conn.execute("ALTER TABLE workspace_members ADD COLUMN language TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_bindings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER NOT NULL,
                telegram_chat_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_bindings_chat
            ON workspace_bindings(telegram_chat_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_bindings_workspace
            ON workspace_bindings(workspace_id)
            """
        )

    def _ensure_workspace_report_schedules_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_report_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER NOT NULL,
                report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
                enabled INTEGER NOT NULL DEFAULT 1,
                timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
                send_hour INTEGER NOT NULL DEFAULT 21,
                send_minute INTEGER NOT NULL DEFAULT 0,
                weekday INTEGER,
                monthday INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_report_schedules_workspace_type
            ON workspace_report_schedules(workspace_id, report_type)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_report_schedules_enabled
            ON workspace_report_schedules(report_type, enabled)
            """
        )
        cols = _table_columns(conn, "workspace_report_schedules")
        if "timezone" not in cols:
            conn.execute(
                "ALTER TABLE workspace_report_schedules ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent'"
            )
        if "send_hour" not in cols:
            conn.execute(
                f"ALTER TABLE workspace_report_schedules ADD COLUMN send_hour INTEGER NOT NULL DEFAULT {DEFAULT_DAILY_REPORT_HOUR}"
            )
        if "send_minute" not in cols:
            conn.execute(
                f"ALTER TABLE workspace_report_schedules ADD COLUMN send_minute INTEGER NOT NULL DEFAULT {DEFAULT_DAILY_REPORT_MINUTE}"
            )
        if "weekday" not in cols:
            conn.execute("ALTER TABLE workspace_report_schedules ADD COLUMN weekday INTEGER")
        if "monthday" not in cols:
            conn.execute("ALTER TABLE workspace_report_schedules ADD COLUMN monthday INTEGER")

    def _ensure_workspace_report_deliveries_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_report_deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER NOT NULL,
                report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
                period_key TEXT NOT NULL,
                chat_id INTEGER NOT NULL,
                sent_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_report_deliveries_scope
            ON workspace_report_deliveries(workspace_id, report_type, period_key)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_report_deliveries_sent_at
            ON workspace_report_deliveries(sent_at)
            """
        )

    @staticmethod
    def _chat_type_from_chat_id(chat_id: int) -> str:
        return "private" if int(chat_id) > 0 else "supergroup"

    @staticmethod
    def _workspace_type_for_legacy_chat(chat_id: int) -> str:
        return "personal" if int(chat_id) > 0 else "family"

    def _resolve_workspace_id_for_chat_conn(self, conn: sqlite3.Connection, chat_id: int) -> int | None:
        row = conn.execute(
            """
            SELECT workspace_id
            FROM workspace_bindings
            WHERE telegram_chat_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (int(chat_id),),
        ).fetchone()
        if not row:
            return None
        try:
            workspace_id = int(row["workspace_id"])
        except Exception:
            return None
        return workspace_id if workspace_id > 0 else None

    def _backfill_chat_records_workspace_conn(
        self,
        conn: sqlite3.Connection,
        *,
        chat_id: int,
        workspace_id: int,
    ) -> dict[str, int]:
        stats = {
            "transactions_updated": 0,
            "members_updated": 0,
            "reviews_updated": 0,
            "workspace_members_inserted": 0,
            "workspace_members_promoted_owner": 0,
        }
        tx_cursor = conn.execute(
            """
            UPDATE transactions
            SET workspace_id = ?
            WHERE chat_id = ? AND (workspace_id IS NULL OR workspace_id = 0)
            """,
            (int(workspace_id), int(chat_id)),
        )
        stats["transactions_updated"] = int(tx_cursor.rowcount or 0)

        member_cols = _table_columns(conn, "members")
        if "workspace_id" in member_cols:
            member_cursor = conn.execute(
                """
                UPDATE members
                SET workspace_id = ?
                WHERE chat_id = ? AND (workspace_id IS NULL OR workspace_id = 0)
                """,
                (int(workspace_id), int(chat_id)),
            )
            stats["members_updated"] = int(member_cursor.rowcount or 0)

            wm_cursor = conn.execute(
                """
                INSERT OR IGNORE INTO workspace_members (
                    workspace_id,
                    telegram_user_id,
                    role
                )
                SELECT DISTINCT ?, m.telegram_user_id, 'member'
                FROM members m
                WHERE m.chat_id = ?
                """,
                (int(workspace_id), int(chat_id)),
            )
            stats["workspace_members_inserted"] = int(wm_cursor.rowcount or 0)

        review_cols = _table_columns(conn, "bot_reviews")
        if "workspace_id" in review_cols:
            review_cursor = conn.execute(
                """
                UPDATE bot_reviews
                SET workspace_id = ?
                WHERE chat_id = ? AND (workspace_id IS NULL OR workspace_id = 0)
                """,
                (int(workspace_id), int(chat_id)),
            )
            stats["reviews_updated"] = int(review_cursor.rowcount or 0)
        return stats

    def _promote_workspace_owner_if_missing_conn(
        self,
        conn: sqlite3.Connection,
        *,
        workspace_id: int,
        preferred_user_id: int | None = None,
    ) -> int:
        existing_owner = conn.execute(
            """
            SELECT 1
            FROM workspace_members
            WHERE workspace_id = ? AND role = 'owner'
            LIMIT 1
            """,
            (int(workspace_id),),
        ).fetchone()
        if existing_owner is not None:
            return 0

        candidate_user_id = None
        if preferred_user_id and int(preferred_user_id) > 0:
            row = conn.execute(
                """
                SELECT telegram_user_id
                FROM workspace_members
                WHERE workspace_id = ? AND telegram_user_id = ?
                LIMIT 1
                """,
                (int(workspace_id), int(preferred_user_id)),
            ).fetchone()
            if row is not None:
                candidate_user_id = int(row["telegram_user_id"])

        if candidate_user_id is None:
            row = conn.execute(
                """
                SELECT telegram_user_id
                FROM workspace_members
                WHERE workspace_id = ?
                ORDER BY id ASC
                LIMIT 1
                """,
                (int(workspace_id),),
            ).fetchone()
            if row is not None:
                candidate_user_id = int(row["telegram_user_id"])

        if candidate_user_id is None:
            return 0

        cursor = conn.execute(
            """
            UPDATE workspace_members
            SET role = 'owner'
            WHERE workspace_id = ? AND telegram_user_id = ?
            """,
            (int(workspace_id), int(candidate_user_id)),
        )
        return int(cursor.rowcount or 0)

    def _run_workspace_migrations(self, conn: sqlite3.Connection) -> dict[str, int]:
        stats = {
            "workspaces_created": 0,
            "bindings_created": 0,
            "transactions_migrated": 0,
            "members_migrated": 0,
            "reviews_migrated": 0,
            "workspace_members_inserted": 0,
            "workspace_owners_promoted": 0,
            "workspace_types_normalized": 0,
        }

        tx_cols = _table_columns(conn, "transactions")
        if "workspace_id" not in tx_cols:
            return stats

        rows = conn.execute(
            """
            SELECT DISTINCT chat_id
            FROM transactions
            WHERE chat_id IS NOT NULL AND (workspace_id IS NULL OR workspace_id = 0)
            ORDER BY chat_id ASC
            """
        ).fetchall()

        for row in rows:
            chat_id = int(row["chat_id"])
            workspace_id = self._resolve_workspace_id_for_chat_conn(conn, chat_id)
            if workspace_id is None:
                cursor = conn.execute(
                    """
                    INSERT INTO workspaces (
                        type,
                        title,
                        created_by,
                        plan
                    ) VALUES (?, ?, NULL, 'free')
                    """,
                    (self._workspace_type_for_legacy_chat(chat_id), "Migrated workspace"),
                )
                workspace_id = int(cursor.lastrowid)
                stats["workspaces_created"] += 1
                conn.execute(
                    """
                    INSERT INTO workspace_bindings (
                        workspace_id,
                        telegram_chat_id
                    ) VALUES (?, ?)
                    """,
                    (workspace_id, chat_id),
                )
                stats["bindings_created"] += 1

            backfill = self._backfill_chat_records_workspace_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            stats["transactions_migrated"] += int(backfill["transactions_updated"])
            stats["members_migrated"] += int(backfill["members_updated"])
            stats["reviews_migrated"] += int(backfill["reviews_updated"])
            stats["workspace_members_inserted"] += int(backfill["workspace_members_inserted"])

            promoted = self._promote_workspace_owner_if_missing_conn(conn, workspace_id=workspace_id)
            stats["workspace_owners_promoted"] += int(promoted)

        # Backfill rows for chats that already have bindings but were created after migration
        # hooks were introduced (e.g. during rollout or tests).
        binding_rows = conn.execute(
            """
            SELECT workspace_id, telegram_chat_id
            FROM workspace_bindings
            ORDER BY id ASC
            """
        ).fetchall()
        for row in binding_rows:
            workspace_id = int(row["workspace_id"])
            chat_id = int(row["telegram_chat_id"])
            expected_type = self._workspace_type_for_legacy_chat(chat_id)
            type_cursor = conn.execute(
                """
                UPDATE workspaces
                SET type = ?
                WHERE id = ? AND type != ?
                """,
                (expected_type, workspace_id, expected_type),
            )
            stats["workspace_types_normalized"] += int(type_cursor.rowcount or 0)
            backfill = self._backfill_chat_records_workspace_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            stats["transactions_migrated"] += int(backfill["transactions_updated"])
            stats["members_migrated"] += int(backfill["members_updated"])
            stats["reviews_migrated"] += int(backfill["reviews_updated"])
            stats["workspace_members_inserted"] += int(backfill["workspace_members_inserted"])
            stats["workspace_owners_promoted"] += int(
                self._promote_workspace_owner_if_missing_conn(conn, workspace_id=workspace_id)
            )

        return stats

    def _ensure_bot_reviews_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bot_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER,
                chat_id INTEGER NOT NULL,
                telegram_user_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_bot_reviews_created_at
            ON bot_reviews(created_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_bot_reviews_user_created
            ON bot_reviews(telegram_user_id, created_at)
            """
        )
        cols = _table_columns(conn, "bot_reviews")
        if "workspace_id" not in cols:
            conn.execute("ALTER TABLE bot_reviews ADD COLUMN workspace_id INTEGER")
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_bot_reviews_workspace_user_created
            ON bot_reviews(workspace_id, telegram_user_id, created_at)
            """
        )

    def _ensure_api_idempotency_keys_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_idempotency_keys (
                idempotency_key TEXT PRIMARY KEY,
                endpoint TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                request_hash TEXT NOT NULL,
                response_code INTEGER,
                response_body TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_api_idempotency_expires_at
            ON api_idempotency_keys(expires_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_api_idempotency_user_created
            ON api_idempotency_keys(user_id, created_at)
            """
        )

    def _ensure_members_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS members (
                chat_id INTEGER NOT NULL,
                workspace_id INTEGER,
                telegram_user_id INTEGER NOT NULL,
                username TEXT,
                full_name TEXT NOT NULL,
                custom_name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (chat_id, telegram_user_id)
            )
            """
        )

        cols = _table_columns(conn, "members")
        if "custom_name" not in cols:
            conn.execute("ALTER TABLE members ADD COLUMN custom_name TEXT")
        if "workspace_id" not in cols:
            conn.execute("ALTER TABLE members ADD COLUMN workspace_id INTEGER")
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_members_workspace
            ON members(workspace_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_members_workspace_user
            ON members(workspace_id, telegram_user_id)
            """
        )

        # Cleanup legacy role-based indexes if they still exist.
        conn.execute("DROP INDEX IF EXISTS idx_unique_husband_per_chat")
        conn.execute("DROP INDEX IF EXISTS idx_unique_wife_per_chat")

    def _ensure_transactions_table(self, conn: sqlite3.Connection) -> None:
        cols = _table_columns(conn, "transactions")
        if not cols:
            self._create_transactions_table(conn)
            self._create_transactions_indexes(conn)
            return

        if "member_name" not in cols:
            conn.execute("ALTER TABLE transactions RENAME TO transactions_legacy")
            self._create_transactions_table(conn)

            conn.execute(
                """
                INSERT INTO transactions (
                    workspace_id,
                    chat_id,
                    telegram_user_id,
                    member_name,
                    kind,
                    amount,
                    currency,
                    category,
                    description,
                    is_family,
                    source_type,
                    original_text,
                    transcript,
                    message_id,
                    created_at
                )
                SELECT
                    NULL AS workspace_id,
                    t.chat_id,
                    t.telegram_user_id,
                    COALESCE(
                        m.custom_name,
                        m.full_name,
                        CASE
                            WHEN t.role = 'husband' THEN 'Муж'
                            WHEN t.role = 'wife' THEN 'Жена'
                            ELSE 'Участник'
                        END
                    ) AS member_name,
                    t.kind,
                    t.amount,
                    t.currency,
                    t.category,
                    t.description,
                    t.is_family,
                    t.source_type,
                    t.original_text,
                    t.transcript,
                    t.message_id,
                    t.created_at
                FROM transactions_legacy t
                LEFT JOIN members m
                    ON m.chat_id = t.chat_id
                    AND m.telegram_user_id = t.telegram_user_id
                """
            )
            conn.execute("DROP TABLE transactions_legacy")
            cols = _table_columns(conn, "transactions")

        if "workspace_id" not in cols:
            conn.execute("ALTER TABLE transactions ADD COLUMN workspace_id INTEGER")

        self._create_transactions_indexes(conn)

    @staticmethod
    def _create_transactions_table(conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER,
                chat_id INTEGER NOT NULL,
                telegram_user_id INTEGER NOT NULL,
                member_name TEXT NOT NULL,
                kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
                amount REAL NOT NULL CHECK (amount > 0),
                currency TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                is_family INTEGER NOT NULL CHECK (is_family IN (0, 1)),
                source_type TEXT NOT NULL CHECK (source_type IN ('text', 'voice')),
                original_text TEXT NOT NULL,
                transcript TEXT,
                message_id INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

    @staticmethod
    def _create_transactions_indexes(conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_chat_time
                ON transactions(chat_id, created_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_workspace_time
                ON transactions(workspace_id, created_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_workspace_user
                ON transactions(workspace_id, telegram_user_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_workspace_family
                ON transactions(workspace_id, is_family)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_chat_user
                ON transactions(chat_id, telegram_user_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_transactions_chat_family
                ON transactions(chat_id, is_family)
            """
        )

    def register_member(
        self,
        chat_id: int,
        telegram_user_id: int,
        username: str | None,
        full_name: str,
    ) -> None:
        now = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            workspace_id = self._resolve_workspace_id_for_chat_conn(conn, int(chat_id))
            conn.execute(
                """
                INSERT INTO members (
                    chat_id,
                    workspace_id,
                    telegram_user_id,
                    username,
                    full_name,
                    custom_name,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
                ON CONFLICT(chat_id, telegram_user_id)
                DO UPDATE SET
                    workspace_id = COALESCE(excluded.workspace_id, members.workspace_id),
                    username = excluded.username,
                    full_name = excluded.full_name,
                    updated_at = excluded.updated_at
                """,
                (chat_id, workspace_id, telegram_user_id, username, full_name, now, now),
            )
            if workspace_id is not None and workspace_id > 0:
                self._upsert_workspace_member_conn(
                    conn,
                    workspace_id=workspace_id,
                    telegram_user_id=int(telegram_user_id),
                    role="member",
                )

    def workspace_exists(self, chat_id: int) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1
                FROM workspace_bindings
                WHERE telegram_chat_id = ?
                LIMIT 1
                """,
                (int(chat_id),),
            ).fetchone()
        return row is not None

    @staticmethod
    def _upsert_workspace_member_conn(
        conn: sqlite3.Connection,
        *,
        workspace_id: int,
        telegram_user_id: int,
        role: str = "member",
    ) -> None:
        normalized_role = "owner" if str(role or "").strip().lower() == "owner" else "member"
        conn.execute(
            """
            INSERT INTO workspace_members (
                workspace_id,
                telegram_user_id,
                role
            ) VALUES (?, ?, ?)
            ON CONFLICT(workspace_id, telegram_user_id)
            DO UPDATE SET
                role = CASE
                    WHEN workspace_members.role = 'owner' THEN 'owner'
                    WHEN excluded.role = 'owner' THEN 'owner'
                    ELSE 'member'
                END
            """,
            (int(workspace_id), int(telegram_user_id), normalized_role),
        )

    def create_workspace(
        self,
        *,
        workspace_type: str,
        title: str | None,
        created_by: int | None,
        plan: str = "free",
    ) -> int:
        kind = str(workspace_type or "").strip().lower()
        if kind not in {"personal", "family", "business"}:
            raise ValueError(f"Unsupported workspace type: {workspace_type}")
        plan_value = str(plan or "free").strip().lower() or "free"
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO workspaces (
                    type,
                    title,
                    created_by,
                    plan
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    kind,
                    (str(title).strip() if isinstance(title, str) and str(title).strip() else None),
                    int(created_by) if created_by is not None else None,
                    plan_value,
                ),
            )
            return int(cursor.lastrowid)

    def bind_workspace_chat(self, *, workspace_id: int, telegram_chat_id: int) -> None:
        with self._connect() as conn:
            existing = conn.execute(
                """
                SELECT id, workspace_id
                FROM workspace_bindings
                WHERE telegram_chat_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (int(telegram_chat_id),),
            ).fetchone()
            if existing is None:
                conn.execute(
                    """
                    INSERT INTO workspace_bindings (
                        workspace_id,
                        telegram_chat_id
                    ) VALUES (?, ?)
                    """,
                    (int(workspace_id), int(telegram_chat_id)),
                )
            elif int(existing["workspace_id"]) != int(workspace_id):
                conn.execute(
                    """
                    INSERT INTO workspace_bindings (
                        workspace_id,
                        telegram_chat_id
                    ) VALUES (?, ?)
                    """,
                    (int(workspace_id), int(telegram_chat_id)),
                )
            self._backfill_chat_records_workspace_conn(
                conn,
                chat_id=int(telegram_chat_id),
                workspace_id=int(workspace_id),
            )

    def add_workspace_member(
        self,
        *,
        workspace_id: int,
        telegram_user_id: int,
        role: str = "member",
    ) -> None:
        with self._connect() as conn:
            self._upsert_workspace_member_conn(
                conn,
                workspace_id=int(workspace_id),
                telegram_user_id=int(telegram_user_id),
                role=role,
            )

    @staticmethod
    def _normalize_language_code(value: str | None) -> str:
        code = str(value or "").strip().lower()
        return code if code in SUPPORTED_LANGUAGE_CODES else "ru"

    def get_workspace_member_language(self, *, workspace_id: int, telegram_user_id: int) -> str | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT language
                FROM workspace_members
                WHERE workspace_id = ? AND telegram_user_id = ?
                LIMIT 1
                """,
                (int(workspace_id), int(telegram_user_id)),
            ).fetchone()
        if row is None:
            return None
        raw = str(row["language"] or "").strip().lower()
        if not raw:
            return None
        if raw not in SUPPORTED_LANGUAGE_CODES:
            return None
        return raw

    def set_workspace_member_language(
        self,
        *,
        workspace_id: int,
        telegram_user_id: int,
        language: str,
    ) -> None:
        normalized = self._normalize_language_code(language)
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id
                FROM workspace_members
                WHERE workspace_id = ? AND telegram_user_id = ?
                LIMIT 1
                """,
                (int(workspace_id), int(telegram_user_id)),
            ).fetchone()
            if row is None:
                raise ValueError(
                    f"Workspace member not found: workspace_id={workspace_id} user_id={telegram_user_id}"
                )
            conn.execute(
                """
                UPDATE workspace_members
                SET language = ?
                WHERE workspace_id = ? AND telegram_user_id = ?
                """,
                (normalized, int(workspace_id), int(telegram_user_id)),
            )

    def get_effective_workspace_language(self, *, workspace_id: int, telegram_user_id: int) -> str:
        scoped = self.get_workspace_member_language(
            workspace_id=int(workspace_id),
            telegram_user_id=int(telegram_user_id),
        )
        if scoped:
            return scoped
        profile = self.get_user_profile(int(telegram_user_id))
        return self._normalize_language_code(str(profile.get("language") or "ru"))

    def get_workspace_by_chat_id(self, chat_id: int) -> dict[str, object] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    w.id,
                    w.type,
                    w.title,
                    w.created_by,
                    w.plan,
                    w.created_at,
                    wb.telegram_chat_id
                FROM workspace_bindings wb
                JOIN workspaces w ON w.id = wb.workspace_id
                WHERE wb.telegram_chat_id = ?
                ORDER BY wb.id DESC
                LIMIT 1
                """,
                (int(chat_id),),
            ).fetchone()
        if not row:
            return None
        return {
            "id": int(row["id"]),
            "type": str(row["type"]),
            "title": row["title"],
            "created_by": None if row["created_by"] is None else int(row["created_by"]),
            "plan": str(row["plan"] or "free"),
            "created_at": str(row["created_at"] or ""),
            "chat_id": int(row["telegram_chat_id"]),
        }

    def get_workspace_id_by_chat_id(self, chat_id: int) -> int | None:
        workspace = self.get_workspace_by_chat_id(chat_id)
        if not workspace:
            return None
        try:
            workspace_id = int(workspace["id"])
        except Exception:
            return None
        return workspace_id if workspace_id > 0 else None

    def resolve_workspace(
        self,
        user_id: int,
        chat_id: int,
        chat_type: str,
    ) -> dict[str, object] | None:
        normalized_chat_type = str(chat_type or "").strip().lower()
        target_chat_id = int(chat_id)
        target_user_id = int(user_id)
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    w.id AS workspace_id,
                    w.type AS workspace_type,
                    w.title AS workspace_title,
                    w.created_by AS workspace_created_by,
                    w.plan AS workspace_plan,
                    w.created_at AS workspace_created_at,
                    wb.telegram_chat_id AS telegram_chat_id
                FROM workspace_bindings wb
                JOIN workspaces w ON w.id = wb.workspace_id
                WHERE wb.telegram_chat_id = ?
                ORDER BY wb.id DESC
                LIMIT 1
                """,
                (target_chat_id,),
            ).fetchone()
            if row is None:
                return None

            workspace_id = int(row["workspace_id"])
            workspace_type = str(row["workspace_type"])
            if normalized_chat_type == "private" and workspace_type != "personal":
                return None
            if normalized_chat_type in {"group", "supergroup"} and workspace_type == "personal":
                return None

            member_row = None
            if target_user_id > 0:
                member_row = conn.execute(
                    """
                    SELECT role
                    FROM workspace_members
                    WHERE workspace_id = ? AND telegram_user_id = ?
                    LIMIT 1
                    """,
                    (workspace_id, target_user_id),
                ).fetchone()

        return {
            "workspace_id": workspace_id,
            "type": workspace_type,
            "title": row["workspace_title"],
            "created_by": None if row["workspace_created_by"] is None else int(row["workspace_created_by"]),
            "plan": str(row["workspace_plan"] or "free"),
            "created_at": str(row["workspace_created_at"] or ""),
            "chat_id": int(row["telegram_chat_id"]),
            "is_member": member_row is not None,
            "member_role": str(member_row["role"]) if member_row is not None else None,
        }

    def register_user(
        self,
        telegram_user_id: int,
        username: str | None,
        first_name: str | None,
        last_name: str | None,
    ) -> None:
        now = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO users (
                    telegram_user_id,
                    username,
                    first_name,
                    last_name,
                    created_at,
                    last_active_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(telegram_user_id)
                DO UPDATE SET
                    username = excluded.username,
                    first_name = excluded.first_name,
                    last_name = excluded.last_name,
                    last_active_at = excluded.last_active_at
                """,
                (telegram_user_id, username, first_name, last_name, now, now),
            )

    def touch_user(self, telegram_user_id: int) -> None:
        now = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE users
                SET last_active_at = ?
                WHERE telegram_user_id = ?
                """,
                (now, telegram_user_id),
            )

    def mark_user_activated(self, telegram_user_id: int) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE users
                SET has_added_transaction = 1
                WHERE telegram_user_id = ? AND has_added_transaction = 0
                """,
                (telegram_user_id,),
            )

    def get_admin_stats(self) -> dict:
        total_users = self.get_users_count()
        active_users_7d = self.get_active_users_count(days=7)
        activated_users = self.get_users_with_transactions_count()
        total_transactions = self.get_transactions_count()
        transactions_7d = self.get_transactions_count_last_days(days=7)
        inactive_users = max(0, total_users - activated_users)

        return {
            "total_users": total_users,
            "active_users_7d": active_users_7d,
            "activated_users": activated_users,
            "inactive_users": inactive_users,
            "total_transactions": total_transactions,
            "transactions_7d": transactions_7d,
        }

    def get_users_count(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM users").fetchone()
        return int(row["cnt"] if row else 0)

    def get_active_users_count(self, days: int = 7) -> int:
        now = datetime.utcnow()
        since = _to_ts(now - timedelta(days=max(0, int(days))))
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM users WHERE last_active_at >= ?",
                (since,),
            ).fetchone()
        return int(row["cnt"] if row else 0)

    def get_users_with_transactions_count(self) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(DISTINCT telegram_user_id) AS cnt FROM transactions"
            ).fetchone()
        return int(row["cnt"] if row else 0)

    def get_transactions_count(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM transactions").fetchone()
        return int(row["cnt"] if row else 0)

    def get_transactions_count_last_days(self, days: int = 7) -> int:
        now = datetime.utcnow()
        since = _to_ts(now - timedelta(days=max(0, int(days))))
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM transactions WHERE created_at >= ?",
                (since,),
            ).fetchone()
        return int(row["cnt"] if row else 0)

    def get_user_profile(self, telegram_user_id: int) -> dict:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    display_name,
                    phone,
                    email,
                    birth_date,
                    language,
                    language_selected,
                    currency,
                    created_at
                FROM users
                WHERE telegram_user_id = ?
                """,
                (telegram_user_id,),
            ).fetchone()

        if not row:
            return {
                "display_name": None,
                "phone": None,
                "email": None,
                "birth_date": None,
                "language": "ru",
                "language_selected": False,
                "currency": "UZS",
                "created_at": "",
            }

        return {
            "display_name": row["display_name"],
            "phone": row["phone"],
            "email": row["email"],
            "birth_date": row["birth_date"],
            "language": str(row["language"] or "ru"),
            "language_selected": bool(int(row["language_selected"] or 0)),
            "currency": str(row["currency"] or "UZS"),
            "created_at": str(row["created_at"] or ""),
        }

    def update_user_profile_field(
        self,
        telegram_user_id: int,
        field_name: str,
        new_value: str | None,
    ) -> None:
        allowed_fields = {
            "display_name",
            "phone",
            "email",
            "birth_date",
            "language",
            "currency",
        }
        if field_name not in allowed_fields:
            raise ValueError(f"Unsupported profile field: {field_name}")

        normalized_new = new_value.strip() if isinstance(new_value, str) else None
        if normalized_new == "":
            normalized_new = None

        changed_at = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            row = conn.execute(
                f"SELECT {field_name} AS value FROM users WHERE telegram_user_id = ?",
                (telegram_user_id,),
            ).fetchone()
            if not row:
                raise ValueError(f"User not found: {telegram_user_id}")

            old_value_raw = row["value"]
            old_value = None if old_value_raw is None else str(old_value_raw)
            if old_value == normalized_new:
                return

            conn.execute(
                f"UPDATE users SET {field_name} = ? WHERE telegram_user_id = ?",
                (normalized_new, telegram_user_id),
            )
            conn.execute(
                """
                INSERT INTO user_profile_history (
                    telegram_user_id,
                    field_name,
                    old_value,
                    new_value,
                    changed_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (telegram_user_id, field_name, old_value, normalized_new, changed_at),
            )

    def calculate_profile_completion(self, telegram_user_id: int) -> tuple[int, int]:
        total_fields = 6
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT display_name, phone, email, birth_date, language, currency
                FROM users
                WHERE telegram_user_id = ?
                """,
                (telegram_user_id,),
            ).fetchone()
        if not row:
            return (0, total_fields)

        completed = 0
        for key in ("display_name", "phone", "email", "birth_date", "language", "currency"):
            value = row[key]
            if value is not None:
                completed += 1
        return (completed, total_fields)

    def set_user_language(self, telegram_user_id: int, language: str) -> None:
        normalized = str(language or "").strip().lower() or "ru"
        changed_at = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT language, language_selected
                FROM users
                WHERE telegram_user_id = ?
                """,
                (telegram_user_id,),
            ).fetchone()
            if not row:
                raise ValueError(f"User not found: {telegram_user_id}")

            old_language = str(row["language"] or "ru")
            old_selected = bool(int(row["language_selected"] or 0))
            if old_language == normalized and old_selected:
                return

            conn.execute(
                """
                UPDATE users
                SET language = ?, language_selected = 1
                WHERE telegram_user_id = ?
                """,
                (normalized, telegram_user_id),
            )

            if old_language != normalized:
                conn.execute(
                    """
                    INSERT INTO user_profile_history (
                        telegram_user_id,
                        field_name,
                        old_value,
                        new_value,
                        changed_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (telegram_user_id, "language", old_language, normalized, changed_at),
                )

    def _scoped_workspace_id_conn(
        self,
        conn: sqlite3.Connection,
        *,
        chat_id: int | None = None,
        workspace_id: int | None = None,
    ) -> int | None:
        if workspace_id is not None and int(workspace_id) > 0:
            return int(workspace_id)
        if chat_id is None:
            return None
        return self._resolve_workspace_id_for_chat_conn(conn, int(chat_id))

    def _member_scope_where_conn(
        self,
        conn: sqlite3.Connection,
        *,
        chat_id: int | None = None,
        workspace_id: int | None = None,
    ) -> tuple[str, list[object], int | None]:
        resolved_workspace_id = self._scoped_workspace_id_conn(
            conn,
            chat_id=chat_id,
            workspace_id=workspace_id,
        )
        if resolved_workspace_id is not None:
            return ("workspace_id = ?", [resolved_workspace_id], resolved_workspace_id)
        if chat_id is None:
            raise ValueError("chat_id or workspace_id is required")
        return ("chat_id = ?", [int(chat_id)], None)

    def _tx_scope_where_conn(
        self,
        conn: sqlite3.Connection,
        *,
        chat_id: int | None = None,
        workspace_id: int | None = None,
        alias: str | None = None,
    ) -> tuple[str, list[object], int | None]:
        prefix = f"{alias}." if alias else ""
        resolved_workspace_id = self._scoped_workspace_id_conn(
            conn,
            chat_id=chat_id,
            workspace_id=workspace_id,
        )
        if resolved_workspace_id is not None:
            return (f"{prefix}workspace_id = ?", [resolved_workspace_id], resolved_workspace_id)
        if chat_id is None:
            raise ValueError("chat_id or workspace_id is required")
        return (f"{prefix}chat_id = ?", [int(chat_id)], None)

    def set_custom_name(
        self,
        chat_id: int,
        telegram_user_id: int,
        custom_name: str,
        *,
        workspace_id: int | None = None,
    ) -> None:
        now = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            scope_where, scope_params, _ = self._member_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            conn.execute(
                """
                UPDATE members
                SET custom_name = ?, updated_at = ?
                WHERE """ + scope_where + """ AND telegram_user_id = ?
                """,
                (custom_name, now, *scope_params, int(telegram_user_id)),
            )

    def get_custom_name(
        self,
        chat_id: int,
        telegram_user_id: int,
        *,
        workspace_id: int | None = None,
    ) -> str | None:
        with self._connect() as conn:
            scope_where, scope_params, resolved_workspace_id = self._member_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            row = conn.execute(
                """
                SELECT custom_name
                FROM members
                WHERE """ + scope_where + """ AND telegram_user_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (*scope_params, int(telegram_user_id)),
            ).fetchone()
        if not row:
            return None
        value = row["custom_name"]
        if value is None:
            return None
        return str(value)

    def get_member_display_name(
        self,
        chat_id: int,
        telegram_user_id: int,
        *,
        workspace_id: int | None = None,
    ) -> str | None:
        with self._connect() as conn:
            scope_where, scope_params, _ = self._member_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            row = conn.execute(
                """
                SELECT COALESCE(custom_name, full_name) AS display_name
                FROM members
                WHERE """ + scope_where + """ AND telegram_user_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (*scope_params, int(telegram_user_id)),
            ).fetchone()
        if not row:
            return None
        return str(row["display_name"])

    def add_bot_review(
        self,
        *,
        chat_id: int,
        workspace_id: int | None = None,
        telegram_user_id: int,
        rating: int,
        comment: str | None,
        created_at_utc: datetime | None = None,
    ) -> dict[str, object]:
        rating_int = int(rating)
        if rating_int < 1 or rating_int > 5:
            raise ValueError(f"Unsupported bot review rating: {rating}")

        comment_value = None
        if isinstance(comment, str):
            normalized = comment.strip()
            if normalized:
                comment_value = normalized

        created_at = _to_ts(created_at_utc or datetime.utcnow())
        with self._connect() as conn:
            resolved_workspace_id = self._scoped_workspace_id_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            cursor = conn.execute(
                """
                INSERT INTO bot_reviews (
                    workspace_id,
                    chat_id,
                    telegram_user_id,
                    rating,
                    comment,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_workspace_id,
                    int(chat_id),
                    int(telegram_user_id),
                    rating_int,
                    comment_value,
                    created_at,
                ),
            )
            review_id = int(cursor.lastrowid)

        return {
            "id": review_id,
            "workspace_id": resolved_workspace_id,
            "chat_id": int(chat_id),
            "telegram_user_id": int(telegram_user_id),
            "rating": rating_int,
            "comment": comment_value,
            "created_at": created_at,
        }

    def get_latest_bot_review(
        self,
        telegram_user_id: int,
        *,
        workspace_id: int | None = None,
    ) -> dict[str, object] | None:
        with self._connect() as conn:
            if workspace_id is not None and int(workspace_id) > 0:
                row = conn.execute(
                    """
                    SELECT id, workspace_id, chat_id, telegram_user_id, rating, comment, created_at
                    FROM bot_reviews
                    WHERE telegram_user_id = ? AND workspace_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (int(telegram_user_id), int(workspace_id)),
                ).fetchone()
            else:
                row = conn.execute(
                    """
                    SELECT id, workspace_id, chat_id, telegram_user_id, rating, comment, created_at
                    FROM bot_reviews
                    WHERE telegram_user_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (int(telegram_user_id),),
                ).fetchone()
        if not row:
            return None
        return {
            "id": int(row["id"]),
            "workspace_id": None if row["workspace_id"] is None else int(row["workspace_id"]),
            "chat_id": int(row["chat_id"]),
            "telegram_user_id": int(row["telegram_user_id"]),
            "rating": int(row["rating"]),
            "comment": row["comment"],
            "created_at": str(row["created_at"] or ""),
        }

    def cleanup_api_idempotency_keys(self, *, now_utc: datetime | None = None) -> int:
        now = _to_ts(now_utc or datetime.utcnow())
        with self._connect() as conn:
            cursor = conn.execute(
                """
                DELETE FROM api_idempotency_keys
                WHERE expires_at <= ?
                """,
                (now,),
            )
            return int(cursor.rowcount or 0)

    def get_api_idempotency_key(self, idempotency_key: str) -> dict[str, object] | None:
        key = str(idempotency_key or "").strip()
        if not key:
            return None
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    idempotency_key,
                    endpoint,
                    user_id,
                    request_hash,
                    response_code,
                    response_body,
                    created_at,
                    expires_at
                FROM api_idempotency_keys
                WHERE idempotency_key = ?
                """,
                (key,),
            ).fetchone()
        if not row:
            return None
        return {
            "idempotency_key": str(row["idempotency_key"]),
            "endpoint": str(row["endpoint"]),
            "user_id": int(row["user_id"]),
            "request_hash": str(row["request_hash"]),
            "response_code": None if row["response_code"] is None else int(row["response_code"]),
            "response_body": row["response_body"],
            "created_at": str(row["created_at"] or ""),
            "expires_at": str(row["expires_at"] or ""),
        }

    def reserve_api_idempotency_key(
        self,
        *,
        idempotency_key: str,
        endpoint: str,
        user_id: int,
        request_hash: str,
        ttl_hours: int = 24,
        now_utc: datetime | None = None,
    ) -> tuple[bool, dict[str, object]]:
        key = str(idempotency_key or "").strip()
        now_dt = now_utc or datetime.utcnow()
        created_at = _to_ts(now_dt)
        expires_at = _to_ts(now_dt + timedelta(hours=max(1, int(ttl_hours))))

        with self._connect() as conn:
            conn.execute(
                """
                DELETE FROM api_idempotency_keys
                WHERE expires_at <= ?
                """,
                (created_at,),
            )
            try:
                conn.execute(
                    """
                    INSERT INTO api_idempotency_keys (
                        idempotency_key,
                        endpoint,
                        user_id,
                        request_hash,
                        response_code,
                        response_body,
                        created_at,
                        expires_at
                    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
                    """,
                    (
                        key,
                        str(endpoint),
                        int(user_id),
                        str(request_hash),
                        created_at,
                        expires_at,
                    ),
                )
            except sqlite3.IntegrityError:
                row = conn.execute(
                    """
                    SELECT
                        idempotency_key,
                        endpoint,
                        user_id,
                        request_hash,
                        response_code,
                        response_body,
                        created_at,
                        expires_at
                    FROM api_idempotency_keys
                    WHERE idempotency_key = ?
                    """,
                    (key,),
                ).fetchone()
                if not row:
                    raise
                return (
                    False,
                    {
                        "idempotency_key": str(row["idempotency_key"]),
                        "endpoint": str(row["endpoint"]),
                        "user_id": int(row["user_id"]),
                        "request_hash": str(row["request_hash"]),
                        "response_code": None if row["response_code"] is None else int(row["response_code"]),
                        "response_body": row["response_body"],
                        "created_at": str(row["created_at"] or ""),
                        "expires_at": str(row["expires_at"] or ""),
                    },
                )

        return (
            True,
            {
                "idempotency_key": key,
                "endpoint": str(endpoint),
                "user_id": int(user_id),
                "request_hash": str(request_hash),
                "response_code": None,
                "response_body": None,
                "created_at": created_at,
                "expires_at": expires_at,
            },
        )

    def finalize_api_idempotency_key(
        self,
        *,
        idempotency_key: str,
        response_code: int,
        response_body: str,
    ) -> bool:
        key = str(idempotency_key or "").strip()
        if not key:
            return False
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE api_idempotency_keys
                SET response_code = ?, response_body = ?
                WHERE idempotency_key = ?
                """,
                (int(response_code), str(response_body), key),
            )
            return cursor.rowcount > 0

    def get_bot_review_rating_stats(self) -> dict[str, object]:
        with self._connect() as conn:
            total_row = conn.execute(
                "SELECT COUNT(*) AS total_reviews FROM bot_reviews"
            ).fetchone()
            current_row = conn.execute(
                """
                SELECT
                    COUNT(*) AS rated_users,
                    AVG(br.rating) AS avg_rating
                FROM bot_reviews br
                INNER JOIN (
                    SELECT telegram_user_id, MAX(id) AS latest_id
                    FROM bot_reviews
                    GROUP BY telegram_user_id
                ) latest
                    ON latest.latest_id = br.id
                """
            ).fetchone()
            change_rows = conn.execute(
                """
                SELECT telegram_user_id, rating
                FROM bot_reviews
                ORDER BY telegram_user_id ASC, id ASC
                """
            ).fetchall()

        total_reviews = int(total_row["total_reviews"] if total_row else 0)
        rated_users = int(current_row["rated_users"] if current_row and current_row["rated_users"] is not None else 0)
        avg_rating = (
            float(current_row["avg_rating"])
            if current_row and current_row["avg_rating"] is not None
            else None
        )
        prev_by_user: dict[int, int] = {}
        upgraded_users: set[int] = set()
        downgraded_users: set[int] = set()
        for row in change_rows:
            user_id = int(row["telegram_user_id"])
            rating = int(row["rating"])
            prev_rating = prev_by_user.get(user_id)
            if prev_rating is not None and prev_rating != rating:
                prev_is_low = prev_rating <= 3
                prev_is_high = prev_rating >= 4
                new_is_low = rating <= 3
                new_is_high = rating >= 4
                if prev_is_low and new_is_high:
                    upgraded_users.add(user_id)
                elif prev_is_high and new_is_low:
                    downgraded_users.add(user_id)
            prev_by_user[user_id] = rating
        return {
            "total_reviews": total_reviews,
            "rated_users": rated_users,
            "avg_current_rating": avg_rating,
            "changed_low_to_high_users": len(upgraded_users),
            "changed_high_to_low_users": len(downgraded_users),
        }

    def list_members(
        self,
        chat_id: int,
        *,
        workspace_id: int | None = None,
    ) -> list[dict[str, object]]:
        with self._connect() as conn:
            scope_where, scope_params, resolved_workspace_id = self._member_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            rows = conn.execute(
                """
                SELECT telegram_user_id, username, full_name, custom_name, updated_at, workspace_id, chat_id
                FROM members
                WHERE """ + scope_where + """
                ORDER BY updated_at DESC
                """,
                tuple(scope_params),
            ).fetchall()

        deduped: dict[int, dict[str, object]] = {}
        for row in rows:
            user_id = int(row["telegram_user_id"])
            if user_id in deduped:
                continue
            deduped[user_id] = {
                "telegram_user_id": user_id,
                "username": row["username"],
                "full_name": row["full_name"],
                "custom_name": row["custom_name"],
                "workspace_id": (
                    int(row["workspace_id"]) if row["workspace_id"] is not None else resolved_workspace_id
                ),
                "chat_id": int(row["chat_id"]),
            }

        result = list(deduped.values())
        result.sort(
            key=lambda item: str(item.get("custom_name") or item.get("full_name") or "").lower()
        )
        return result

    def add_transaction(self, tx: FinanceTransaction) -> int:
        return self.add_transaction_at(tx, created_at_utc=None)

    def add_transaction_at(
        self,
        tx: FinanceTransaction,
        *,
        created_at_utc: datetime | None = None,
    ) -> int:
        created_at = created_at_utc or datetime.utcnow()
        with self._connect() as conn:
            resolved_workspace_id = self._scoped_workspace_id_conn(
                conn,
                chat_id=tx.chat_id,
                workspace_id=tx.workspace_id,
            )
            cursor = conn.execute(
                """
                INSERT INTO transactions (
                    workspace_id,
                    chat_id,
                    telegram_user_id,
                    member_name,
                    kind,
                    amount,
                    currency,
                    category,
                    description,
                    is_family,
                    source_type,
                    original_text,
                    transcript,
                    message_id,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_workspace_id,
                    tx.chat_id,
                    tx.telegram_user_id,
                    tx.member_name,
                    tx.kind,
                    tx.amount,
                    tx.currency,
                    tx.category,
                    tx.description,
                    int(tx.is_family),
                    tx.source_type,
                    tx.original_text,
                    tx.transcript,
                    tx.message_id,
                    _to_ts(created_at),
                ),
            )
            transaction_id = int(cursor.lastrowid)
        if transaction_id:
            self.mark_user_activated(tx.telegram_user_id)
        return transaction_id

    def get_transaction(
        self,
        chat_id: int,
        transaction_id: int,
        *,
        workspace_id: int | None = None,
    ) -> dict[str, object] | None:
        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            row = conn.execute(
                """
                SELECT
                    id,
                    workspace_id,
                    chat_id,
                    telegram_user_id,
                    member_name,
                    kind,
                    amount,
                    currency,
                    category,
                    description,
                    is_family,
                    source_type,
                    original_text,
                    transcript,
                    message_id,
                    created_at
                FROM transactions
                WHERE """ + scope_where + """ AND id = ?
                """,
                (*scope_params, int(transaction_id)),
            ).fetchone()

        if not row:
            return None

        return {
            "id": int(row["id"]),
            "workspace_id": None if row["workspace_id"] is None else int(row["workspace_id"]),
            "chat_id": int(row["chat_id"]),
            "telegram_user_id": int(row["telegram_user_id"]),
            "member_name": str(row["member_name"]),
            "kind": str(row["kind"]),
            "amount": float(row["amount"]),
            "currency": str(row["currency"]),
            "category": str(row["category"]),
            "description": str(row["description"]),
            "is_family": bool(row["is_family"]),
            "source_type": str(row["source_type"]),
            "original_text": str(row["original_text"]),
            "transcript": row["transcript"],
            "message_id": int(row["message_id"]),
            "created_at": str(row["created_at"]),
        }

    def get_transfer_transactions_by_message_id(
        self,
        chat_id: int,
        message_id: int,
        *,
        workspace_id: int | None = None,
    ) -> list[dict[str, object]]:
        if message_id <= 0:
            return []
        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            rows = conn.execute(
                """
                SELECT
                    id,
                    workspace_id,
                    chat_id,
                    telegram_user_id,
                    member_name,
                    kind,
                    amount,
                    currency,
                    category,
                    description,
                    is_family,
                    source_type,
                    original_text,
                    transcript,
                    message_id,
                    created_at
                FROM transactions
                WHERE """ + scope_where + """ AND message_id = ? AND category IN (?, ?)
                ORDER BY id ASC
                """,
                (*scope_params, int(message_id), TRANSFER_OUT_CATEGORY, TRANSFER_IN_CATEGORY),
            ).fetchall()

        result: list[dict[str, object]] = []
        for row in rows:
            result.append(
                {
                    "id": int(row["id"]),
                    "workspace_id": None if row["workspace_id"] is None else int(row["workspace_id"]),
                    "chat_id": int(row["chat_id"]),
                    "telegram_user_id": int(row["telegram_user_id"]),
                    "member_name": str(row["member_name"]),
                    "kind": str(row["kind"]),
                    "amount": float(row["amount"]),
                    "currency": str(row["currency"]),
                    "category": str(row["category"]),
                    "description": str(row["description"]),
                    "is_family": bool(row["is_family"]),
                    "source_type": str(row["source_type"]),
                    "original_text": str(row["original_text"]),
                    "transcript": row["transcript"],
                    "message_id": int(row["message_id"]),
                    "created_at": str(row["created_at"]),
                }
            )
        return result

    def update_transaction(
        self,
        chat_id: int,
        transaction_id: int,
        *,
        workspace_id: int | None = None,
        amount: float,
        description: str,
        category: str,
    ) -> bool:
        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            cursor = conn.execute(
                """
                UPDATE transactions
                SET amount = ?, description = ?, category = ?
                WHERE """ + scope_where + """ AND id = ?
                """,
                (amount, description, category, *scope_params, int(transaction_id)),
            )
            return cursor.rowcount > 0

    def delete_transaction(
        self,
        chat_id: int,
        transaction_id: int,
        *,
        workspace_id: int | None = None,
    ) -> bool:
        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            cursor = conn.execute(
                """
                DELETE FROM transactions
                WHERE """ + scope_where + """ AND id = ?
                """,
                (*scope_params, int(transaction_id)),
            )
            return cursor.rowcount > 0

    def delete_all_transactions(self, chat_id: int) -> int:
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM transactions WHERE chat_id = ?",
                (int(chat_id),),
            )
            return cursor.rowcount

    def get_user_summary(
        self,
        chat_id: int,
        telegram_user_id: int,
        period_start: datetime,
        period_end: datetime,
        *,
        workspace_id: int | None = None,
    ) -> dict[str, object]:
        totals: dict[str, dict[str, float]] = {}
        top_categories: list[tuple[str, str, float]] = []
        transfer_totals: dict[str, dict[str, float]] = {}

        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            rows = conn.execute(
                """
                SELECT currency, kind, SUM(amount) AS total
                FROM transactions
                WHERE
                    """ + scope_where + """
                    AND telegram_user_id = ?
                    AND category NOT IN (?, ?)
                    AND created_at >= ?
                    AND created_at < ?
                GROUP BY currency, kind
                """,
                (
                    *scope_params,
                    telegram_user_id,
                    TRANSFER_OUT_CATEGORY,
                    TRANSFER_IN_CATEGORY,
                    _to_ts(period_start),
                    _to_ts(period_end),
                ),
            ).fetchall()

            for row in rows:
                currency = str(row["currency"])
                kind = str(row["kind"])
                total = float(row["total"] or 0)
                totals.setdefault(currency, {"income": 0.0, "expense": 0.0})
                totals[currency][kind] = total

            category_rows = conn.execute(
                """
                SELECT category, currency, SUM(amount) AS total
                FROM transactions
                WHERE
                    """ + scope_where + """
                    AND telegram_user_id = ?
                    AND kind = 'expense'
                    AND category NOT IN (?, ?)
                    AND created_at >= ?
                    AND created_at < ?
                GROUP BY category, currency
                ORDER BY total DESC
                LIMIT 5
                """,
                (
                    *scope_params,
                    telegram_user_id,
                    TRANSFER_OUT_CATEGORY,
                    TRANSFER_IN_CATEGORY,
                    _to_ts(period_start),
                    _to_ts(period_end),
                ),
            ).fetchall()

            top_categories = [
                (str(row["category"]), str(row["currency"]), float(row["total"] or 0))
                for row in category_rows
            ]

            transfer_rows = conn.execute(
                """
                SELECT currency, category, SUM(amount) AS total
                FROM transactions
                WHERE
                    """ + scope_where + """
                    AND telegram_user_id = ?
                    AND category IN (?, ?)
                    AND created_at >= ?
                    AND created_at < ?
                GROUP BY currency, category
                """,
                (
                    *scope_params,
                    telegram_user_id,
                    TRANSFER_OUT_CATEGORY,
                    TRANSFER_IN_CATEGORY,
                    _to_ts(period_start),
                    _to_ts(period_end),
                ),
            ).fetchall()

            for row in transfer_rows:
                currency = str(row["currency"])
                category = str(row["category"])
                total = float(row["total"] or 0.0)
                bucket = transfer_totals.setdefault(currency, {"sent": 0.0, "received": 0.0})
                if category == TRANSFER_OUT_CATEGORY:
                    bucket["sent"] = total
                elif category == TRANSFER_IN_CATEGORY:
                    bucket["received"] = total

        return {
            "totals": totals,
            "top_expense_categories": top_categories,
            "transfer_totals": transfer_totals,
        }

    def get_group_user_summaries(
        self,
        chat_id: int,
        period_start: datetime,
        period_end: datetime,
        *,
        workspace_id: int | None = None,
    ) -> list[dict[str, object]]:
        by_user: dict[int, dict[str, object]] = {}
        member_names: dict[int, str] = {}
        for member in self.list_members(chat_id, workspace_id=workspace_id):
            user_id = int(member.get("telegram_user_id") or 0)
            if user_id <= 0:
                continue
            display_name = str(
                member.get("custom_name")
                or member.get("full_name")
                or f"User {user_id}"
            )
            member_names[user_id] = display_name

        with self._connect() as conn:
            tx_scope_where, tx_scope_params, resolved_workspace_id = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
                alias="t",
            )
            if resolved_workspace_id is not None:
                member_join_clause = (
                    "m.workspace_id = t.workspace_id AND m.telegram_user_id = t.telegram_user_id"
                )
            else:
                member_join_clause = (
                    "m.chat_id = t.chat_id AND m.telegram_user_id = t.telegram_user_id"
                )
            rows = conn.execute(
                """
                SELECT
                    t.telegram_user_id,
                    COALESCE(m.custom_name, m.full_name, MAX(t.member_name)) AS display_name,
                    t.currency,
                    t.kind,
                    SUM(t.amount) AS total
                FROM transactions t
                LEFT JOIN members m
                    ON """ + member_join_clause + """
                WHERE
                    """ + tx_scope_where + """
                    AND t.category NOT IN (?, ?)
                    AND t.created_at >= ?
                    AND t.created_at < ?
                GROUP BY t.telegram_user_id, t.currency, t.kind
                """,
                (
                    *tx_scope_params,
                    TRANSFER_OUT_CATEGORY,
                    TRANSFER_IN_CATEGORY,
                    _to_ts(period_start),
                    _to_ts(period_end),
                ),
            ).fetchall()

            transfer_rows = conn.execute(
                """
                SELECT
                    telegram_user_id,
                    currency,
                    category,
                    SUM(amount) AS total
                FROM transactions
                WHERE
                    """ + tx_scope_where.replace("t.", "") + """
                    AND category IN (?, ?)
                    AND created_at >= ?
                    AND created_at < ?
                GROUP BY telegram_user_id, currency, category
                """,
                (
                    *[p for p in tx_scope_params],
                    TRANSFER_OUT_CATEGORY,
                    TRANSFER_IN_CATEGORY,
                    _to_ts(period_start),
                    _to_ts(period_end),
                ),
            ).fetchall()

        for row in rows:
            user_id = int(row["telegram_user_id"])
            name = str(row["display_name"] or member_names.get(user_id) or f"User {user_id}")
            currency = str(row["currency"])
            kind = str(row["kind"])
            total = float(row["total"] or 0)

            bucket = by_user.setdefault(
                user_id,
                {
                    "telegram_user_id": user_id,
                    "name": name,
                    "totals": {},
                    "transfer_totals": {},
                },
            )
            totals = bucket["totals"]
            if isinstance(totals, dict):
                totals.setdefault(currency, {"income": 0.0, "expense": 0.0})
                totals[currency][kind] = total

        for row in transfer_rows:
            user_id = int(row["telegram_user_id"])
            currency = str(row["currency"])
            category = str(row["category"])
            total = float(row["total"] or 0.0)

            bucket = by_user.setdefault(
                user_id,
                {
                    "telegram_user_id": user_id,
                    "name": member_names.get(user_id, f"User {user_id}"),
                    "totals": {},
                    "transfer_totals": {},
                },
            )
            transfer_bucket = bucket.get("transfer_totals")
            if not isinstance(transfer_bucket, dict):
                transfer_bucket = {}
                bucket["transfer_totals"] = transfer_bucket
            per_currency = transfer_bucket.setdefault(currency, {"sent": 0.0, "received": 0.0})
            if category == TRANSFER_OUT_CATEGORY:
                per_currency["sent"] = total
            elif category == TRANSFER_IN_CATEGORY:
                per_currency["received"] = total

        result = list(by_user.values())
        result.sort(key=lambda item: str(item.get("name", "")).lower())
        return result

    def get_family_expense_summary(
        self,
        chat_id: int,
        period_start: datetime,
        period_end: datetime,
        *,
        workspace_id: int | None = None,
    ) -> dict[str, object]:
        totals: dict[str, float] = {}
        top_categories: list[tuple[str, str, float]] = []

        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            rows = conn.execute(
                """
                SELECT currency, SUM(amount) AS total
                FROM transactions
                WHERE
                    """ + scope_where + """
                    AND is_family = 1
                    AND kind = 'expense'
                    AND created_at >= ?
                    AND created_at < ?
                GROUP BY currency
                """,
                (*scope_params, _to_ts(period_start), _to_ts(period_end)),
            ).fetchall()

            for row in rows:
                totals[str(row["currency"])] = float(row["total"] or 0)

            category_rows = conn.execute(
                """
                SELECT category, currency, SUM(amount) AS total
                FROM transactions
                WHERE
                    """ + scope_where + """
                    AND is_family = 1
                    AND kind = 'expense'
                    AND created_at >= ?
                    AND created_at < ?
                GROUP BY category, currency
                ORDER BY total DESC
                LIMIT 5
                """,
                (*scope_params, _to_ts(period_start), _to_ts(period_end)),
            ).fetchall()

            top_categories = [
                (str(row["category"]), str(row["currency"]), float(row["total"] or 0))
                for row in category_rows
            ]

        return {"totals": totals, "top_categories": top_categories}

    def get_period_category_breakdown(
        self,
        chat_id: int,
        period_start: datetime,
        period_end: datetime,
        *,
        workspace_id: int | None = None,
        telegram_user_id: int | None = None,
        is_family: bool | None = None,
    ) -> dict[str, dict[str, dict[str, object]]]:
        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            conditions = [
                scope_where,
                "created_at >= ?",
                "created_at < ?",
            ]
            params: list[object] = [*scope_params, _to_ts(period_start), _to_ts(period_end)]
            if telegram_user_id is not None:
                conditions.append("telegram_user_id = ?")
                params.append(telegram_user_id)
            if is_family is not None:
                conditions.append("is_family = ?")
                params.append(1 if is_family else 0)

            where_clause = " AND ".join(conditions)
            query = f"""
                SELECT
                    kind,
                    currency,
                    category,
                    SUM(amount) AS total
                FROM transactions
                WHERE {where_clause}
                GROUP BY kind, currency, category
            """
            rows = conn.execute(query, tuple(params)).fetchall()

        result: dict[str, dict[str, dict[str, object]]] = {"expense": {}, "income": {}}
        for row in rows:
            kind = str(row["kind"])
            currency = str(row["currency"])
            category = str(row["category"])
            total = float(row["total"] or 0.0)

            by_kind = result.setdefault(kind, {})
            by_currency = by_kind.setdefault(currency, {"total": 0.0, "categories": []})
            by_currency["total"] = float(by_currency.get("total", 0.0)) + total
            categories = by_currency.get("categories")
            if isinstance(categories, list):
                categories.append((category, total))

        for by_kind in result.values():
            for by_currency in by_kind.values():
                categories = by_currency.get("categories")
                if isinstance(categories, list):
                    categories.sort(key=lambda item: float(item[1]), reverse=True)

        return result

    def get_period_transactions(
        self,
        chat_id: int,
        period_start: datetime,
        period_end: datetime,
        *,
        workspace_id: int | None = None,
        telegram_user_id: int | None = None,
        is_family: bool | None = None,
    ) -> list[dict[str, object]]:
        with self._connect() as conn:
            scope_where, scope_params, _ = self._tx_scope_where_conn(
                conn,
                chat_id=chat_id,
                workspace_id=workspace_id,
            )
            conditions = [
                scope_where,
                "created_at >= ?",
                "created_at < ?",
            ]
            params: list[object] = [*scope_params, _to_ts(period_start), _to_ts(period_end)]
            if telegram_user_id is not None:
                conditions.append("telegram_user_id = ?")
                params.append(telegram_user_id)
            if is_family is not None:
                conditions.append("is_family = ?")
                params.append(1 if is_family else 0)

            where_clause = " AND ".join(conditions)
            query = f"""
                SELECT
                    id,
                    workspace_id,
                    kind,
                    amount,
                    currency,
                    category,
                    description,
                    created_at
                FROM transactions
                WHERE {where_clause}
                ORDER BY
                    CASE WHEN kind = 'expense' THEN 0 ELSE 1 END,
                    currency ASC,
                    category ASC,
                    created_at ASC,
                    id ASC
            """
            rows = conn.execute(query, tuple(params)).fetchall()

        return [
            {
                "id": int(row["id"]),
                "workspace_id": None if row["workspace_id"] is None else int(row["workspace_id"]),
                "kind": str(row["kind"]),
                "amount": float(row["amount"] or 0.0),
                "currency": str(row["currency"]),
                "category": str(row["category"]),
                "description": str(row["description"]),
                "created_at": str(row["created_at"]),
            }
            for row in rows
        ]

    @staticmethod
    def _normalize_report_type(report_type: str) -> str:
        normalized = str(report_type or "").strip().lower()
        if normalized not in SCHEDULED_REPORT_TYPES:
            raise ValueError(f"Unsupported report type: {report_type}")
        return normalized

    @staticmethod
    def _report_schedule_defaults(report_type: str) -> dict[str, object]:
        normalized = str(report_type or "").strip().lower()
        if normalized == "weekly":
            return {
                "enabled": True,
                "timezone": DEFAULT_REPORT_TIMEZONE,
                "send_hour": DEFAULT_WEEKLY_REPORT_HOUR,
                "send_minute": DEFAULT_WEEKLY_REPORT_MINUTE,
                "weekday": DEFAULT_WEEKLY_REPORT_WEEKDAY,
                "monthday": None,
            }
        if normalized == "monthly":
            return {
                "enabled": True,
                "timezone": DEFAULT_REPORT_TIMEZONE,
                "send_hour": DEFAULT_MONTHLY_REPORT_HOUR,
                "send_minute": DEFAULT_MONTHLY_REPORT_MINUTE,
                "weekday": None,
                "monthday": DEFAULT_MONTHLY_REPORT_MONTHDAY,
            }
        return {
            "enabled": True,
            "timezone": DEFAULT_REPORT_TIMEZONE,
            "send_hour": DEFAULT_DAILY_REPORT_HOUR,
            "send_minute": DEFAULT_DAILY_REPORT_MINUTE,
            "weekday": None,
            "monthday": None,
        }

    def _default_workspace_report_schedule(
        self,
        *,
        workspace_id: int,
        report_type: str,
    ) -> dict[str, object]:
        normalized_type = self._normalize_report_type(report_type)
        defaults = self._report_schedule_defaults(normalized_type)
        return {
            "workspace_id": int(workspace_id),
            "report_type": normalized_type,
            "enabled": bool(defaults.get("enabled", True)),
            "timezone": str(defaults.get("timezone") or DEFAULT_REPORT_TIMEZONE),
            "send_hour": int(defaults.get("send_hour") or DEFAULT_DAILY_REPORT_HOUR),
            "send_minute": int(defaults.get("send_minute") or DEFAULT_DAILY_REPORT_MINUTE),
            "weekday": defaults.get("weekday"),
            "monthday": defaults.get("monthday"),
        }

    def get_workspace_report_schedule(
        self,
        *,
        workspace_id: int,
        report_type: str = "daily",
        ensure_default: bool = True,
    ) -> dict[str, object]:
        normalized_type = self._normalize_report_type(report_type)
        target_workspace_id = int(workspace_id)
        defaults = self._report_schedule_defaults(normalized_type)
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    workspace_id,
                    report_type,
                    enabled,
                    timezone,
                    send_hour,
                    send_minute,
                    weekday,
                    monthday
                FROM workspace_report_schedules
                WHERE workspace_id = ? AND report_type = ?
                LIMIT 1
                """,
                (target_workspace_id, normalized_type),
            ).fetchone()
            if row is None and ensure_default:
                now = _to_ts(datetime.utcnow())
                conn.execute(
                    """
                    INSERT OR IGNORE INTO workspace_report_schedules (
                        workspace_id,
                        report_type,
                        enabled,
                        timezone,
                        send_hour,
                        send_minute,
                        weekday,
                        monthday,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, 1, ?, ?, ?, NULL, NULL, ?, ?)
                    """,
                    (
                        target_workspace_id,
                        normalized_type,
                        str(defaults.get("timezone") or DEFAULT_REPORT_TIMEZONE),
                        int(defaults.get("send_hour") or DEFAULT_DAILY_REPORT_HOUR),
                        int(defaults.get("send_minute") or DEFAULT_DAILY_REPORT_MINUTE),
                        now,
                        now,
                    ),
                )
                if defaults.get("weekday") is not None:
                    conn.execute(
                        """
                        UPDATE workspace_report_schedules
                        SET weekday = ?, updated_at = ?
                        WHERE workspace_id = ? AND report_type = ?
                        """,
                        (
                            int(defaults["weekday"]),
                            now,
                            target_workspace_id,
                            normalized_type,
                        ),
                    )
                if defaults.get("monthday") is not None:
                    conn.execute(
                        """
                        UPDATE workspace_report_schedules
                        SET monthday = ?, updated_at = ?
                        WHERE workspace_id = ? AND report_type = ?
                        """,
                        (
                            int(defaults["monthday"]),
                            now,
                            target_workspace_id,
                            normalized_type,
                        ),
                    )
                row = conn.execute(
                    """
                    SELECT
                        workspace_id,
                        report_type,
                        enabled,
                        timezone,
                        send_hour,
                        send_minute,
                        weekday,
                        monthday
                    FROM workspace_report_schedules
                    WHERE workspace_id = ? AND report_type = ?
                    LIMIT 1
                    """,
                    (target_workspace_id, normalized_type),
                ).fetchone()

        if row is None:
            return self._default_workspace_report_schedule(
                workspace_id=target_workspace_id,
                report_type=normalized_type,
            )

        return {
            "workspace_id": int(row["workspace_id"]),
            "report_type": str(row["report_type"]),
            "enabled": bool(int(row["enabled"])) if row["enabled"] is not None else bool(defaults.get("enabled", True)),
            "timezone": str(row["timezone"] or defaults.get("timezone") or DEFAULT_REPORT_TIMEZONE),
            "send_hour": (
                int(row["send_hour"])
                if row["send_hour"] is not None
                else int(defaults.get("send_hour") or DEFAULT_DAILY_REPORT_HOUR)
            ),
            "send_minute": (
                int(row["send_minute"])
                if row["send_minute"] is not None
                else int(defaults.get("send_minute") or DEFAULT_DAILY_REPORT_MINUTE)
            ),
            "weekday": (
                int(row["weekday"])
                if row["weekday"] is not None
                else (None if defaults.get("weekday") is None else int(defaults["weekday"]))
            ),
            "monthday": (
                int(row["monthday"])
                if row["monthday"] is not None
                else (None if defaults.get("monthday") is None else int(defaults["monthday"]))
            ),
        }

    def upsert_workspace_report_schedule(
        self,
        *,
        workspace_id: int,
        report_type: str = "daily",
        enabled: bool = True,
        timezone: str = DEFAULT_REPORT_TIMEZONE,
        send_hour: int = DEFAULT_DAILY_REPORT_HOUR,
        send_minute: int = DEFAULT_DAILY_REPORT_MINUTE,
        weekday: int | None = None,
        monthday: int | None = None,
    ) -> dict[str, object]:
        normalized_type = self._normalize_report_type(report_type)
        tz_name = str(timezone or DEFAULT_REPORT_TIMEZONE).strip() or DEFAULT_REPORT_TIMEZONE
        hour = max(0, min(23, int(send_hour)))
        minute = max(0, min(59, int(send_minute)))
        weekday_value = None if weekday is None else max(0, min(6, int(weekday)))
        monthday_value = None if monthday is None else max(1, min(31, int(monthday)))
        now = _to_ts(datetime.utcnow())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO workspace_report_schedules (
                    workspace_id,
                    report_type,
                    enabled,
                    timezone,
                    send_hour,
                    send_minute,
                    weekday,
                    monthday,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(workspace_id, report_type)
                DO UPDATE SET
                    enabled = excluded.enabled,
                    timezone = excluded.timezone,
                    send_hour = excluded.send_hour,
                    send_minute = excluded.send_minute,
                    weekday = excluded.weekday,
                    monthday = excluded.monthday,
                    updated_at = excluded.updated_at
                """,
                (
                    int(workspace_id),
                    normalized_type,
                    1 if enabled else 0,
                    tz_name,
                    hour,
                    minute,
                    weekday_value,
                    monthday_value,
                    now,
                    now,
                ),
            )
        return self.get_workspace_report_schedule(
            workspace_id=int(workspace_id),
            report_type=normalized_type,
            ensure_default=False,
        )

    def list_scheduled_report_targets(
        self,
        *,
        report_type: str = "daily",
    ) -> list[dict[str, object]]:
        normalized_type = self._normalize_report_type(report_type)
        defaults = self._report_schedule_defaults(normalized_type)
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    w.id AS workspace_id,
                    w.type AS workspace_type,
                    w.title AS workspace_title,
                    w.created_by AS created_by,
                    wb.telegram_chat_id AS chat_id,
                    (
                        SELECT wm.telegram_user_id
                        FROM workspace_members wm
                        WHERE wm.workspace_id = w.id AND wm.role = 'owner'
                        ORDER BY wm.id ASC
                        LIMIT 1
                    ) AS owner_user_id,
                    s.enabled AS enabled,
                    s.timezone AS timezone,
                    s.send_hour AS send_hour,
                    s.send_minute AS send_minute,
                    s.weekday AS weekday,
                    s.monthday AS monthday
                FROM workspaces w
                JOIN (
                    SELECT workspace_id, MAX(id) AS latest_binding_id
                    FROM workspace_bindings
                    GROUP BY workspace_id
                ) latest ON latest.workspace_id = w.id
                JOIN workspace_bindings wb ON wb.id = latest.latest_binding_id
                LEFT JOIN workspace_report_schedules s
                    ON s.workspace_id = w.id AND s.report_type = ?
                WHERE w.type IN ('personal', 'family')
                ORDER BY w.id ASC
                """,
                (normalized_type,),
            ).fetchall()

        result: list[dict[str, object]] = []
        for row in rows:
            result.append(
                {
                    "workspace_id": int(row["workspace_id"]),
                    "workspace_type": str(row["workspace_type"] or ""),
                    "workspace_title": row["workspace_title"],
                    "chat_id": int(row["chat_id"]),
                    "created_by": None if row["created_by"] is None else int(row["created_by"]),
                    "owner_user_id": None if row["owner_user_id"] is None else int(row["owner_user_id"]),
                    "report_type": normalized_type,
                    "enabled": bool(int(row["enabled"])) if row["enabled"] is not None else bool(defaults.get("enabled", True)),
                    "timezone": str(row["timezone"] or defaults.get("timezone") or DEFAULT_REPORT_TIMEZONE),
                    "send_hour": (
                        int(row["send_hour"])
                        if row["send_hour"] is not None
                        else int(defaults.get("send_hour") or DEFAULT_DAILY_REPORT_HOUR)
                    ),
                    "send_minute": (
                        int(row["send_minute"])
                        if row["send_minute"] is not None
                        else int(defaults.get("send_minute") or DEFAULT_DAILY_REPORT_MINUTE)
                    ),
                    "weekday": (
                        int(row["weekday"])
                        if row["weekday"] is not None
                        else (None if defaults.get("weekday") is None else int(defaults["weekday"]))
                    ),
                    "monthday": (
                        int(row["monthday"])
                        if row["monthday"] is not None
                        else (None if defaults.get("monthday") is None else int(defaults["monthday"]))
                    ),
                }
            )
        return result

    def has_scheduled_report_delivery(
        self,
        *,
        workspace_id: int,
        report_type: str,
        period_key: str,
    ) -> bool:
        normalized_type = self._normalize_report_type(report_type)
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1
                FROM workspace_report_deliveries
                WHERE workspace_id = ? AND report_type = ? AND period_key = ?
                LIMIT 1
                """,
                (int(workspace_id), normalized_type, str(period_key or "")),
            ).fetchone()
        return row is not None

    def record_scheduled_report_delivery(
        self,
        *,
        workspace_id: int,
        chat_id: int,
        report_type: str,
        period_key: str,
        sent_at_utc: datetime | None = None,
    ) -> bool:
        normalized_type = self._normalize_report_type(report_type)
        target_period_key = str(period_key or "").strip()
        if not target_period_key:
            raise ValueError("period_key is required")
        sent_at = _to_ts(sent_at_utc or datetime.utcnow())
        with self._connect() as conn:
            try:
                conn.execute(
                    """
                    INSERT INTO workspace_report_deliveries (
                        workspace_id,
                        report_type,
                        period_key,
                        chat_id,
                        sent_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        int(workspace_id),
                        normalized_type,
                        target_period_key,
                        int(chat_id),
                        sent_at,
                    ),
                )
            except sqlite3.IntegrityError:
                return False
        return True
