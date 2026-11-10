/** Raw, messy catalog of the Ridgeline Coffee Roasters demo store (what a real small shop often has). */
export interface Product {
  sku: string;
  title: string;
  description: string;
  price: string;
  currency: 'USD';
  attributes: Record<string, string>;
  inStock: boolean;
}

const p = (sku: string, title: string, description: string, price: string): Product => ({
  sku, title, description, price, currency: 'USD', attributes: {}, inStock: true,
});

export const RIDGELINE_RAW_CATALOG: Product[] = [
  p('RC-HB12', 'HB12 hse blend 12oz WHL BN', 'our everyday. choc, nutty. med', '18.00'),
  p('RC-ETH12', 'ETH YIRG 12OZ - NAT', 'nat process, berry, floral. lt roast', '22.00'),
  p('RC-COL12', 'COL HUILA 12oz', 'caramel red apple washed med', '20.00'),
  p('RC-DEC12', 'DECAF SWP 12OZ', 'swiss water. no caff. med-dk', '19.00'),
  p('RC-ESP2', 'ESPR BLND 2LB', 'espresso blnd, dark, 2lb bag cafe size', '38.00'),
  p('RC-KIT1', 'pourover kit v2 (glass)', 'dripper + 100 filters + scoop', '24.00'),
];
