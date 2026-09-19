"""Upload rendered receipt images to object storage (MinIO in docker-compose).

    python scripts/upload_receipts.py seed42

Reads data/<run-id>/receipts/*.jpg and stores each under receipts/<sha256>.jpg, the storageKey the
loader wrote. Run it after `docker compose up` so the admin documents view has images to show.
"""

from __future__ import annotations

import sys
from pathlib import Path

import boto3
from botocore.client import Config

from app.config import settings


def main(run_id: str, data_dir: str = "data") -> int:
    folder = Path(data_dir) / run_id / "receipts"
    files = sorted(folder.glob("*.jpg"))
    if not files:
        print(f"no images in {folder}. Generate with --receipts render first.")
        return 1
    s3 = boto3.client(
        "s3", endpoint_url=settings.s3_endpoint, region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key, aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    for i, f in enumerate(files, 1):
        s3.upload_file(str(f), settings.s3_bucket, f"receipts/{f.name}", ExtraArgs={"ContentType": "image/jpeg"})
        if i % 500 == 0:
            print(f"uploaded {i}/{len(files)}")
    print(f"uploaded {len(files)} images to {settings.s3_endpoint}/{settings.s3_bucket}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
