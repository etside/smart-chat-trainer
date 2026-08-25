#!/bin/bash
# Daddy AI - Import Conversation Data
# Usage: bash scripts/vps-import-conversations.sh /path/to/conversation_part_*.json
set -e

echo "=== Daddy AI Conversation Import ==="

if [ $# -eq 0 ]; then
  echo "Usage: $0 /path/to/conversation_part_*.json"
  echo "Example: $0 /storage/emulated/0/Download/conversation_part_*.json"
  exit 1
fi

# Combine all input files
echo "Combining conversation files..."
python3 -c "
import json, sys, glob

all_convos = []
for pattern in sys.argv[1:]:
    for f in glob.glob(pattern):
        with open(f) as fh:
            data = json.load(fh)
            if isinstance(data, list):
                all_convos.extend(data)
            else:
                all_convos.append(data)
        print(f'  Loaded: {f}')

with open('/tmp/import-conversations.json', 'w') as fh:
    json.dump(all_convos, fh)
print(f'Total conversations: {len(all_convos)}')
" "$@"

# Import via Supabase REST API (requires service role key)
echo ""
echo "Importing to Supabase..."
python3 << 'PYEOF'
import json
import urllib.request
import urllib.error
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://lcpxaoahyxdyhnkxafvf.supabase.co")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SERVICE_KEY:
    print("ERROR: Set SUPABASE_SERVICE_ROLE_KEY environment variable")
    print("  export SUPABASE_SERVICE_ROLE_KEY=your_key_here")
    exit(1)

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

with open("/tmp/import-conversations.json") as f:
    convos = json.load(f)

print(f"Importing {len(convos)} conversations...")
conv_ok = 0
msg_ok = 0
pair_ok = 0

for conv in convos:
    cid = conv.get("conversation_id", "unknown")
    msgs = conv.get("messages", [])

    # Insert conversation
    data = json.dumps({"external_id": cid, "source": "wear_impressive_data"}).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/conversations", data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        if result:
            db_id = result[0]["id"]
            conv_ok += 1

            # Insert messages
            msg_records = [{"conversation_id": db_id, "role": m["role"], "content": m.get("content", "")[:4000], "seq": i}
                          for i, m in enumerate(msgs) if m.get("content")]
            if msg_records:
                msg_data = json.dumps(msg_records).encode()
                req2 = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/messages", data=msg_data,
                    headers={**headers, "Prefer": "return=minimal"}, method="POST")
                urllib.request.urlopen(req2)
                msg_ok += len(msg_records)

            # Extract Q&A pairs
            pending = []
            for m in msgs:
                if m["role"] == "user" and m.get("content"):
                    pending.append(m["content"])
                elif m["role"] == "assistant" and m.get("content") and pending:
                    q = " | ".join(pending[-2:])
                    pair_data = json.dumps({"question": q[:2000], "answer": m["content"][:4000],
                        "status": "approved", "source": "conversation_import"}).encode()
                    req3 = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/training_pairs", data=pair_data,
                        headers={**headers, "Prefer": "return=minimal"}, method="POST")
                    try:
                        urllib.request.urlopen(req3)
                        pair_ok += 1
                    except: pass
                    pending = []

            print(f"  {cid}: {len(msg_records)} messages")
    except urllib.error.HTTPError as e:
        print(f"  {cid}: ERROR {e.code}")

print(f"\n=== Import Summary ===")
print(f"Conversations: {conv_ok}")
print(f"Messages: {msg_ok}")
print(f"Training Pairs: {pair_ok}")
PYEOF

echo "Done!"
