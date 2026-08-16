import { z } from 'zod';

export const CreateBroadcastSchema = z.object({
    title: z.string().min(1, 'title is required'),
    body: z.string().optional(),
    message: z.string().optional(),
    imageUrl: z.string().optional().or(z.literal('')),
    targetType: z.enum(['all', 'everyone', 'buyers', 'riders', 'kitchens', 'zone', 'users']).optional(),
    segment: z.string().optional(),
    audience: z.string().optional(),
    zoneId: z.string().optional(),
    targetFilter: z.object({
        zoneId: z.string().optional(),
        userIds: z.array(z.string()).optional(),
        role: z.string().optional(),
    }).optional().default({}),
}).transform((data) => {
    // Resolve body from message or body
    const body = (data.body || data.message || '').trim();

    // Resolve targetType from targetType, segment, or audience
    let targetType: 'all' | 'buyers' | 'riders' | 'kitchens' | 'zone' | 'users' = 'all';
    const rawType = (data.targetType || data.segment || data.audience || 'all').toLowerCase();

    if (['buyers', 'customers', 'customer'].includes(rawType)) {
        targetType = 'buyers';
    } else if (['riders', 'rider'].includes(rawType)) {
        targetType = 'riders';
    } else if (['kitchens', 'kitchen', 'kitchen_partners'].includes(rawType)) {
        targetType = 'kitchens';
    } else if (rawType === 'zone') {
        targetType = 'zone';
    } else if (rawType === 'users') {
        targetType = 'users';
    } else {
        targetType = 'all';
    }

    const zoneId = data.zoneId || data.targetFilter?.zoneId;
    const targetFilter = {
        ...data.targetFilter,
        ...(zoneId ? { zoneId } : {}),
    };

    return {
        title: data.title.trim(),
        body,
        imageUrl: data.imageUrl,
        targetType,
        targetFilter,
    };
});

export type CreateBroadcastInput = z.infer<typeof CreateBroadcastSchema>;
