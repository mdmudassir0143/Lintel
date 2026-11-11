// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { invokeSiteTool, listSiteTools } from '@/lib/agents/siteTools';

const w = window as any;
const d = document as any;

beforeEach(() => { delete w.__lintel; delete d.modelContext; });

/** Chrome's built-in WebMCP: executeTool takes the RegisteredTool object, never a name. */
function nativeModelContext(tools: { name: string; description: string; run: (a: any) => any }[]) {
  const registered = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: {} }));
  return {
    getTools: async () => registered,
    executeTool: async (tool: unknown, input: any) => {
      if (typeof tool === 'string') throw new TypeError("Failed to execute 'executeTool' on 'ModelContext': The provided value is not of type 'RegisteredTool'.");
      const t = tools.find((x) => x.name === (tool as any).name)!;
      return t.run(input);
    },
  };
}

describe('site tools in the page', () => {
  it('calls Chrome’s built-in WebMCP with the tool object, not its name', async () => {
    d.modelContext = nativeModelContext([{ name: 'search_products', description: 'search', run: (a) => ({ products: [a.query] }) }]);
    expect(await invokeSiteTool(['search_products', { query: 'ethiopian' }])).toEqual({ products: ['ethiopian'] });
    expect(await listSiteTools()).toEqual([{ name: 'search_products', description: 'search', inputSchema: {} }]);
  });

  it('prefers the store’s own Lintel registry when present', async () => {
    d.modelContext = nativeModelContext([]);
    w.__lintel = { call: async (n: string, a: any) => ({ via: 'lintel', n, a }), tools: [{ name: 'view_cart', description: 'cart' }] };
    expect(await invokeSiteTool(['view_cart', {}])).toEqual({ via: 'lintel', n: 'view_cart', a: {} });
  });

  it('works with a name-based shim and reports unknown tools and pages without tools', async () => {
    d.modelContext = { getTools: () => [{ name: 'a', description: '' }], executeTool: async (n: string) => ({ ran: n }) };
    expect(await invokeSiteTool(['a', {}])).toEqual({ ran: 'a' });
    delete d.modelContext;
    expect(await invokeSiteTool(['a', {}])).toEqual({ error: 'This page has no site tools.' });
    d.modelContext = nativeModelContext([]);
    expect(await invokeSiteTool(['nope', {}])).toEqual({ error: 'No tool named nope' });
  });
});
