export async function active_project(): Promise<string | undefined> {
  try {
    const projects = await muxy.projects.list();
    return projects.find((p) => p.isActive)?.path ?? projects[0]?.path;
  } catch {
    return undefined;
  }
}

let depth = 0;
const listeners = new Set<(busy: boolean) => void>();

export function is_busy(): boolean {
  return depth > 0;
}

export function on_busy_change(fn: (busy: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set_depth(next: number): void {
  const was = depth > 0;
  depth = next;
  const now = depth > 0;
  if (was !== now) for (const fn of listeners) fn(now);
}

export async function run_pinned<T>(fn: (project?: string) => Promise<T>): Promise<T> {
  const project = await active_project();
  set_depth(depth + 1);
  try {
    return await fn(project);
  } finally {
    set_depth(depth - 1);
  }
}
