import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserAccessPanel } from "./UserAccessPanel";

const assignRolesMock = vi.fn();

vi.mock("../hooks/useUserRoleManagement", () => ({
  useUserRoleManagement: () => ({
    users: [
      {
        id: "user-1",
        email: "viewer@example.com",
        full_name: "Viewer User",
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: null,
        roles: [
          {
            id: "role-viewer",
            name: "viewer",
            description: "Read-only",
            permissions: [],
          },
        ],
        permissions: [],
      },
    ],
    roles: [
      {
        id: "role-admin",
        name: "admin",
        description: "Admin",
        permissions: [],
      },
      {
        id: "role-viewer",
        name: "viewer",
        description: "Viewer",
        permissions: [],
      },
    ],
    isLoading: false,
    isSaving: null,
    error: null,
    refresh: vi.fn(),
    assignRoles: (...args: unknown[]) => assignRolesMock(...args),
  }),
}));

describe("UserAccessPanel", () => {
  beforeEach(() => {
    assignRolesMock.mockReset();
    assignRolesMock.mockResolvedValue({
      id: "user-1",
      email: "viewer@example.com",
      full_name: "Viewer User",
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: null,
      roles: [],
      permissions: [],
    });
  });

  it("allows assigning multiple roles to a user", async () => {
    const user = userEvent.setup();
    render(<UserAccessPanel />);

    await user.click(screen.getByLabelText(/admin/i));
    await user.click(screen.getByRole("button", { name: "Save role assignment" }));

    expect(assignRolesMock).toHaveBeenCalledWith("user-1", [
      "role-admin",
      "role-viewer",
    ]);
  });
});
