from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
needle = sys.argv[2]
start = source.find(needle)
if start < 0:
    raise SystemExit(f"not found: {needle}")
next_markers = ["\nfunction ", "\nconst ", "\nexport default", "\nexport function "]
ends = [source.find(marker, start + len(needle)) for marker in next_markers]
ends = [value for value in ends if value >= 0]
end = min(ends) if ends else len(source)
text = source[start:end]
print(text[:12000])
