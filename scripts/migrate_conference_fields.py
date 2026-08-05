#!/usr/bin/env python3
"""
One-time migration: legacy conference fields -> current schema.

  group_id     -> conference_group
  part_number  -> conference_part

Does not overwrite existing conference_group / conference_part values.
Removes old fields only after a successful per-document update.

Usage:
  # Preview (no writes)
  python scripts/migrate_conference_fields.py --dry-run

  # Apply
  python scripts/migrate_conference_fields.py

Environment:
  MONGO_URL  (default: mongodb://localhost:27017)
"""

from __future__ import annotations

import argparse
import os
import sys

from pymongo import MongoClient


def migrate(dry_run: bool = False) -> int:
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    client = MongoClient(mongo_url)
    collection = client.unime_video_catalog.videos

    query = {
        "$or": [
            {"group_id": {"$exists": True}},
            {"part_number": {"$exists": True}},
        ]
    }

    total_with_legacy = collection.count_documents(query)
    scanned = 0
    migrated = 0
    skipped_group_present = 0
    skipped_part_present = 0
    cleared_only = 0
    unchanged = 0

    print(f"MongoDB: {mongo_url}")
    print(f"Mode: {'DRY-RUN' if dry_run else 'APPLY'}")
    print(f"Documents with legacy fields: {total_with_legacy}")
    print("-" * 48)

    for doc in collection.find(query):
        scanned += 1
        doc_id = doc["_id"]
        set_fields: dict = {}
        unset_fields: dict = {}

        has_group_id = "group_id" in doc
        has_part_number = "part_number" in doc

        if has_group_id:
            existing_group = doc.get("conference_group")
            existing_empty = existing_group is None or (
                isinstance(existing_group, str) and not existing_group.strip()
            )
            if existing_empty:
                legacy_group = doc.get("group_id")
                if isinstance(legacy_group, str):
                    legacy_group = legacy_group.strip() or None
                if legacy_group is not None:
                    set_fields["conference_group"] = legacy_group
            else:
                skipped_group_present += 1
            unset_fields["group_id"] = ""

        if has_part_number:
            existing_part = doc.get("conference_part")
            if existing_part is None:
                legacy_part = doc.get("part_number")
                if legacy_part is not None:
                    try:
                        set_fields["conference_part"] = int(legacy_part)
                    except (TypeError, ValueError):
                        print(f"  ! skip invalid part_number on {_id_str(doc_id)}: {legacy_part!r}")
            else:
                skipped_part_present += 1
            unset_fields["part_number"] = ""

        if not set_fields and not unset_fields:
            unchanged += 1
            continue

        if set_fields:
            migrated += 1
        elif unset_fields:
            cleared_only += 1

        action = "would update" if dry_run else "updated"
        print(
            f"  {action} {_id_str(doc_id)} "
            f"set={list(set_fields.keys()) or '-'} "
            f"unset={list(unset_fields.keys()) or '-'}"
        )

        if dry_run:
            continue

        update_doc: dict = {}
        if set_fields:
            update_doc["$set"] = set_fields
        if unset_fields:
            update_doc["$unset"] = unset_fields
        if update_doc:
            collection.update_one({"_id": doc_id}, update_doc)

    print("-" * 48)
    print("Statistics:")
    print(f"  scanned:                 {scanned}")
    print(f"  migrated (copied values): {migrated}")
    print(f"  cleared legacy only:      {cleared_only}")
    print(f"  skipped group (kept new): {skipped_group_present}")
    print(f"  skipped part (kept new):  {skipped_part_present}")
    print(f"  unchanged:                {unchanged}")
    if dry_run:
        print("\nDry-run complete. Re-run without --dry-run to apply.")
    else:
        print("\nMigration complete.")

    client.close()
    return 0


def _id_str(doc_id) -> str:
    return str(doc_id)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate group_id/part_number to conference_group/conference_part"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned changes without writing to MongoDB",
    )
    args = parser.parse_args()
    try:
        return migrate(dry_run=args.dry_run)
    except Exception as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
