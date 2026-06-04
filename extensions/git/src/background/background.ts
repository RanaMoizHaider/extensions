type Ok<T> = { ok: true; value: T };
type Err = { ok: false };
type Result<T> = Ok<T> | Err;

const RETRY_DELAYS = [1000, 3000, 8000, 20000];

let last_branch: string | null = null;
let retry_timer: ReturnType<typeof setTimeout> | null = null;
let retry_attempt = 0;

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch {
    return { ok: false };
  }
}

function set_item(id: string, text: string): void {
  void Promise.resolve(muxy.statusbar.set({ id, text, visible: true })).catch(() => undefined);
}

function hide_item(id: string): void {
  void Promise.resolve(muxy.statusbar.hide(id)).catch(() => undefined);
}

function clear_retry(): void {
  if (retry_timer === null) return;
  clearTimeout(retry_timer);
  retry_timer = null;
  retry_attempt = 0;
}

function schedule_retry(fresh: boolean): void {
  if (retry_timer !== null) return;
  const delay = RETRY_DELAYS[Math.min(retry_attempt, RETRY_DELAYS.length - 1)];
  retry_attempt += 1;
  retry_timer = setTimeout(() => {
    retry_timer = null;
    void sync_items(fresh);
  }, delay);
}

async function sync_items(fresh = false): Promise<void> {
  const repo = await attempt(() => muxy.git.repoInfo({ fresh }));
  if (!repo.ok) {
    schedule_retry(fresh);
    return;
  }

  const currentBranch = repo.value.currentBranch;
  last_branch = currentBranch;

  if (!currentBranch) {
    clear_retry();
    hide_item("branch");
    hide_item("pr-info");
    return;
  }

  set_item("branch", currentBranch);

  const pr = await attempt(() => muxy.git.pr.number({ fresh }));
  if (!pr.ok) {
    schedule_retry(fresh);
    return;
  }

  clear_retry();
  if (pr.value) set_item("pr-info", `#${pr.value}`);
  else hide_item("pr-info");
}

function is_ref_change(payload: unknown): boolean {
  const path = (payload as { path?: string } | null)?.path ?? "";
  return /\/\.git\/(HEAD|packed-refs|refs\/)/.test(path);
}

async function on_ref_change(payload: unknown): Promise<void> {
  if (!is_ref_change(payload)) return;
  const repo = await attempt(() => muxy.git.repoInfo({ fresh: true }));
  if (!repo.ok) {
    schedule_retry(true);
    return;
  }
  if (repo.value.currentBranch !== last_branch) void sync_items(true);
}

function refresh(): void {
  clear_retry();
  void sync_items(true);
}

void sync_items();
muxy.events.subscribe("project.switched", refresh);
muxy.events.subscribe("worktree.switched", refresh);
muxy.events.subscribe("file.changed", (payload) => void on_ref_change(payload));
