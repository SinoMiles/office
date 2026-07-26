#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

source = Path("/root/prompt-connection.js").read_text(encoding="utf-8")
match = re.search(r"mongodb://[^'\"\s]+", source)
if not match:
    raise RuntimeError("PromptHub MongoDB URI was not found")

remote_uri = match.group(0)
archive = "/root/prompts-migration.archive.gz"
local_uri = "mongodb://127.0.0.1:27017/prompts"

subprocess.run(
    ["mongodump", f"--uri={remote_uri}", f"--archive={archive}", "--gzip"],
    check=True,
)
subprocess.run(
    [
        "mongorestore",
        f"--uri={local_uri}",
        f"--archive={archive}",
        "--gzip",
        "--drop",
        "--stopOnError",
    ],
    check=True,
)

print("PROMPT_DATABASE_MIGRATION_COMPLETE")
