import re

with open('backend/src/routes/admin.ts', 'r') as f:
    content = f.read()

# Add import
if 'import { ActivityLogService }' not in content:
    content = content.replace("import db from '../db';", "import db from '../db';\nimport { ActivityLogService } from '../services/activity.service';")

# Add route
route_code = """
router.get('/activity-logs', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res) => {
    try {
        const { limit, role, action } = req.query;
        const logs = await ActivityLogService.getLogs(Number(limit) || 100, role as string, action as string);
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});
"""

if "router.get('/activity-logs'" not in content:
    content = content.replace("router.get('/dashboard'", route_code + "\nrouter.get('/dashboard'")

with open('backend/src/routes/admin.ts', 'w') as f:
    f.write(content)

print("Injected activity-logs route")
