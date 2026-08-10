// getDishImage is defined inside app/menu/page.tsx — extract and test the pure logic here.
// We copy the exact function body to avoid pulling in the whole Next.js page module.

function getDishImage(name: string, category: string, photo_url?: string): string {
  if (photo_url) return photo_url;
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes('naan') || c.includes('bread') || n.includes('roti')) return 'naan';
  if (n.includes('biryani') || c.includes('rice')) return 'biryani';
  if (n.includes('mutton') || n.includes('rogan') || n.includes('lamb')) return 'mutton';
  if (n.includes('paneer') || n.includes('tikka') || c.includes('appetizer') || c.includes('curry') || c.includes('main')) return 'paneer';
  if (c.includes('healthy') || n.includes('salad') || n.includes('bowl')) return 'salad';
  if (c.includes('dessert') || n.includes('cake') || n.includes('sweet')) return 'dessert';
  if (c.includes('pasta') || n.includes('alfredo') || n.includes('risotto')) return 'pasta';
  if (c.includes('burger') || n.includes('sandwich')) return 'burger';
  return 'default';
}

describe('getDishImage', () => {
  it('returns photo_url when provided, ignoring name/category', () => {
    expect(getDishImage('Biryani', 'Rice', 'https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg');
  });

  it('matches "biryani" in name', () => {
    expect(getDishImage('Chicken Biryani', 'Main')).toBe('biryani');
  });

  it('matches "rice" in category', () => {
    expect(getDishImage('Jeera Rice', 'Rice Dishes')).toBe('biryani');
  });

  it('matches "naan" in name', () => {
    expect(getDishImage('Butter Naan', 'Breads')).toBe('naan');
  });

  it('matches "roti" in name', () => {
    expect(getDishImage('Tandoori Roti', 'Indian')).toBe('naan');
  });

  it('matches "bread" in category', () => {
    expect(getDishImage('Pita', 'Bread')).toBe('naan');
  });

  it('matches "mutton" in name', () => {
    expect(getDishImage('Mutton Curry', 'Main')).toBe('mutton');
  });

  it('matches "rogan" in name (Rogan Josh)', () => {
    expect(getDishImage('Rogan Josh', 'Kashmiri')).toBe('mutton');
  });

  it('matches "lamb" in name', () => {
    expect(getDishImage('Lamb Kebab', 'Grill')).toBe('mutton');
  });

  it('matches "paneer" in name', () => {
    expect(getDishImage('Paneer Butter Masala', 'Veg')).toBe('paneer');
  });

  it('matches "tikka" in name', () => {
    expect(getDishImage('Chicken Tikka', 'Starters')).toBe('paneer');
  });

  it('matches "curry" in category', () => {
    expect(getDishImage('Dal Makhani', 'Curry')).toBe('paneer');
  });

  it('matches "main" in category', () => {
    expect(getDishImage('Any Dish', 'Main Course')).toBe('paneer');
  });

  it('matches "salad" in name', () => {
    expect(getDishImage('Greek Salad', 'Healthy')).toBe('salad');
  });

  it('matches "bowl" in name', () => {
    expect(getDishImage('Buddha Bowl', 'Vegan')).toBe('salad');
  });

  it('matches "healthy" in category', () => {
    expect(getDishImage('Sprout Mix', 'Healthy Eats')).toBe('salad');
  });

  it('matches "cake" in name', () => {
    expect(getDishImage('Chocolate Cake', 'Sweets')).toBe('dessert');
  });

  it('matches "dessert" in category', () => {
    expect(getDishImage('Gulab Jamun', 'Dessert')).toBe('dessert');
  });

  it('matches "sweet" in name', () => {
    expect(getDishImage('Sweet Ladoo', 'Indian')).toBe('dessert');
  });

  it('matches "pasta" in category', () => {
    expect(getDishImage('Penne Arrabiata', 'Pasta')).toBe('pasta');
  });

  it('matches "alfredo" in name', () => {
    expect(getDishImage('Fettuccine Alfredo', 'Italian')).toBe('pasta');
  });

  it('matches "burger" in category', () => {
    expect(getDishImage('Veggie Patty', 'Burger')).toBe('burger');
  });

  it('matches "sandwich" in name', () => {
    expect(getDishImage('Club Sandwich', 'Snacks')).toBe('burger');
  });

  it('returns default for unrecognised name and category', () => {
    expect(getDishImage('Mystery Food', 'Unknown')).toBe('default');
  });

  it('is case-insensitive for name', () => {
    expect(getDishImage('BIRYANI', 'Main')).toBe('biryani');
  });

  it('is case-insensitive for category', () => {
    expect(getDishImage('Fried Rice', 'RICE BOWLS')).toBe('biryani');
  });

  it('photo_url takes priority over all keyword matching', () => {
    expect(getDishImage('Default Unknown', 'Unknown', 'https://cdn.co/custom.jpg')).toBe('https://cdn.co/custom.jpg');
  });
});
