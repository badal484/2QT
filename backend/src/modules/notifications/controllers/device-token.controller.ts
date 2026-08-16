import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { DeviceTokenService } from '../services/device-token.service';
import { RegisterDeviceTokenSchema, DeactivateDeviceTokenSchema } from '../dto/device-token.dto';

export class DeviceTokenController {
    static async registerToken(req: AuthRequest, res: Response) {
        const parseResult = RegisterDeviceTokenSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Invalid input payload', details: parseResult.error.format() });
        }

        const userId = req.user!.userId;
        const { deviceId, appType, platform, fcmToken } = parseResult.data;

        const record = await DeviceTokenService.registerToken({
            userId,
            deviceId,
            appType,
            platform,
            fcmToken,
        });

        console.log(`[DEVICE_TOKEN_REGISTERED] User: ${userId}, App: ${appType}, Platform: ${platform}, TokenPrefix: ${fcmToken.slice(0, 15)}`);

        return res.status(200).json({ success: true, deviceToken: record });
    }

    static async deactivateToken(req: AuthRequest, res: Response) {
        const parseResult = DeactivateDeviceTokenSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Invalid input payload', details: parseResult.error.format() });
        }

        const userId = req.user!.userId;
        const { deviceId, appType } = parseResult.data;

        await DeviceTokenService.deactivateDeviceToken(userId, deviceId, appType);

        return res.status(200).json({ success: true, message: 'Device token deactivated' });
    }
}
