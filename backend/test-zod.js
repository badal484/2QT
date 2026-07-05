const { z } = require('zod');
const CustomizationOptionSchema = z.object({
    name: z.string().min(1).max(100),
    price_paise: z.number().int().nonnegative().default(0),
    photo_url: z.string().url().or(z.literal("")).optional().nullable()
});
const CustomizationGroupSchema = z.object({
    name: z.string().min(1).max(100),
    required: z.boolean().default(false),
    options: z.array(CustomizationOptionSchema).min(1)
});
const data = {
  name: "Extra chese",
  required: false,
  options: [{
    name: "Amul Cheese",
    price_paise: 1000,
    photo_url: "https://ik.imagekit.io/yryxhmqps/menu_items/amul.png"
  }]
};
const res = CustomizationGroupSchema.safeParse(data);
console.log(res);
