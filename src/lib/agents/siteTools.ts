/**
 * Runs inside the agent's browser page (passed to page.evaluate), so each function is
 * self-contained: no imports, no outer variables.
 *
 * Pages can expose tools three ways: Lintel's own registry (window.__lintel), Chrome's
 * built-in WebMCP (document.modelContext, where executeTool takes the RegisteredTool object
 * from getTools), or a name-based polyfill of the same interface.
 */

export async function invokeSiteTool([name, args]: readonly [string, unknown]): Promise<unknown> {
  const w = window as any;
  const d = document as any;
  const parse = (r: unknown) => {
    if (typeof r !== 'string') return r;
    try { return JSON.parse(r); } catch { return r; }
  };
  try {
    if (w.__lintel?.call) return parse(await w.__lintel.call(name, args));
    const mc = d.modelContext;
    if (!mc?.executeTool) return { error: 'This page has no site tools.' };
    const tools: any[] = mc.getTools ? ((await mc.getTools()) ?? []) : [];
    const tool = tools.find((t) => t?.name === name);
    if (mc.getTools && !tool) return { error: `No tool named ${name}` };
    try {
      return parse(await mc.executeTool(name, args));
    } catch (e) {
      // Chrome's built-in API wants the RegisteredTool object, not its name.
      if (tool && /RegisteredTool|not of type/i.test(String((e as Error)?.message ?? e))) return parse(await mc.executeTool(tool, args));
      throw e;
    }
  } catch (e) {
    return { error: String((e as Error)?.message ?? e) };
  }
}

export async function listSiteTools(): Promise<{ name: string; description: string; inputSchema?: unknown }[]> {
  const w = window as any;
  const d = document as any;
  const raw: any[] = w.__lintel?.tools ?? (d.modelContext?.getTools ? ((await d.modelContext.getTools()) ?? []) : []);
  return raw.map((t) => ({ name: String(t.name), description: String(t.description ?? ''), ...(t.inputSchema ? { inputSchema: t.inputSchema } : {}) }));
}
