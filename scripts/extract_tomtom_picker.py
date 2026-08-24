from pathlib import Path

source = Path('/home/ubuntu/eventverse/src/EventVerse.jsx').read_text()
markers = ['function TomTomVenueLocationPicker', 'const TomTomVenueLocationPicker', 'function VenueManagerWorkspace']
for marker in markers:
    start = source.find(marker)
    print(f'\n=== {marker}: {start} ===')
    if start >= 0:
        print(source[start:start + 7000])
