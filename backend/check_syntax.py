import ast
import sys

files = [
    "main.py",
    "app/core/config.py",
    "app/core/exceptions.py",
    "app/core/prompts.py",
    "app/domain/schemas.py",
    "app/adapters/bookstack_client.py",
    "app/adapters/embedding_client.py",
    "app/adapters/vector_store.py",
    "app/adapters/llm_client.py",
    "app/services/text_processor.py",
    "app/services/ingestion_service.py",
    "app/services/sync_scheduler.py",
    "app/services/rag_service.py",
    "app/api/router_chat.py",
    "app/api/router_admin.py",
    "app/api/router_webhook.py",
]

errors = []
for f in files:
    try:
        src = open(f).read()
        ast.parse(src)
        print(f"  OK  {f}")
    except SyntaxError as e:
        errors.append((f, e))
        print(f"  ERR {f}: {e}")

print()
if errors:
    print(f"{len(errors)} syntax error(s) found")
    sys.exit(1)
else:
    print(f"All {len(files)} files pass syntax check")
