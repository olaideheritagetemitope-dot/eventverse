import json
from pathlib import Path

project_id = "blalvoelllndmbppbkcy"
query = Path("supabase/0107_discovery_artist_identity_hydration.sql").read_text()
Path("/tmp/discovery_migration_input.json").write_text(json.dumps({
    "project_id": project_id,
    "name": "discovery_artist_identity_hydration",
    "query": query,
}))
