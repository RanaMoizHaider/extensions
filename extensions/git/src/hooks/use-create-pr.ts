import { useCallback } from "react";
import { alert_error, confirm_action, error_message, open_url } from "@/lib/git";
import { run_pinned } from "@/lib/git-scope";
import { commit_all, has_pending_changes } from "@/lib/git-commit";
import { create_pr } from "@/lib/git-prs";

export interface CreatePrInput {
  title: string;
  body: string;
  baseBranch?: string;
  newBranch?: string;
  draft?: boolean;
}

function existing_pr_url(err: unknown): string | null {
  const message = error_message(err);
  if (!/already exists/i.test(message)) return null;
  const match = message.match(/https?:\/\/\S+/);
  return match ? match[0].replace(/[.,)\]]+$/, "") : null;
}

export function use_create_pr(refreshGit: () => Promise<void>) {
  return useCallback(
    async (input: CreatePrInput) => {
      try {
        return await run_pinned(async (project) => {
          if (input.newBranch) {
            await muxy.git.branch.create({ name: input.newBranch, project });
          }

          if (await has_pending_changes(project)) {
            const committed = await commit_all(input.title, project);
            if (!committed) return false;
          }

          await muxy.git.push({ setUpstream: true, project });

          await create_pr(input.title, input.body, input.baseBranch, input.draft ?? false, project);
          await refreshGit();
          return true;
        });
      } catch (err) {
        const url = existing_pr_url(err);
        if (url) {
          const open = await confirm_action({
            title: "Pull request already exists",
            message: "A pull request for this branch already exists. Open it?",
            confirmLabel: "Open PR",
          });
          if (open) open_url(url);
          await refreshGit();
          return false;
        }
        await alert_error("Could not create pull request", err);
        return false;
      }
    },
    [refreshGit],
  );
}
