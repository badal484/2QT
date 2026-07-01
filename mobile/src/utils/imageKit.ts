import { api } from '../api/client';

export interface ImageKitUploadResult {
    url: string;
}

export const uploadToImageKit = async (file: any, folder: string = 'profiles'): Promise<ImageKitUploadResult> => {
    try {
        const formData = new FormData();
        formData.append('folder', folder);
        formData.append('image', {
            uri: file.uri,
            type: file.type || 'image/jpeg',
            name: file.fileName || `upload_${Date.now()}.jpg`,
        } as any);

        const response = await api.post('/upload/image', formData);

        if (!response.url) {
            throw new Error('Upload failed to return a URL');
        }

        return {
            url: response.url,
        };
    } catch (err: any) {
        console.error('--- UPLOAD ERROR:', err);
        throw new Error(err.response?.data?.message || err.message || 'Image upload failed');
    }
};
