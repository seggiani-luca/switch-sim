import json
from pathlib import Path

lib = Path(".")

files = sorted(
    p.name for p in lib.glob("*.json")
    if p.name != "index.json"
)

(lib / "index.json").write_text(json.dumps(files, indent=2) + "\n")
