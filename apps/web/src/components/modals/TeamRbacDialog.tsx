"use client";

import React, { useId, useState, type RefObject } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  History,
  LayoutDashboard,
  Lock,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X as XIcon,
} from "lucide-react";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  USER_ROLE_META,
  createUserDtoSchema,
  hasPermission,
  type AuditLogItem,
  type AuthUser,
  type CreateUserDto,
  type UserRole,
} from "@/types/project";
import { ModalDialog } from "@/components/ui";

interface TeamRbacDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  currentUser: AuthUser;
  users: AuthUser[];
  auditLogs: AuditLogItem[];
  onCreateUser: (input: CreateUserDto) => Promise<unknown>;
  onUpdateUserRole: (params: {
    userId: string;
    role: UserRole;
  }) => Promise<unknown>;
  onUpdateUserStatus: (params: {
    userId: string;
    isActive: boolean;
  }) => Promise<unknown>;
  onDeleteUser: (userId: string) => Promise<unknown>;
  isMutating?: boolean;
}

export function TeamRbacDialog({
  dialogRef,
  currentUser,
  users,
  auditLogs,
  onCreateUser,
  onUpdateUserRole,
  onUpdateUserStatus,
  onDeleteUser,
  isMutating = false,
}: TeamRbacDialogProps) {
  const canReadUsers = hasPermission(currentUser, "users:read");
  const canWriteUsers = hasPermission(currentUser, "users:write");

  const [activeTab, setActiveTab] = useState<"members" | "matrix" | "audit">(
    canReadUsers ? "members" : "matrix"
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const nameId = useId();
  const emailId = useId();
  const titleId = useId();
  const passwordId = useId();
  const rolePrefixId = useId();

  const createForm = useForm<CreateUserDto>({
    resolver: zodResolver(createUserDtoSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "analyst",
      title: "",
    },
  });

  const handleCreateSubmit = createForm.handleSubmit(async (values) => {
    setActionError(null);
    try {
      await onCreateUser(values);
      createForm.reset({
        name: "",
        email: "",
        password: "",
        role: "analyst",
        title: "",
      });
      setShowCreateForm(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create user."
      );
    }
  });

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setActionError(null);
    try {
      await onUpdateUserRole({ userId, role });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update role."
      );
    }
  };

  const handleStatusToggle = async (userId: string, isActive: boolean) => {
    setActionError(null);
    try {
      await onUpdateUserStatus({ userId, isActive });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user status."
      );
    }
  };

  const handleDelete = async (userId: string) => {
    setActionError(null);
    try {
      await onDeleteUser(userId);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove user."
      );
    }
  };

  return (
    <ModalDialog
      dialogRef={dialogRef}
      title="Team & RBAC Access Control"
      subtitle={`Signed in as ${currentUser.name} (${USER_ROLE_META[currentUser.role].label})`}
      maxWidthClass="max-w-3xl"
    >
      <div className="mt-4 space-y-4">
        {/* Current User Active Session Summary Banner */}
        <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] p-3.5 border border-[#e4e6eb] dark:border-[#2a3942] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full ${currentUser.avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0`}
            >
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold truncate">
                  {currentUser.name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    USER_ROLE_META[currentUser.role].badgeClass
                  }`}
                >
                  {USER_ROLE_META[currentUser.role].label}
                </span>
              </div>
              <p className="text-xs text-[#65676b] dark:text-[#8696a0] truncate">
                {currentUser.email} · {currentUser.permissions.length} active
                permissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {canWriteUsers && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0084ff] hover:bg-[#0073e6] text-white text-[11px] font-semibold transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Open Admin Dashboard</span>
              </Link>
            )}
            {currentUser.permissions.slice(0, 3).map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 rounded bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] text-[10px] font-mono text-[#050505] dark:text-[#d1d7db]"
              >
                {perm}
              </span>
            ))}
            {currentUser.permissions.length > 3 && (
              <span className="text-[11px] font-medium text-[#65676b] dark:text-[#8696a0]">
                +{currentUser.permissions.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-[#e4e6eb] dark:border-[#2a3942] pb-2.5 overflow-x-auto">
          {canReadUsers && (
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "members"
                  ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                  : "text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Members ({users.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "matrix"
                ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                : "text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>RBAC Permission Matrix</span>
          </button>

          {canReadUsers && (
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "audit"
                  ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                  : "text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Security Audit Log ({auditLogs.length})</span>
            </button>
          )}
        </div>

        {/* Live Error Banner */}
        <div aria-live="polite">
          {actionError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium"
            >
              {actionError}
            </div>
          )}
        </div>

        {/* Tab 1: Team Members */}
        {activeTab === "members" && canReadUsers && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                {canWriteUsers
                  ? "Manage workspace users, assign RBAC roles, or revoke active sessions."
                  : "Read-only directory of workspace members and their assigned RBAC roles."}
              </p>

              {canWriteUsers && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showCreateForm ? "Cancel" : "Add Member"}</span>
                </button>
              )}
            </div>

            {/* Admin Provision New User Form */}
            {canWriteUsers && showCreateForm && (
              <form
                method="post"
                onSubmit={(e) => void handleCreateSubmit(e)}
                noValidate
                className="rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] p-4 border border-[#e4e6eb] dark:border-[#2a3942] space-y-3"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8696a0]">
                  Provision New Workspace User
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={nameId}
                      className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                    >
                      Full name <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id={nameId}
                      type="text"
                      autoComplete="name"
                      required
                      {...createForm.register("name")}
                      placeholder="Devon Brooks"
                      className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                    />
                    {createForm.formState.errors.name && (
                      <span className="text-[11px] text-rose-600 dark:text-rose-400">
                        {createForm.formState.errors.name.message}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={emailId}
                      className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                    >
                      Email address <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id={emailId}
                      type="email"
                      autoComplete="username"
                      spellCheck={false}
                      required
                      {...createForm.register("email")}
                      placeholder="devon@pulseos.xyz"
                      className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                    />
                    {createForm.formState.errors.email && (
                      <span className="text-[11px] text-rose-600 dark:text-rose-400">
                        {createForm.formState.errors.email.message}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={passwordId}
                      className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                    >
                      Temporary password (8+ chars){" "}
                      <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id={passwordId}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      {...createForm.register("password")}
                      placeholder="••••••••"
                      className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                    />
                    {createForm.formState.errors.password && (
                      <span className="text-[11px] text-rose-600 dark:text-rose-400">
                        {createForm.formState.errors.password.message}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={titleId}
                      className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                    >
                      Job title
                    </label>
                    <input
                      id={titleId}
                      type="text"
                      {...createForm.register("title")}
                      placeholder="Tokenomics Researcher"
                      className="w-full rounded-lg bg-white dark:bg-[#202c33] px-3 py-2 text-xs border border-[#e4e6eb] dark:border-[#2a3942] outline-none"
                    />
                  </div>
                </div>

                {/* Visible Radio Buttons for 4 RBAC Roles per modern-web-guidance (forms) */}
                <fieldset className="pt-1">
                  <legend className="text-xs font-semibold text-[#050505] dark:text-[#e9edef] mb-1.5">
                    Assigned RBAC Role <span aria-hidden="true">*</span>
                  </legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {USER_ROLES.map((roleKey) => {
                      const radioId = `${rolePrefixId}-${roleKey}`;
                      const meta = USER_ROLE_META[roleKey];
                      return (
                        <div
                          key={roleKey}
                          className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#202c33] px-2.5 py-2 border border-[#e4e6eb] dark:border-[#2a3942]"
                        >
                          <input
                            id={radioId}
                            type="radio"
                            value={roleKey}
                            {...createForm.register("role")}
                            className="checkbox-native"
                          />
                          <label
                            htmlFor={radioId}
                            className="text-xs font-medium cursor-pointer"
                          >
                            {meta.label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#65676b] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer"
                  >
                    Create Member
                  </button>
                </div>
              </form>
            )}

            {/* Members Directory List */}
            <div className="divide-y divide-[#e4e6eb] dark:divide-[#2a3942] rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] overflow-hidden">
              {users.map((member) => {
                const isSelf = member.id === currentUser.id;
                const roleMeta = USER_ROLE_META[member.role];

                return (
                  <div
                    key={member.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#202c33] ${
                      !member.isActive ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full ${member.avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0`}
                      >
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">
                            {member.name}
                          </span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#2a3942] text-[10px] font-medium text-[#65676b] dark:text-[#d1d7db]">
                              You
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.label}
                          </span>
                          {!member.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">
                              Inactive (Pending)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#65676b] dark:text-[#8696a0] truncate">
                          {member.email} · {member.title}
                        </p>
                      </div>
                    </div>

                    {canWriteUsers ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <label
                          htmlFor={`role-select-${member.id}`}
                          className="sr-only"
                        >
                          Role for {member.name}
                        </label>
                        <select
                          id={`role-select-${member.id}`}
                          value={member.role}
                          disabled={isSelf || isMutating}
                          onChange={(e) =>
                            void handleRoleChange(
                              member.id,
                              e.target.value as UserRole
                            )
                          }
                          className="rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] px-2.5 py-1.5 text-xs font-medium text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-50 cursor-pointer"
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {USER_ROLE_META[r].label}
                            </option>
                          ))}
                        </select>

                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() =>
                                void handleStatusToggle(
                                  member.id,
                                  !member.isActive
                                )
                              }
                              title={
                                member.isActive
                                  ? "Deactivate user & revoke sessions"
                                  : "Reactivate user account"
                              }
                              aria-label={
                                member.isActive
                                  ? `Deactivate ${member.name}`
                                  : `Activate ${member.name}`
                              }
                              className="p-1.5 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-white transition cursor-pointer"
                            >
                              {member.isActive ? (
                                <UserMinus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => void handleDelete(member.id)}
                              title={`Delete ${member.name}`}
                              aria-label={`Delete ${member.name}`}
                              className="p-1.5 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] hover:text-rose-600 dark:text-[#8696a0] dark:hover:text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-[#65676b] dark:text-[#8696a0]">
                        <Lock className="w-3.5 h-3.5" />
                        <span>{member.permissions.length} permissions</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: RBAC Permission Matrix */}
        {activeTab === "matrix" && (
          <div className="space-y-3">
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              Fine-grained permission matrix enforced by NestJS{" "}
              <code className="font-mono">@RequirePermissions()</code> guards and
              mirrored in client UI controls.
            </p>

            <div className="overflow-x-auto rounded-xl border border-[#e4e6eb] dark:border-[#2a3942]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f0f2f5] dark:bg-[#111b21] border-b border-[#e4e6eb] dark:border-[#2a3942]">
                    <th className="py-2.5 px-3 font-semibold">Permission</th>
                    {USER_ROLES.map((role) => (
                      <th
                        key={role}
                        className="py-2.5 px-3 font-semibold text-center"
                      >
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${USER_ROLE_META[role].badgeClass}`}
                        >
                          {USER_ROLE_META[role].shortLabel}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e6eb] dark:divide-[#2a3942]">
                  {ALL_PERMISSIONS.map((perm) => {
                    const meta = PERMISSION_LABELS[perm];
                    return (
                      <tr
                        key={perm}
                        className="bg-white dark:bg-[#202c33] hover:bg-[#f0f2f5]/40 dark:hover:bg-[#2a3942]/40"
                      >
                        <td className="py-2 px-3">
                          <div className="font-medium text-[#050505] dark:text-[#e9edef]">
                            {meta.label}
                          </div>
                          <div className="text-[10px] font-mono text-[#65676b] dark:text-[#8696a0]">
                            {perm} · {meta.category}
                          </div>
                        </td>
                        {USER_ROLES.map((role) => {
                          const granted =
                            ROLE_PERMISSIONS[role].includes(perm);
                          return (
                            <td key={role} className="py-2 px-3 text-center">
                              {granted ? (
                                <span
                                  aria-label={`Granted for ${role}`}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span
                                  aria-label={`Not granted for ${role}`}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[#65676b]/40 dark:text-[#8696a0]/40"
                                >
                                  <XIcon className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Security Audit Logs */}
        {activeTab === "audit" && canReadUsers && (
          <div className="space-y-2.5 max-h-80 overflow-y-auto scroller">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-center py-8 text-[#65676b] dark:text-[#8696a0]">
                No security audit events recorded yet.
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-[#e4e6eb] dark:border-[#2a3942] bg-white dark:bg-[#202c33] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-[#0084ff]">
                        {log.action}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          USER_ROLE_META[log.actorRole].badgeClass
                        }`}
                      >
                        {log.actorRole}
                      </span>
                      <span className="text-[#65676b] dark:text-[#8696a0] truncate">
                        by {log.actorEmail}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] font-mono mt-0.5 truncate">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-[#65676b] dark:text-[#8696a0] shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
