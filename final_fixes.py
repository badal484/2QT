import re

# 1. Fix admin.ts import
with open('backend/src/routes/admin.ts', 'r') as f:
    content = f.read()
if 'import { ActivityLogService }' not in content:
    content = content.replace("import { query, withTransaction } from '../db';", "import { query, withTransaction } from '../db';\nimport { ActivityLogService } from '../services/activity.service';")
with open('backend/src/routes/admin.ts', 'w') as f:
    f.write(content)

# 2. Fix activity.service.ts
with open('backend/src/services/activity.service.ts', 'r') as f:
    content = f.read()
content = content.replace("import { getIO } from '../socket';", "import { emitToAdmin } from '../socket';")
content = content.replace("""const io = getIO();
            if (io) {
                io.to('admin_room').emit('new_activity_log', newLog);
            }""", "emitToAdmin('new_activity_log', newLog);")
with open('backend/src/services/activity.service.ts', 'w') as f:
    f.write(content)

print("Backend fixes applied")
