"use client";

import { useEffect, useMemo, useState } from "react";

import { useUserRoleManagement } from "../hooks/useUserRoleManagement";

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export function UserAccessPanel() {
  const { users, roles, isLoading, isSaving, error, assignRoles } = useUserRoleManagement();
  const [draftRoles, setDraftRoles] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextDrafts = users.reduce<Record<string, string[]>>((acc, user) => {
      acc[user.id] = user.roles.map((role) => role.id).sort();
      return acc;
    }, {});
    setDraftRoles(nextDrafts);
  }, [users]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)),
    [users],
  );

  const toggleRole = (userId: string, roleId: string) => {
    setDraftRoles((current) => {
      const existing = current[userId] ?? [];
      const next = existing.includes(roleId)
        ? existing.filter((value) => value !== roleId)
        : [...existing, roleId];
      return {
        ...current,
        [userId]: next.sort(),
      };
    });
  };

  const saveRoles = async (userId: string) => {
    const roleIds = draftRoles[userId] ?? [];
    if (roleIds.length === 0) {
      setNotice((current) => ({
        ...current,
        [userId]: "At least one role is required.",
      }));
      return;
    }

    try {
      const updated = await assignRoles(userId, roleIds);
      setNotice((current) => ({
        ...current,
        [userId]: `Access updated for ${updated.full_name || updated.email}.`,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update roles";
      setNotice((current) => ({
        ...current,
        [userId]: message,
      }));
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/50 hover:border-white/20">
      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-white/90">Access Control</h3>
            <p className="text-sm text-white/50">
              Review users, assign multiple roles, and unlock sync access when needed.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {users.length} users
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-white/40">
            Loading access matrix...
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedUsers.map((user) => {
              const selectedRoles = (draftRoles[user.id] ?? []).slice().sort();
              const actualRoles = user.roles.map((role) => role.id).sort();
              const isDirty = !arraysEqual(selectedRoles, actualRoles);
              const isSavingThisUser = isSaving === user.id;

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-medium text-white">
                        {user.full_name || "Unnamed user"}
                      </div>
                      <div className="text-sm text-white/50">{user.email}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                          <span
                            key={role.id}
                            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-cyan-200"
                          >
                            {role.name}
                          </span>
                        ))}
                        {user.roles.length === 0 && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-white/40">
                            No role assigned
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-white/35">
                      <div>{user.permissions.length} permissions</div>
                      <div>{user.is_active ? "Active" : "Inactive"}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {roles.map((role) => {
                      const checked = selectedRoles.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                            checked
                              ? "border-indigo-400/40 bg-indigo-500/10"
                              : "border-white/10 bg-black/20 hover:border-white/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRole(user.id, role.id)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-indigo-400"
                          />
                          <div>
                            <div className="text-sm font-medium text-white">{role.name}</div>
                            <div className="text-xs text-white/45">
                              {role.description || "No description"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-white/45">
                      {notice[user.id] || "Select one or more roles, then save the access policy."}
                    </div>
                    <button
                      type="button"
                      disabled={!isDirty || isSavingThisUser || selectedRoles.length === 0}
                      onClick={() => void saveRoles(user.id)}
                      className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSavingThisUser ? "Saving..." : "Save role assignment"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
