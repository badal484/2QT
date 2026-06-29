const { z } = require('zod');
const KitchenSchema = z.object({
    name: z.string().min(1).max(120),
    zone_ids: z.array(z.string().uuid()).min(1, 'At least one zone is required'),
    address: z.string().max(300).optional(),
    fssai_license: z.string().max(20).optional(),
    gstin: z.string().max(20).optional(),
    lat: z.number().optional().default(12.9716),
    lng: z.number().optional().default(77.5946),
    is_paused: z.boolean().optional(),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').optional(),
});
const result = KitchenSchema.safeParse({
  name: '2QT Central Kitchen',
  zone_ids: ['a1f1fdb9-2b6d-4c3e-8c67-628d09f7a9d0'],
  fssai_license: '',
  gstin: 'd',
  address: 'Kundanahalli Main Road, Near ITPL',
  lat: 12.9716,
  lng: 77.5946
});
console.log(result.success ? "SUCCESS" : JSON.stringify(result.error.issues, null, 2));
