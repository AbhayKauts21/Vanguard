import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserAccessPanel } from "./UserAccessPanel";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en.json";

const assignRolesMock = vi.fn();
const refreshMock = vi.fn();
const mockUsers = [
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
];
const mockRoles = [
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
];

vi.mock("../hooks/useUserRoleManagement", () => ({
  useUserRoleManagement: () => ({
    users: mockUsers,
    roles: mockRoles,
    isLoading: false,
    isSaving: null,
    error: null,
    refresh: refreshMock,
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
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UserAccessPanel />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByLabelText(/admin/i));
    fireEvent.click(screen.getByRole("button", { name: "Save role assignment" }));

    await waitFor(() => {
      expect(assignRolesMock).toHaveBeenCalledWith("user-1", [
        "role-admin",
        "role-viewer",
      ]);
    });
  });
});
