import { api } from '../api/client';

import { ENV } from '../config/env';

const IMAGEKIT_URL_ENDPOINT = ENV.IMAGEKIT_URL_ENDPOINT;
const IMAGEKIT_PUBLIC_KEY = ENV.IMAGEKIT_PUBLIC_KEY;

export interface ImageKitUploadResult {
    url: string;
    fileId: string;
    name: string;
}

export const uploadToImageKit = async (file: any, folder: string = 'profiles'): Promise<ImageKitUploadResult> => {
    try {
        // 1. Get Authentication Parameters from Backend
        const authParams = await api.get('/upload/auth');

        // 2. Prepare Form Data
        const formData = new FormData();
        formData.append('file', {
            uri: file.uri,
            type: file.type || 'image/jpeg',
            name: file.fileName || `upload_${Date.now()}.jpg`,
        } as any);
        formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
        formData.append('signature', authParams.signature);
        formData.append('expire', authParams.expire.toString());
        formData.append('token', authParams.token);
        formData.append('fileName', file.fileName || `upload_${Date.now()}.jpg`);
        formData.append('folder', folder);

        // 3. Upload to ImageKit
        const response = await fetch(`${IMAGEKIT_URL_ENDPOINT}/api/v1/files/upload`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'ImageKit upload failed');
        }

        return {
            url: data.url,
            fileId: data.fileId,
            name: data.name,
        };
    } catch (err: any) {
        console.error('--- IMAGEKIT UPLOAD ERROR:', err);
        throw err;
    }
};
