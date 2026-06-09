import { Router } from 'express';
import ImageKit from 'imagekit';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';

import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

router.get('/auth', authenticate, (req: AuthRequest, res) => {
    try {
        const authenticationParameters = imagekit.getAuthenticationParameters();
        res.json(authenticationParameters);
    } catch (err: any) {
        res.status(500).json({ error: 'IMAGEKIT_AUTH_FAILED', message: err.message });
    }
});

router.post('/image', generalLimiter, upload.single('image'), async (req: any, res: any) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const response = await imagekit.upload({
            file: req.file.buffer,
            fileName: `${Date.now()}_${req.file.originalname}`,
            folder: '/2qt/uploads',
        });

        res.json({ url: response.url });
    } catch (err: any) {
        console.error('ImageKit upload error FULL:', err);
        res.status(500).json({ error: 'Upload failed', message: err.message || JSON.stringify(err) });
    }
});

export default router;
