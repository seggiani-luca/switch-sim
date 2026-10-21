import json
from pathlib import Path

lib = Path(".")
found = {}

for p in sorted(lib.rglob("*.json")):
    if p.name == "index.json":
        continue

    rp = p.relative_to(lib)

    category = p.parent.relative_to(lib)
    key = str(category) if category != Path(".") else "root"

    found.setdefault(key, []).append(str(rp))

categs = []
for key, val in found.items():
    categ = {}

    categ["name"] = key
    categ["components"] = val

    categs.append(categ)

(lib / "index.json").write_text(json.dumps(categs, indent=2) + "\n")
