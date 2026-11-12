import type { PulseDbClient } from "@repo/database";
import {
  shouldAutoActivateOnActivity,
  type ProjectBusinessStatus,
} from "@repo/shared";

export interface ProjectLifecycleSnapshot {
  businessStatus: ProjectBusinessStatus;
  tags?: readonly string[];
}

export interface ProjectActivityUpdatePatch {
  businessStatus?: ProjectBusinessStatus;
  tags?: string[];
  lastActivityTime: string;
}

/**
 * Computes the column patch to apply to a Project row when a team member or
 * administrator performs an active mutation (chat, scrape, context edit,
 * checklist scan/toggle, profile/logo edit).
 *
 * - Projects in `"new"` automatically transition to `"active"` (and strip the
 *   temporary `"new"` tag).
 * - Projects in `"active"` or any manually managed progress state (`contacted`,
 *   `collaborated`, `completed`, `unresponsive`, `archived`) retain their
 *   existing state.
 * - Read-only views (`findAll`, `findOne`, `markAsRead`) must NOT call this.
 */
export function computeActivatedProjectPatch(
  project: ProjectLifecycleSnapshot,
  lastActivityTime = "Just now"
): ProjectActivityUpdatePatch {
  if (!shouldAutoActivateOnActivity(project.businessStatus)) {
    return { lastActivityTime };
  }

  return {
    businessStatus: "active",
    ...(project.tags
      ? { tags: project.tags.filter((tag) => tag !== "new") }
      : {}),
    lastActivityTime,
  };
}

/**
 * Loads the project's current status/tags and promotes `"new"` -> `"active"`.
 * No-ops safely if the project is already in `"active"` or another state.
 */
export async function activateProjectOnActivity(
  orm: PulseDbClient["orm"],
  projectId: string,
  lastActivityTime = "Just now"
): Promise<void> {
  const existing = await orm.public.Project.select(
    "id",
    "businessStatus",
    "tags"
  )
    .where({ id: projectId })
    .first();

  if (!existing) {
    return;
  }

  const patch = computeActivatedProjectPatch(existing, lastActivityTime);
  await orm.public.Project.where({ id: projectId }).update(patch);
}
