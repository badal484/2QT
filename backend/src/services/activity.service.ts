import db from '../db';
import { emitToAdmin } from '../socket';

export interface ActivityLogParams {
    userId: string;
    userName: string;
    userRole: string; // e.g. 'rider', 'chef', 'finance', 'admin'
    actionType: string; // e.g. 'ORDER_DELIVERED'
    entityType: string; // e.g. 'ORDER'
    entityId?: string;
    details?: any; // any extra context
}

export class ActivityLogService {
    static async log(params: ActivityLogParams) {
        try {
            const { userId, userName, userRole, actionType, entityType, entityId, details } = params;
            
            const result = await db.query(
                `INSERT INTO team_activity_logs (user_id, user_name, user_role, action_type, entity_type, entity_id, details)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [userId, userName, userRole, actionType, entityType, entityId, details ? JSON.stringify(details) : '{}']
            );

            const newLog = result.rows[0];

            // Real-time broadcast to all connected admins
            emitToAdmin('new_activity_log', newLog);

            return newLog;
        } catch (error) {
            console.error('--- ERROR IN ACTIVITY LOG SERVICE ---', error);
            // Non-blocking, so we just swallow the error internally so it doesn't break the main flow.
        }
    }

    static async getLogs(limit = 100, role?: string, action?: string) {
        let queryStr = `SELECT * FROM team_activity_logs WHERE 1=1`;
        const queryParams: any[] = [];
        let paramCount = 1;

        if (role && role !== 'all') {
            queryStr += ` AND user_role = $${paramCount}`;
            queryParams.push(role);
            paramCount++;
        }

        if (action && action !== 'all') {
            queryStr += ` AND action_type = $${paramCount}`;
            queryParams.push(action);
            paramCount++;
        }

        queryStr += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
        queryParams.push(limit);

        const result = await db.query(queryStr, queryParams);
        return result.rows;
    }
}
