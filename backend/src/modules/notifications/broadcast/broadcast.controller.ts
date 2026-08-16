import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { CreateBroadcastSchema } from './broadcast.dto';
import { BroadcastService } from './broadcast.service';

export class BroadcastController {
    static async createBroadcast(req: AuthRequest, res: Response) {
        const userRole = req.user?.role;
        if (!userRole || !['super_admin', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'FORBIDDEN: Admin privileges required to send broadcasts' });
        }

        const parseResult = CreateBroadcastSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Invalid broadcast payload', details: parseResult.error.format() });
        }

        try {
            const adminUserId = req.user!.userId;
            const campaign = await BroadcastService.createCampaign(parseResult.data, adminUserId);
            return res.status(201).json({ success: true, campaign });
        } catch (error: any) {
            console.error('[BroadcastController] Failed creating broadcast:', error.message);
            return res.status(500).json({ error: 'Failed to launch broadcast campaign', message: error.message });
        }
    }

    static async listBroadcasts(req: AuthRequest, res: Response) {
        const userRole = req.user?.role;
        if (!userRole || !['super_admin', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'FORBIDDEN: Admin privileges required' });
        }

        const limit = parseInt(req.query.limit as string || '50', 10);
        const offset = parseInt(req.query.offset as string || '0', 10);

        const campaigns = await BroadcastService.getCampaigns(limit, offset);
        return res.status(200).json({ success: true, campaigns });
    }

    static async getBroadcastStatus(req: AuthRequest, res: Response) {
        const userRole = req.user?.role;
        if (!userRole || !['super_admin', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'FORBIDDEN: Admin privileges required' });
        }

        const campaign = await BroadcastService.getCampaignById(String(req.params.id));
        if (!campaign) {
            return res.status(404).json({ error: 'Broadcast campaign not found' });
        }

        return res.status(200).json({ success: true, campaign });
    }
}
