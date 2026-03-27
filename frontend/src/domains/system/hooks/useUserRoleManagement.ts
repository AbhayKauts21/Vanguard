"use client";

import { useCallback, useEffect, useState } from "react";

import { rbacApi } from "../api/rbacApi";
import type { AuthUser, Role } from "@/types";

export function useUserRoleManagement() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [userItems, roleItems] = await Promise.all([
        rbacApi.getUsers(),
        rbacApi.getRoles(),
      ]);
      setUsers(userItems);
      setRoles(roleItems);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load access controls";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assignRoles = useCallback(
    async (userId: string, roleIds: string[]) => {
      setIsSaving(userId);
      try {
        const updated = await rbacApi.assignUserRoles(userId, roleIds);
        setUsers((current) =>
          current.map((user) => (user.id === updated.id ? updated : user)),
        );
        setError(null);
        return updated;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to assign roles";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(null);
      }
    },
    [],
  );

  return {
    users,
    roles,
    isLoading,
    isSaving,
    error,
    refresh,
    assignRoles,
  };
}
