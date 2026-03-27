import { api } from "@/lib/api/client";
import type { AuthUser, Role } from "@/types";

interface UserListResponse {
  items: AuthUser[];
}

interface RoleListResponse {
  items: Role[];
}

export const rbacApi = {
  getUsers: async () => {
    const response = await api.get<UserListResponse>("/api/v1/rbac/users");
    return response.items;
  },

  getRoles: async () => {
    const response = await api.get<RoleListResponse>("/api/v1/rbac/roles");
    return response.items;
  },

  assignUserRoles: (userId: string, roleIds: string[]) =>
    api.post<AuthUser>(`/api/v1/rbac/users/${userId}/roles`, {
      role_ids: roleIds,
    }),
};
