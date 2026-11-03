export type Audience = 'Women' | 'Men' | 'Kids' | 'Unisex'

export type Garment = {
  id: string
  name: string
  category: string
  audience: Audience
  clothingType: string
  price: string
  color: string
  sizes: string[]
  fabric: string
  description: string
  blurb: string
  image: string
}

const CDN = 'https://files.monstarx.app/dzrpnvictt/public/images'

export const HERO_IMAGE = `${CDN}/hero-atelier.webp`
export const HERO_IMG = HERO_IMAGE
export const MODEL_SAMPLE = `${CDN}/model-sample.webp`

const WOMEN_SIZES = ['XS', 'S', 'M', 'L', 'XL']
const MEN_SIZES = ['S', 'M', 'L', 'XL', 'XXL']
const KIDS_SIZES = ['2–3Y', '4–5Y', '6–7Y', '8–10Y']
const UNI_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function isPlaceholderGarment(image: string): boolean {
  return image.startsWith('data:image/svg')
}

function g(
  id: string,
  name: string,
  audience: Audience,
  category: string,
  clothingType: string,
  color: string,
  price: string,
  fabric: string,
  blurb: string,
  description: string,
  image: string,
  sizes: string[],
): Garment {
  return { id, name, audience, category, clothingType, color, price, fabric, blurb, description, image, sizes }
}

export const CATALOG: Garment[] = [
  g('ivory-blouse', 'Ivory Silk Blouse', 'Women', 'Tops', 'Shirt', 'Ivory', '$129', 'Mulberry silk, mother-of-pearl buttons', 'Fluid ivory blouse with a soft pointed collar and relaxed cuff.', 'Fluid ivory blouse with a soft pointed collar and relaxed cuff. Tucks cleanly into tailoring.', `${CDN}/garment-ivory-blouse.webp`, WOMEN_SIZES),
  g('camel-coat', 'Camel Wool Overcoat', 'Women', 'Jackets', 'Jacket', 'Camel', '$349', 'Double-faced Italian wool', 'Long camel overcoat with hand-finished lapels.', 'Long camel overcoat with hand-finished lapels and a clean, collar-off drape.', `${CDN}/garment-camel-coat.webp`, WOMEN_SIZES),
  g('black-dress', 'Noir Evening Dress', 'Women', 'Party wear', 'Western dress', 'Black', '$289', 'Crepe with draped neckline', 'Floor-skimming black dress with softly draped neckline.', 'Floor-skimming black dress with softly draped neckline and quiet movement.', `${CDN}/garment-noir-dress.webp`, WOMEN_SIZES),
  g('denim-jacket', 'Indigo Denim Jacket', 'Unisex', 'Jackets', 'Jacket', 'Indigo', '$149', 'Japanese selvedge denim', 'Boxy indigo jacket with contrast stitching.', 'Boxy indigo jacket with contrast stitching. Made to layer over silk and knits.', `${CDN}/garment-denim-jacket.webp`, UNI_SIZES),
  g('pleated-skirt', 'Champagne Pleated Skirt', 'Women', 'Skirts', 'Skirt', 'Champagne', '$159', 'Pleated satin, midi length', 'Sun-pleated midi that catches light with every step.', 'Sun-pleated midi that catches light with every step. Elastic back waist for ease.', `${CDN}/garment-pleated-skirt.webp`, WOMEN_SIZES),
  g('linen-blazer', 'Sand Linen Blazer', 'Men', 'Blazers', 'Blazer', 'Sand', '$219', 'European flax linen', 'Unstructured sand blazer with patch pockets.', 'Unstructured sand blazer with patch pockets. The summer tailoring staple.', `${CDN}/garment-linen-blazer.webp`, MEN_SIZES),
  g('knit-sweater', 'Oat Cable Knit', 'Unisex', 'Casual wear', 'Sweatshirt', 'Oat', '$139', 'Merino-cashmere cable knit', 'Cosy oat cable knit with a relaxed shoulder.', 'Cosy oat cable knit with a relaxed shoulder and ribbed hem.', `${CDN}/garment-knit-sweater.webp`, UNI_SIZES),
  g('satin-slip', 'Rose Satin Slip Skirt', 'Women', 'Skirts', 'Skirt', 'Rose', '$119', 'Bias-cut sandwashed satin', 'Bias-cut rose slip that skims, never clings.', 'Bias-cut rose slip that skims, never clings. Dress it up or down.', `${CDN}/garment-satin-slip.webp`, WOMEN_SIZES),
  g('mens-oxford', 'Classic White Oxford Shirt', 'Men', 'Formal shirts', 'Formal shirt', 'White', '$89', 'Brushed cotton oxford, button-down collar', 'Crisp white oxford, classic menswear staple.', 'Crisp white oxford with a classic collar and single chest pocket. A menswear staple.', `${CDN}/garment-mens-oxford-2.webp`, MEN_SIZES),
  g('mens-field-jacket', 'Olive Field Jacket', 'Men', 'Jackets', 'Jacket', 'Olive', '$199', 'Washed canvas, brass zips', 'Rugged olive field jacket with chest pockets.', 'Rugged olive field jacket with chest pockets and a relaxed block. Layers over knits and tees.', `${CDN}/garment-mens-field-jacket-2.webp`, MEN_SIZES),
  g('mens-polo-knit', 'Navy Knit Polo', 'Men', 'T-shirts', 'T-shirt', 'Navy', '$79', 'Fine cotton knit, ribbed collar', 'Smart navy knit polo with soft collar.', 'Smart navy knit polo with a soft ribbed collar. Dresses up jeans in seconds.', `${CDN}/garment-mens-polo-knit-2.webp`, MEN_SIZES),
  g('kids-floral-dress', 'Sunny Floral Kids Dress', 'Kids', 'Girls dresses', 'Dress', 'Yellow floral', '$49', 'Soft cotton, twirl skirt', 'Cheerful yellow floral dress, ages 3–10.', 'Cheerful yellow floral dress with puff sleeves and a twirl-ready skirt. Ages 3–10.', `${CDN}/garment-kids-floral-dress-2.webp`, KIDS_SIZES),
  g('kids-denim-set', 'Little Denim Jacket + Jeans Set', 'Kids', 'Boys shirts', 'Jacket', 'Light wash', '$69', 'Soft light-wash denim', 'Light-wash denim jacket + jeans set.', 'Cosy light-wash denim jacket with matching jeans. Play-proof and machine washable.', `${CDN}/garment-kids-denim-set-2.webp`, KIDS_SIZES),
  g('kids-tee-shorts', 'Striped Tee + Coral Shorts Set', 'Kids', 'Boys T-shirts', 'T-shirt', 'Coral stripe', '$39', 'Jersey cotton, elastic waist', 'Striped tee with coral shorts.', 'Breezy striped tee with coral shorts and an easy elastic waist. Playground ready.', `${CDN}/garment-kids-tee-shorts-2.webp`, KIDS_SIZES),
]

export const AUDIENCES = ['All', 'Women', 'Men', 'Kids', 'Unisex'] as const

export function categoriesFor(audience: string): string[] {
  const items = audience === 'All' ? CATALOG : CATALOG.filter((g) => g.audience === audience)
  return ['All', ...Array.from(new Set(items.map((item) => item.category)))]
}

export const CATEGORIES = categoriesFor('All')

export type Fit = {
  id: string
  createdAt: string
  selfieUrl: string
  garmentUrl: string
  garmentName: string
  garmentCategory: string
  resultUrl: string
  note: string
}

export type FitRecord = Fit & { selfieRemote?: string; category?: string; mode?: string }

const KEY = 'fitroom-fits-v1'

export function loadFits(): Fit[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Fit[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFits(fits: Fit[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(fits.slice(0, 30)))
  } catch {
    // storage full — ignore
  }
}
