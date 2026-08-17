export interface MenuOffer {
  id: string;
  title?: string;
  discount_type: 'percent' | 'percentage' | 'flat';
  discount_percent?: string | number;
  discount_flat_paise?: number;
  max_discount_paise?: number;
  target_type: 'all' | 'item' | 'category' | 'kitchen';
  target_id?: string;
  target_ids?: string[];
}

export interface EnrichedMenuItem {
  id: string;
  name: string;
  price_paise: number;
  original_price_paise: number;
  applied_offer: MenuOffer | null;
  discount_badge: string | null;
  [key: string]: any;
}

export function enrichItemWithOffer(item: any, offers: MenuOffer[] = []): EnrichedMenuItem {
  if (!item) return item;
  const basePrice = item.price_paise;
  let offerDiscountPaise = 0;
  let appliedOffer: MenuOffer | null = null;

  for (const offer of offers) {
    const tIds: string[] = Array.isArray(offer.target_ids) ? offer.target_ids : [];
    const isMatch =
      offer.target_type === 'all' ||
      (offer.target_type === 'item' && (tIds.includes(item.id) || offer.target_id === item.id)) ||
      (offer.target_type === 'category' && (
        tIds.some((t: string) => String(t) === String(item.category)) ||
        String(offer.target_id) === String(item.category)
      )) ||
      (offer.target_type === 'kitchen' && (tIds.includes(item.kitchen_id) || offer.target_id === item.kitchen_id));

    if (isMatch) {
      let discount = 0;
      if (offer.discount_type === 'flat') {
        discount = offer.discount_flat_paise || 0;
      } else if (offer.discount_type === 'percent' || offer.discount_type === 'percentage') {
        const pct = parseFloat(String(offer.discount_percent || '0')) || 0;
        discount = Math.floor((basePrice * pct) / 100);
        if (offer.max_discount_paise && discount > offer.max_discount_paise) {
          discount = offer.max_discount_paise;
        }
      }
      if (discount > offerDiscountPaise) {
        offerDiscountPaise = discount;
        appliedOffer = offer;
      }
    }
  }

  const effectivePricePaise = Math.max(0, basePrice - offerDiscountPaise);
  let discountBadge: string | null = null;
  if (appliedOffer && offerDiscountPaise > 0) {
    if (appliedOffer.discount_type === 'percent' || appliedOffer.discount_type === 'percentage') {
      discountBadge = `${appliedOffer.discount_percent}% OFF`;
    } else {
      discountBadge = `₹${(offerDiscountPaise / 100).toFixed(0)} OFF`;
    }
  }

  return {
    ...item,
    original_price_paise: basePrice,
    price_paise: effectivePricePaise,
    applied_offer: appliedOffer,
    discount_badge: discountBadge,
  };
}

export function enrichItemsWithOffers(items: any[] = [], offers: MenuOffer[] = []): EnrichedMenuItem[] {
  return items.map(item => enrichItemWithOffer(item, offers));
}
