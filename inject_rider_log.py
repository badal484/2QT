import re

with open('backend/src/routes/rider.ts', 'r') as f:
    content = f.read()

# Add import
if 'import { ActivityLogService }' not in content:
    content = content.replace("import db from '../db';", "import db from '../db';\nimport { ActivityLogService } from '../services/activity.service';")

def accept_mission_replacer(match):
    return match.group(0) + """
        // Log rider activity
        if (req.user) {
            ActivityLogService.log({
                userId: req.user.id,
                userName: req.user.name || 'Rider',
                userRole: 'rider',
                actionType: 'MISSION_ACCEPTED',
                entityType: 'ORDER',
                entityId: mission.order_id,
                details: { orderId: mission.order_id, missionId: missionId }
            });
        }
"""

def update_status_replacer(match):
    return match.group(0) + """
            // Log rider activity
            if (req.user && status) {
                ActivityLogService.log({
                    userId: req.user.id,
                    userName: req.user.name || 'Rider',
                    userRole: 'rider',
                    actionType: `ORDER_${status.toUpperCase()}`,
                    entityType: 'ORDER',
                    entityId: orderId,
                    details: { orderId, newStatus: status }
                });
            }
"""

content = re.sub(r"io\.emit\('mission_assigned',[^;]+;", accept_mission_replacer, content)
content = re.sub(r"io\.emit\('order_status_update',\s*{\s*orderId: orderId,\s*status: status[^}]*}\s*\);", update_status_replacer, content)

with open('backend/src/routes/rider.ts', 'w') as f:
    f.write(content)

print("Injected rider log")
