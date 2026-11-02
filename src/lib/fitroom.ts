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

export function garmentPlaceholder(name: string, color: string): string {
  const safe = name.replace(/[<>&]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="600" height="800" fill="#f4f1ea"/>
    <rect x="90" y="110" width="420" height="560" rx="36" fill="${color}" opacity="0.28"/>
    <path d="M210 220h180l28 70v250H182V290z" fill="${color}" opacity="0.55"/>
    <circle cx="300" cy="188" r="28" fill="none" stroke="${color}" stroke-width="10"/>
    <text x="300" y="620" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#1a1a1e">${safe}</text>
    <text x="300" y="656" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" fill="#8a6d2b">GARMENT PLACEHOLDER · UPLOAD A PHOTO TO TRY ON</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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

  g('w-banarasi-saree', 'Banarasi Silk Saree', 'Women', 'Sarees', 'Saree', 'Maroon gold', '$219', 'Woven silk with zari border', 'Classic Banarasi drape for festive evenings.', 'A maroon silk saree with a gold zari border. Upload a flat or mannequin photo of your own saree for AI try-on if this placeholder is showing.', garmentPlaceholder('Banarasi Saree', '#7a1f2b'), WOMEN_SIZES),
  g('w-pastel-saree', 'Pastel Organza Saree', 'Women', 'Sarees', 'Saree', 'Mint', '$159', 'Organza with satin blouse option', 'Airy organza saree in mint.', 'Light organza saree for daytime functions. Pair with a fitted blouse.', garmentPlaceholder('Organza Saree', '#9ec9b0'), WOMEN_SIZES),
  g('w-salwar-navy', 'Navy Salwar Suit', 'Women', 'Salwar suits', 'Salwar suit', 'Navy', '$129', 'Cotton-silk kameez with churidar', 'Straight navy suit with contrast piping.', 'Everyday salwar suit with a straight kameez and churidar.', garmentPlaceholder('Salwar Suit', '#1e3a5f'), WOMEN_SIZES),
  g('w-salwar-rose', 'Rose Printed Salwar Suit', 'Women', 'Salwar suits', 'Salwar suit', 'Rose', '$139', 'Printed viscose', 'Printed rose salwar with dupatta.', 'Soft printed salwar suit with a matching dupatta.', garmentPlaceholder('Printed Salwar', '#c46a86'), WOMEN_SIZES),
  g('w-kurti-white', 'White Chikankari Kurti', 'Women', 'Kurtis', 'Kurti', 'White', '$79', 'Hand-embroidered cotton', 'Lucknowi chikankari kurti.', 'Breathable cotton kurti with chikankari embroidery.', garmentPlaceholder('Chikankari Kurti', '#ece8df'), WOMEN_SIZES),
  g('w-kurti-teal', 'Teal Straight Kurti', 'Women', 'Kurtis', 'Kurti', 'Teal', '$69', 'Rayon, side slits', 'Straight teal kurti for daily wear.', 'Knee-length straight kurti with side slits.', garmentPlaceholder('Teal Kurti', '#2a6f73'), WOMEN_SIZES),
  g('w-anarkali-gold', 'Gold Anarkali Dress', 'Women', 'Anarkali dresses', 'Anarkali', 'Gold', '$249', 'Georgette with gota work', 'Floor-length festive Anarkali.', 'Floor-length Anarkali with a fitted bodice and flared skirt.', garmentPlaceholder('Anarkali', '#c9a96a'), WOMEN_SIZES),
  g('w-anarkali-jade', 'Jade Floor Anarkali', 'Women', 'Anarkali dresses', 'Anarkali', 'Jade', '$229', 'Net overlay', 'Jade Anarkali with net overlay.', 'Statement Anarkali for weddings and receptions.', garmentPlaceholder('Jade Anarkali', '#2f6b57'), WOMEN_SIZES),
  g('w-western-midi', 'Ivory Western Midi Dress', 'Women', 'Western dresses', 'Western dress', 'Ivory', '$149', 'Crepe midi', 'Clean ivory midi with a belt.', 'Western midi dress with a defined waist.', garmentPlaceholder('Midi Dress', '#e7dfd0'), WOMEN_SIZES),
  g('w-shirt-stripe', 'Blue Stripe Shirt', 'Women', 'Shirts', 'Shirt', 'Blue stripe', '$89', 'Cotton poplin', 'Tailored stripe shirt.', 'Point-collar poplin shirt with a slightly cropped hem.', garmentPlaceholder('Stripe Shirt', '#6f8fb4'), WOMEN_SIZES),
  g('w-jeans-indigo', 'High-Rise Indigo Jeans', 'Women', 'Jeans', 'Jeans', 'Indigo', '$99', 'Stretch denim', 'Classic high-rise indigo jean.', 'High-rise straight jeans with a clean hem.', garmentPlaceholder('Indigo Jeans', '#2c3d5a'), WOMEN_SIZES),
  g('w-trousers-stone', 'Stone Wide Trousers', 'Women', 'Trousers', 'Trousers', 'Stone', '$109', 'Wool-blend twill', 'Wide-leg stone trousers.', 'Pressed wide-leg trousers with a high waist.', garmentPlaceholder('Wide Trousers', '#c5b8a4'), WOMEN_SIZES),
  g('w-blazer-black', 'Black Crop Blazer', 'Women', 'Blazers', 'Blazer', 'Black', '$189', 'Structured crepe', 'Cropped black blazer.', 'Sharp cropped blazer for work and evenings.', garmentPlaceholder('Crop Blazer', '#222222'), WOMEN_SIZES),
  g('w-jacket-quilt', 'Ivory Quilted Jacket', 'Women', 'Jackets', 'Jacket', 'Ivory', '$169', 'Light quilted shell', 'Light quilted layering jacket.', 'Lightweight quilted jacket with a stand collar.', garmentPlaceholder('Quilted Jacket', '#ddd4c5'), WOMEN_SIZES),
  g('w-ethnic-lehenga', 'Marigold Ethnic Set', 'Women', 'Ethnic wear', 'Ethnic wear', 'Marigold', '$199', 'Silk blend', 'Festive marigold ethnic set.', 'Coordinated ethnic set for celebrations.', garmentPlaceholder('Ethnic Set', '#d98e2b'), WOMEN_SIZES),
  g('w-party-sequin', 'Sequin Party Top', 'Women', 'Party wear', 'Top', 'Champagne sequin', '$119', 'Hand-applied sequins', 'Evening sequin top.', 'Sleeveless sequin top for parties.', garmentPlaceholder('Sequin Top', '#d4b36a'), WOMEN_SIZES),
  g('w-casual-tee', 'Soft White Casual Tee', 'Women', 'Casual wear', 'Top', 'White', '$39', 'Organic cotton jersey', 'Everyday white tee.', 'Soft crew-neck tee for casual days.', garmentPlaceholder('Casual Tee', '#f2efe8'), WOMEN_SIZES),

  g('m-tee-black', 'Heavyweight Black T-shirt', 'Men', 'T-shirts', 'T-shirt', 'Black', '$45', 'Heavy cotton jersey', 'Thick black crew tee.', 'Heavyweight crew-neck T-shirt with a clean hem.', garmentPlaceholder('Black Tee', '#1a1a1e'), MEN_SIZES),
  g('m-casual-check', 'Olive Check Casual Shirt', 'Men', 'Casual shirts', 'Casual shirt', 'Olive check', '$79', 'Brushed cotton', 'Weekend check shirt.', 'Soft casual shirt with a button-down collar.', garmentPlaceholder('Check Shirt', '#6b6b3a'), MEN_SIZES),
  g('m-formal-sky', 'Sky Formal Shirt', 'Men', 'Formal shirts', 'Formal shirt', 'Sky blue', '$95', 'Non-iron poplin', 'Office sky-blue shirt.', 'Formal shirt with a structured collar and French placket.', garmentPlaceholder('Formal Shirt', '#9bb8d3'), MEN_SIZES),
  g('m-jeans-raw', 'Raw Indigo Jeans', 'Men', 'Jeans', 'Jeans', 'Raw indigo', '$119', 'Selvedge denim', 'Straight raw indigo jean.', 'Straight-leg jeans with a classic rise.', garmentPlaceholder('Mens Jeans', '#24344c'), MEN_SIZES),
  g('m-trousers-char', 'Charcoal Dress Trousers', 'Men', 'Trousers', 'Trousers', 'Charcoal', '$129', 'Wool blend', 'Tailored charcoal trousers.', 'Pressed dress trousers with belt loops.', garmentPlaceholder('Dress Trousers', '#3c3c42'), MEN_SIZES),
  g('m-suit-navy', 'Navy Two-Piece Suit', 'Men', 'Suits', 'Suit', 'Navy', '$399', 'Wool suiting', 'Navy two-piece suit.', 'Single-breasted navy suit for work and events.', garmentPlaceholder('Navy Suit', '#1c2b4a'), MEN_SIZES),
  g('m-hoodie-grey', 'Heather Grey Hoodie', 'Men', 'Hoodies', 'Hoodie', 'Heather grey', '$89', 'Brushed fleece', 'Everyday grey hoodie.', 'Kangaroo-pocket hoodie with a lined hood.', garmentPlaceholder('Grey Hoodie', '#b7b7b4'), MEN_SIZES),
  g('m-jacket-bomber', 'Black Bomber Jacket', 'Men', 'Jackets', 'Jacket', 'Black', '$159', 'Nylon bomber', 'Classic black bomber.', 'Rib-hem bomber jacket with a zip front.', garmentPlaceholder('Bomber', '#111111'), MEN_SIZES),
  g('m-kurta-ivory', 'Ivory Cotton Kurta', 'Men', 'Kurtas', 'Kurta', 'Ivory', '$79', 'Handloom cotton', 'Straight ivory kurta.', 'Knee-length cotton kurta with a mandarin collar.', garmentPlaceholder('Ivory Kurta', '#efe6d6'), MEN_SIZES),
  g('m-traditional-sherwani', 'Midnight Sherwani', 'Men', 'Traditional wear', 'Traditional wear', 'Midnight', '$349', 'Brocade', 'Festive midnight sherwani.', 'Traditional sherwani for ceremonies.', garmentPlaceholder('Sherwani', '#1b2436'), MEN_SIZES),
  g('m-sport-track', 'Navy Sports Track Jacket', 'Men', 'Sportswear', 'Sportswear', 'Navy', '$99', 'Performance knit', 'Navy track jacket.', 'Lightweight sports jacket with contrast piping.', garmentPlaceholder('Track Jacket', '#24365a'), MEN_SIZES),
  g('m-party-satin', 'Black Satin Party Shirt', 'Men', 'Party wear', 'Casual shirt', 'Black', '$109', 'Satin viscose', 'Evening satin shirt.', 'Relaxed party shirt with a sheen finish.', garmentPlaceholder('Party Shirt', '#2a2a2a'), MEN_SIZES),

  g('k-boys-tee', "Boys' Graphic T-shirt", 'Kids', 'Boys T-shirts', 'T-shirt', 'Blue', '$24', 'Cotton jersey', "Boys' everyday tee.", 'Soft crew-neck T-shirt for play.', garmentPlaceholder("Boys' Tee", '#4d7ea8'), KIDS_SIZES),
  g('k-boys-shirt', "Boys' Oxford Shirt", 'Kids', 'Boys shirts', 'Shirt', 'White', '$34', 'Cotton oxford', "Boys' collared shirt.", 'Button-down oxford for school and events.', garmentPlaceholder("Boys' Shirt", '#f3f0ea'), KIDS_SIZES),
  g('k-boys-trousers', "Boys' Chino Trousers", 'Kids', 'Boys trousers', 'Trousers', 'Khaki', '$36', 'Cotton twill', "Boys' khaki chinos.", 'Adjustable-waist chino trousers.', garmentPlaceholder("Boys' Trousers", '#c4ae86'), KIDS_SIZES),
  g('k-boys-shorts', "Boys' Twill Shorts", 'Kids', 'Boys shorts', 'Shorts', 'Navy', '$28', 'Cotton twill', "Boys' navy shorts.", 'Knee-length shorts with an elastic back.', garmentPlaceholder("Boys' Shorts", '#2d3f66'), KIDS_SIZES),
  g('k-girls-frock', "Girls' Party Frock", 'Kids', 'Girls frocks', 'Frock', 'Blush', '$44', 'Cotton voile', "Girls' blush frock.", 'Sleeveless frock with a twirl skirt.', garmentPlaceholder("Girls' Frock", '#e7b7c2'), KIDS_SIZES),
  g('k-girls-top', "Girls' Peplum Top", 'Kids', 'Girls tops', 'Top', 'Lilac', '$26', 'Cotton poplin', "Girls' peplum top.", 'Short-sleeve peplum top.', garmentPlaceholder("Girls' Top", '#c9b4dc'), KIDS_SIZES),
  g('k-girls-skirt', "Girls' Pleated Skirt", 'Kids', 'Girls skirts', 'Skirt', 'Navy', '$29', 'School-weight fabric', "Girls' pleated skirt.", 'Knife-pleat skirt with an elastic waist.', garmentPlaceholder("Girls' Skirt", '#2a3550'), KIDS_SIZES),
  g('k-ethnic', "Kids' Ethnic Kurta Set", 'Kids', 'Kids ethnic wear', 'Ethnic wear', 'Cream', '$49', 'Cotton silk blend', 'Kids festive kurta set.', 'Kurta and bottom set for festivals.', garmentPlaceholder('Kids Ethnic', '#ead9b2'), KIDS_SIZES),
  g('k-uniform', 'School Uniform Set', 'Kids', 'School uniforms', 'School uniform', 'White/navy', '$54', 'Easy-care poly-cotton', 'Shirt and bottom uniform set.', 'School uniform shirt with matching bottom.', garmentPlaceholder('School Uniform', '#3d4f7c'), KIDS_SIZES),
  g('k-baby', 'Baby Romper', 'Kids', 'Baby clothing', 'Baby clothing', 'Cloud', '$22', 'Organic jersey', 'Soft baby romper.', 'Snap-crotch romper for infants.', garmentPlaceholder('Baby Romper', '#d9e4ee'), ['0–3M', '3–6M', '6–12M', '12–18M']),

  g('u-oversize-tee', 'Oversized Heavy T-shirt', 'Unisex', 'Oversized T-shirts', 'Oversized T-shirt', 'Bone', '$49', 'Heavy cotton', 'Boxy oversized tee.', 'Dropped-shoulder oversized T-shirt.', garmentPlaceholder('Oversized Tee', '#e4ddd0'), UNI_SIZES),
  g('u-hoodie', 'Unisex Zip Hoodie', 'Unisex', 'Hoodies', 'Hoodie', 'Charcoal', '$99', 'Fleece', 'Charcoal zip hoodie.', 'Full-zip hoodie with a roomy hood.', garmentPlaceholder('Zip Hoodie', '#4a4a4a'), UNI_SIZES),
  g('u-sweat', 'Crew Sweatshirt', 'Unisex', 'Sweatshirts', 'Sweatshirt', 'Sand', '$89', 'Loopback cotton', 'Sand crew sweatshirt.', 'Classic crew-neck sweatshirt.', garmentPlaceholder('Sweatshirt', '#d4c4a8'), UNI_SIZES),
  g('u-sport', 'Unisex Sports Set', 'Unisex', 'Sportswear', 'Sportswear', 'Black', '$119', 'Stretch knit', 'Black sports set.', 'Matching top and bottom for training.', garmentPlaceholder('Sportswear', '#2b2b2b'), UNI_SIZES),
  g('u-casual', 'Unisex Casual Overshirt', 'Unisex', 'Casual wear', 'Jacket', 'Stone', '$109', 'Washed twill', 'Stone overshirt.', 'Lightweight overshirt for layering.', garmentPlaceholder('Overshirt', '#c2b39a'), UNI_SIZES),
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
