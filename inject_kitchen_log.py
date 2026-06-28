import re

with open('backend/src/routes/kitchen.ts', 'r') as f:
    content = f.read()

# Add import
if 'import { ActivityLogService }' not in content:
    content = content.replace("import db from '../db';", "import db from '../db';\nimport { ActivityLogService } from '../services/activity.service';")

# Find where status is updated to ready
# E.g. req.body.status = 'ready'
# This might be tricky via regex, so I'll just look for: Order status updated to
replace_pattern = r"await client.query\([\s\S]*?'UPDATE orders SET status = \$1.*?WHERE id = \$2'[\s\S]*?\);"
# Actually it's better to just log when emitting 'order_status_update'

def replacer(match):
    return match.group(0) + """
            // Log kitchen activity
            if (req.user && status) {
                ActivityLogService.log({
                    userId: req.user.id,
                    userName: req.user.name || 'Kitchen Staff',
                    userRole: 'kitchen',
                    actionType: `ORDER_${status.toUpperCase()}`,
                    entityType: 'ORDER',
                    entityId: orderId,
                    details: { orderId, newStatus: status }
                });
            }
"""

content = re.sub(r"io\.emit\('order_status_update',[^;]+;\s*(?://.*)?", replacer, content)

with open('backend/src/routes/kitchen.ts', 'w') as f:
    f.write(content)

print("Injected kitchen log")
