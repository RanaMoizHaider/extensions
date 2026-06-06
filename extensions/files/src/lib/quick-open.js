import { basename, entry_to_rel, open_in_editor } from "@/lib/files";

// Cap how much of the tree we walk so very large repos stay responsive.
const MAX_FILES = 5000;
const MAX_DEPTH = 12;

// Directories that never hold files worth opening; skipping them keeps the
// walk fast and the picker free of noise.
const SKIP_DIRS = new Set([".git", "node_modules", ".svn", ".hg"]);

// Walk the tree breadth-first, listing all directories at one depth
// concurrently. A depth-first sequential walk pays one round-trip per
// directory in series, which is what made the modal open late on large repos.
async function collect_files() {
  const files = [];
  let frontier = [""];
  let depth = 0;

  while (frontier.length > 0 && depth <= MAX_DEPTH && files.length < MAX_FILES) {
    const listings = await Promise.all(
      frontier.map((dirRel) => muxy.files.list(dirRel).catch(() => []))
    );

    const next = [];
    for (const entries of listings) {
      for (const entry of entries) {
        if (entry.isIgnored) continue;
        const rel = entry_to_rel(entry);
        if (entry.isDirectory) {
          if (!SKIP_DIRS.has(entry.name)) next.push(rel);
        } else if (files.length < MAX_FILES) {
          files.push(rel);
        }
      }
    }

    frontier = next;
    depth += 1;
  }

  return { files, truncated: files.length >= MAX_FILES };
}

// Module-level cache so a second ⌘P opens instantly. Invalidated whenever the
// workspace changes on disk or the active project/worktree switches.
let cache = null;
let inflight = null;

async function get_index() {
  if (cache) return cache;
  if (!inflight) {
    inflight = collect_files()
      .then((result) => {
        cache = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Drop the cache (and re-prime it) — call on file.changed / worktree switch.
// Debounced so a burst of changes (npm install, branch switch) rebuilds once.
let rewarm_timer = null;
export function invalidate_quick_find() {
  cache = null;
  if (rewarm_timer !== null) clearTimeout(rewarm_timer);
  rewarm_timer = setTimeout(() => {
    rewarm_timer = null;
    void get_index().catch(() => undefined);
  }, 500);
}

// Build the index ahead of the first ⌘P so the modal opens with no wait.
export function prewarm_quick_find() {
  void get_index().catch(() => undefined);
}

function to_items(rels) {
  const sorted = rels
    .slice()
    .sort((a, b) => basename(a).localeCompare(basename(b), undefined, { sensitivity: "base" }));
  return sorted.slice(0, 1000).map((rel) => {
    const idx = rel.lastIndexOf("/");
    return { id: rel, title: basename(rel), subtitle: idx === -1 ? undefined : rel.slice(0, idx) };
  });
}

let opening = false;

// Present the native Quick Open modal and open the chosen file in the editor
// tab. Uses the cached index when available; otherwise builds it on demand.
export async function open_quick_find() {
  if (opening) return;
  opening = true;
  try {
    const { files, truncated } = await get_index();

    if (files.length === 0) {
      await muxy
        .toast({ title: "Quick Open", body: "No files found", variant: "info" })
        .catch(() => undefined);
      return;
    }

    const choice = await muxy.modal.open({
      placeholder: "Go to file…",
      emptyLabel: "No files",
      noMatchLabel: "No matching files",
      items: to_items(files),
    });

    if (truncated) {
      await muxy
        .toast({ title: "Quick Open", body: `Showing first ${MAX_FILES} files`, variant: "info" })
        .catch(() => undefined);
    }

    if (choice) await open_in_editor(choice.id);
  } catch (err) {
    await muxy
      .toast({
        title: "Quick Open",
        body: err instanceof Error ? err.message : String(err),
        variant: "error",
      })
      .catch(() => undefined);
  } finally {
    opening = false;
  }
}
