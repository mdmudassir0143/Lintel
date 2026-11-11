/**
 * The color roles defined in globals.css (@theme), with what each is for.
 * Components use roles only (bg-surface, text-muted, bg-brand…), never palette values.
 * The /brand page renders this list and reads each value live from the stylesheet.
 */
export type Role = { name: string; usage: string; onDark?: boolean };

export const ROLE_GROUPS: { title: string; note: string; roles: Role[] }[] = [
  {
    title: 'Surfaces',
    note: 'Backgrounds from the page down to the smallest chip.',
    roles: [
      { name: 'canvas', usage: 'Marketing page background' },
      { name: 'subtle', usage: 'App background, alternating sections' },
      { name: 'subtle-strong', usage: 'Inline code, skeletons, hovered rows' },
      { name: 'surface', usage: 'Panels, cards, inputs' },
      { name: 'line', usage: 'Borders and dividers' },
      { name: 'line-strong', usage: 'Input and secondary button borders' },
    ],
  },
  {
    title: 'Text',
    note: 'Three steps of emphasis. Never lighter than muted for anything people must read.',
    roles: [
      { name: 'ink', usage: 'Headings and primary text' },
      { name: 'soft', usage: 'Long body copy' },
      { name: 'muted', usage: 'Secondary text, labels, captions' },
    ],
  },
  {
    title: 'Brand',
    note: 'Electric blue marks what you can act on, and every stone that holds the door open.',
    roles: [
      { name: 'brand', usage: 'Primary buttons, links, passing stones, good scores' },
      { name: 'brand-hover', usage: 'Hover and pressed state of brand' },
      { name: 'brand-ink', usage: 'Brand text on brand-wash' },
      { name: 'brand-wash', usage: 'Highlighted and live states' },
      { name: 'brand-soft', usage: 'Selected rows, soft fills' },
      { name: 'brand-bright', usage: 'Brand on night backgrounds', onDark: true },
    ],
  },
  {
    title: 'Night',
    note: 'Deep navy for the payments story, code, and the doorway posts.',
    roles: [
      { name: 'night', usage: 'Dark sections, code blocks, doorway posts', onDark: true },
      { name: 'night-raised', usage: 'Panels on night', onDark: true },
      { name: 'night-line', usage: 'Borders on night', onDark: true },
      { name: 'accent', usage: 'Highlights on night, such as the scheme name', onDark: true },
    ],
  },
  {
    title: 'Status',
    note: 'Only for state. Each has a wash for backgrounds and a strong tone for text and dots.',
    roles: [
      { name: 'success', usage: 'Passed checks, paid orders' },
      { name: 'success-wash', usage: 'Background of success states' },
      { name: 'warning', usage: 'Waiting for approval, partial checks' },
      { name: 'warning-wash', usage: 'Background of warning states' },
      { name: 'danger', usage: 'Failed checks, errors' },
      { name: 'danger-wash', usage: 'Background of danger states' },
    ],
  },
  {
    title: 'PayPal',
    note: 'PayPal’s own colors, used only on the Approve in PayPal button.',
    roles: [
      { name: 'paypal', usage: 'Approve in PayPal button' },
      { name: 'paypal-ink', usage: 'Text on the PayPal button', onDark: true },
    ],
  },
];

export const PALETTE: { name: string; steps: string[] }[] = [
  { name: 'blue', steps: ['50', '100', '300', '500', '600', '700'] },
  { name: 'navy', steps: ['700', '800', '900', '950'] },
  { name: 'teal', steps: ['50', '400', '700'] },
  { name: 'slate', steps: ['0', '50', '100', '200', '300', '500', '600'] },
  { name: 'amber', steps: ['50', '700'] },
  { name: 'red', steps: ['50', '600'] },
];
