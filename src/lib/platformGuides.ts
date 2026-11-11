/** Store builders Lintel knows, with exactly where each keeps its product export and custom code. */
export type PlatformId = 'shopify' | 'woocommerce' | 'wix' | 'squarespace' | 'bigcommerce' | 'webflow' | 'other';

export interface PlatformGuide {
  id: PlatformId;
  label: string;
  /** One-click import Lintel can do without a file. */
  autoImport?: { source: 'shopify' | 'woocommerce' | 'sitemap'; label: string; note: string }[];
  /** Where to download a product CSV. */
  exportSteps: string[];
  /** Where to paste the snippet into the page head. */
  snippetSteps: string[];
}

export const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    id: 'shopify', label: 'Shopify',
    autoImport: [{ source: 'shopify', label: 'Import from Shopify', note: 'Reads your public product list. Takes a few seconds.' }],
    exportSteps: ['In Shopify admin, open Products.', 'Click Export, choose All products and CSV for Excel, numbers or other spreadsheet programs.', 'Upload the file here.'],
    snippetSteps: ['In Shopify admin, open Online Store, then Themes.', 'Next to your live theme, click the ⋯ menu, then Edit code.', 'Open layout/theme.liquid and paste the snippet just above </head>.', 'Click Save.'],
  },
  {
    id: 'woocommerce', label: 'WooCommerce',
    autoImport: [{ source: 'woocommerce', label: 'Import from WooCommerce', note: 'Reads your store’s public product feed.' }],
    exportSteps: ['In WordPress, open Products, then All Products.', 'Click Export at the top, keep all columns, and click Generate CSV.', 'Upload the file here.'],
    snippetSteps: ['In WordPress, install the free plugin “WPCode” (Plugins, Add New).', 'Open Code Snippets, then Header & Footer.', 'Paste the snippet into Header and click Save Changes.'],
  },
  {
    id: 'wix', label: 'Wix',
    exportSteps: ['In your Wix dashboard, open Catalog, then Store Products.', 'Click More Actions, then Export, and choose All products.', 'Upload the file here.'],
    snippetSteps: ['In your Wix dashboard, open Settings, then Custom Code (under Advanced).', 'Click + Add Custom Code and paste the snippet.', 'Choose All pages, Load code once, Place code in Head, then click Apply.'],
  },
  {
    id: 'squarespace', label: 'Squarespace',
    exportSteps: ['In Squarespace, open Commerce, then Inventory.', 'Click the ⋯ menu, then Export all.', 'Upload the file here.'],
    snippetSteps: ['In Squarespace, open Settings, then Developer Tools, then Code Injection.', 'Paste the snippet into Header.', 'Click Save.'],
  },
  {
    id: 'bigcommerce', label: 'BigCommerce',
    exportSteps: ['In BigCommerce, open Products, then Export.', 'Choose the Default template and click Continue, then Export to CSV.', 'Upload the file here.'],
    snippetSteps: ['In BigCommerce, open Storefront, then Script Manager.', 'Click Create a Script, set Location to Head and Pages to All pages.', 'Choose Script type Script, paste the snippet, and click Save.'],
  },
  {
    id: 'webflow', label: 'Webflow',
    exportSteps: ['In Webflow, open the Ecommerce panel, then Products.', 'Click the export icon to download a CSV.', 'Upload the file here.'],
    snippetSteps: ['In Webflow, open Site settings, then Custom code.', 'Paste the snippet into Head code and click Save.', 'Publish your site.'],
  },
  {
    id: 'other', label: 'Something else',
    autoImport: [{ source: 'sitemap', label: 'Find products on my site', note: 'Follows your sitemap to product pages and reads their product data.' }],
    exportSteps: ['Export your products as a CSV from your shop system, or fill in our template.', 'Columns needed: sku, title, price. Optional: description, in_stock.', 'Upload the file here.'],
    snippetSteps: ['Open the HTML template that every page of your store uses.', 'Paste the snippet just above </head>.', 'Publish the change.'],
  },
];

export const guideFor = (id: string | null | undefined) => PLATFORM_GUIDES.find((g) => g.id === id) ?? null;

export const CSV_TEMPLATE = 'sku,title,description,price,in_stock\nKEN-12,Kenya AA whole bean 12 oz,Bright and juicy,21.00,yes\nMUG-1,Stoneware mug,,12.00,no\n';
