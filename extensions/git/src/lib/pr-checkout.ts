import { active_worktree_path } from "@/lib/git";

export function checkout_pr(number: number, project?: string): Promise<void> {
  return muxy.git.pr.checkout({ number, project });
}

export async function suggest_worktree_path(number: number): Promise<string> {
  const base = await active_worktree_path();
  const parent = base ? base.replace(/\/+$/, "").replace(/\/[^/]+$/, "") : "";
  const name = `pr-${number}`;
  return parent ? `${parent}/${name}` : name;
}

export async function checkout_pr_worktree(number: number, project?: string): Promise<string | null> {
  const suggested = await suggest_worktree_path(number);
  const path = await prompt_path(number, suggested);
  if (!path) return null;
  const { branch } = await muxy.git.pr.checkoutWorktree({ number, path, project });
  await muxy.worktrees.refresh().catch(() => undefined);
  await muxy.git.worktree.switchTo({ identifier: path }).catch(() => undefined);
  return branch;
}

async function prompt_path(number: number, suggested: string): Promise<string | null> {
  const res = await muxy.exec({
    shell: `osascript -e 'set r to text returned of (display dialog "Worktree path for PR #${number}" default answer "${suggested}" with title "Checkout to Worktree")' 2>/dev/null`,
  }).catch(() => null);
  if (!res || res.exitCode !== 0) return null;
  const path = res.stdout.trim();
  return path || null;
}
