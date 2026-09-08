#!/usr/bin/env python3
import json, sys
from datetime import datetime, timezone

def safe_file(path, default):
    try:
        with open(path) as f:
            val = f.read().strip()
        if not val or val in ('NULL', 'null', r'\N'):
            return default
        return json.loads(val)
    except:
        return default

out_path = sys.argv[1]
wdir = sys.argv[2]

bundle = {
    'version': '2.0',
    'exported_at': datetime.now(timezone.utc).isoformat(),
    'server': 'daddyai.online',
    'training_pairs': safe_file(f'{wdir}/tp.json', []),
    'auto_reply_templates': safe_file(f'{wdir}/tm.json', []),
    'auto_reply_rules': safe_file(f'{wdir}/ru.json', []),
    'agent_settings': safe_file(f'{wdir}/as.json', {}),
    'product_catalogue_count': int(open(f'{wdir}/pc.txt').read().strip() or 0),
}

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(bundle, f, ensure_ascii=False, indent=2)

print(f"  training_pairs: {len(bundle['training_pairs'])}")
print(f"  templates: {len(bundle['auto_reply_templates'])}")
print(f"  products: {bundle['product_catalogue_count']}")
