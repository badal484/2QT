import { z } from 'zod';

export const CreateBroadcastSchema = z.object({
    title: z.string().min(1, 'title is required'),
    body: z.string().optional(),
    message: z.string().optional(),
    imageUrl: z.string().optional().or(z.literal('')),
    targetType: z.enum(['all', 'everyone', 'buyers', 'riders', 'kitchens', 'kitchen_staff', 'kitchen_customers', 'zone', 'users']).optional(),
    segment: z.string().optional(),
    audience: z.string().optional(),
    zoneId: z.string().optional(),
    kitchenId: z.string().optional(),
    kitchenTargetGroup: z.enum(['staff', 'customers']).optional(),
    targetFilter: z.object({
        zoneId: z.string().optional(),
        kitchenId: z.string().optional(),
        kitchenTargetGroup: z.enum(['staff', 'customers']).optional(),
        userIds: z.array(z.string()).optional(),
        role: z.string().optional(),
    }).optional().default({}),
}).transform((data) => {
    // Resolve body from message or body
    const body = (data.body || data.message || '').trim();

    // Resolve targetType from targetType, segment, or audience
    let targetType: 'all' | 'buyers' | 'riders' | 'kitchens' | 'kitchen_staff' | 'kitchen_customers' | 'zone' | 'users' = 'all';
    const rawType = (data.targetType || data.segment || data.audience || 'all').toLowerCase();

    if (['buyers', 'customers', 'customer', 'active_last_7'].includes(rawType)) {
        targetType = 'buyers';
    } else if (['riders', 'rider'].includes(rawType)) {
        targetType = 'riders';
    } else if (rawType === 'kitchen_staff') {
        targetType = 'kitchen_staff';
    } else if (rawType === 'kitchen_customers') {
        targetType = 'kitchen_customers';
    } else if (['kitchens', 'kitchen', 'kitchen_partners', 'partners'].includes(rawType)) {
        if (data.kitchenTargetGroup === 'customers' || data.targetFilter?.kitchenTargetGroup === 'customers') {
            targetType = 'kitchen_customers';
        } else {
            targetType = 'kitchen_staff';
        }
    } else if (rawType === 'zone') {
        targetType = 'zone';
    } else if (rawType === 'users') {
        targetType = 'users';
    } else {
        targetType = 'all';
    }

    const zoneId = data.zoneId || data.targetFilter?.zoneId;
    const kitchenId = data.kitchenId || data.targetFilter?.kitchenId;
    const kitchenTargetGroup = data.kitchenTargetGroup || data.targetFilter?.kitchenTargetGroup || (targetType === 'kitchen_customers' ? 'customers' : 'staff');

    const targetFilter = {
        ...data.targetFilter,
        ...(zoneId ? { zoneId } : {}),
        ...(kitchenId ? { kitchenId } : {}),
        ...(kitchenTargetGroup ? { kitchenTargetGroup } : {}),
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

