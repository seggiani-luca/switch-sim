import json
from pathlib import Path

lib = Path(".")
found = []

for path in lib.iterdir():
    if not path.is_dir():
        continue

    rp = path.relative_to(lib)

    name = path.name
    circ = next(path.glob("*.json"), None)
    doc = next(path.glob("*.md"), None)
    img = next(path.glob("*.png"), None)

    if circ is None or doc is None:
        continue

    example = {
        "name": name,
        "circuit": str(circ.relative_to(lib)),
        "readme": str(doc.relative_to(lib)),
        "image": str(img.relative_to(lib))
    }
    found.append(example)

(lib / "index.json").write_text(json.dumps(found, indent=2) + "\n")
