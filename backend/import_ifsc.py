"""Load the Razorpay IFSC dataset (https://github.com/razorpay/ifsc/releases)
into the local ifsc_codes table.

Usage:
    python import_ifsc.py                                # download latest release, import
    python import_ifsc.py --file IFSC.csv --version v2.0.60   # import a local dump

Requires the DB migrations to be applied first (python migrate.py upgrade).
Re-running replaces the previous dataset atomically.
"""
import argparse
import os
import sys

from database import SessionLocal
from services.ifsc_service import download_dataset, import_dataset, resolve_latest_release


def main() -> int:
    parser = argparse.ArgumentParser(description="Import the Razorpay IFSC dataset")
    parser.add_argument("--file", help="Path to a local IFSC.csv (skips download)")
    parser.add_argument("--version", help="Dataset version tag (required with --file)")
    args = parser.parse_args()

    if args.file:
        if not args.version:
            parser.error("--version is required when using --file")
        csv_path, version, cleanup = args.file, args.version, False
    else:
        print("Resolving latest release of razorpay/ifsc...")
        version, url = resolve_latest_release()
        print(f"Downloading IFSC.csv from {version} (~36 MB)...")
        csv_path, cleanup = download_dataset(url), True

    db = SessionLocal()
    try:
        print(f"Importing {csv_path} as {version}...")
        result = import_dataset(db, csv_path, version)
        print(f"Done: {result['rows']} branches imported "
              f"({result['skipped']} rows skipped), dataset {result['version']}.")
        return 0
    finally:
        db.close()
        if cleanup:
            try:
                os.unlink(csv_path)
            except OSError:
                pass


if __name__ == "__main__":
    sys.exit(main())
