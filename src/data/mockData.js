import { PRIMARY_CATEGORIES, SUBCATEGORIES } from './categoryModel'

/** Primary nav / audience categories only (Men, Women, Children). */
export const CATEGORIES = PRIMARY_CATEGORIES

export { SUBCATEGORIES }

const image = (seed) => `https://picsum.photos/seed/dire-${seed}/640/640`

export const DELIVERY_FEE = 150

export const SAMPLE_PRODUCTS = []

const _unusedProducts = [
  {
    id: 'p-001',
    name: 'Classic Cotton Shirt',
    category: 'men',
    subcategory: 'apparel',
    price: 1850,
    stock: 24,
    colors: ['Black', 'White', 'Blue'],
    sizes: ['M', 'L', 'XL'],
    description: 'Breathable cotton shirt for smart casual outfits.',
    images: [image('shirt-1'), image('shirt-2')],
    isBestSeller: true,
    isNewArrival: false,
  },
  {
    id: 'p-002',
    name: 'Urban Women Blazer',
    category: 'women',
    subcategory: 'apparel',
    price: 3200,
    stock: 17,
    colors: ['Black', 'Beige'],
    sizes: ['S', 'M', 'L'],
    description: 'Tailored blazer with soft inner lining for all-day wear.',
    images: [image('blazer-1'), image('blazer-2')],
    isBestSeller: true,
    isNewArrival: true,
  },
  {
    id: 'p-003',
    name: 'Kids Play Set',
    category: 'children',
    subcategory: 'apparel',
    price: 1450,
    stock: 35,
    colors: ['Green', 'Yellow'],
    sizes: ['5-6Y', '7-8Y'],
    description: 'Durable and soft fabric set for active kids.',
    images: [image('kids-1'), image('kids-2')],
    isBestSeller: false,
    isNewArrival: true,
  },
  {
    id: 'p-004',
    name: 'Runner Street Sneakers',
    category: 'men',
    subcategory: 'shoes',
    price: 4100,
    stock: 12,
    colors: ['White', 'Gray'],
    sizes: ['40', '41', '42', '43'],
    description: 'Lightweight sneakers designed for comfort and style.',
    images: [image('shoe-1'), image('shoe-2')],
    isBestSeller: true,
    isNewArrival: false,
  },
  {
    id: 'p-005',
    name: 'Amber Night Perfume',
    category: 'women',
    subcategory: 'perfumes',
    price: 2900,
    stock: 30,
    colors: ['N/A'],
    sizes: ['50ml', '100ml'],
    description: 'Long-lasting scent with woody and amber notes.',
    images: [image('perfume-1'), image('perfume-2')],
    isBestSeller: false,
    isNewArrival: true,
  },
  {
    id: 'p-006',
    name: 'Compact Air Fryer',
    category: 'women',
    subcategory: 'appliances',
    price: 6900,
    stock: 8,
    colors: ['Black'],
    sizes: ['4L'],
    description: 'Energy-efficient air fryer with digital controls.',
    images: [image('appliance-1'), image('appliance-2')],
    isBestSeller: true,
    isNewArrival: false,
  },
  {
    id: 'p-007',
    name: 'Slim Fit Jeans',
    category: 'men',
    subcategory: 'apparel',
    price: 2300,
    stock: 27,
    colors: ['Indigo', 'Black'],
    sizes: ['30', '32', '34', '36'],
    description: 'Modern slim-fit jeans with stretch comfort.',
    images: [image('jean-1'), image('jean-2')],
    isBestSeller: false,
    isNewArrival: true,
  },
  {
    id: 'p-008',
    name: 'Women Soft Knit Dress',
    category: 'women',
    subcategory: 'apparel',
    price: 2550,
    stock: 14,
    colors: ['Cream', 'Olive'],
    sizes: ['S', 'M', 'L'],
    description: 'Soft knit dress with elegant minimal silhouette.',
    images: [image('dress-1'), image('dress-2')],
    isBestSeller: false,
    isNewArrival: true,
  },
]

export const PROMOTIONS = [
  {
    id: 'promo-1',
    title: 'Weekend Flash Sale',
    details: 'Up to 25% off selected shoes and perfumes.',
  },
]
