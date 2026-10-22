// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClinicalProfileLoginAccess } from "../ClinicalProfileLoginAccess";
import { userService } from "@/services/userService";
import { rbacService } from "@/services/rbacService";
import { addToast } from "@/components/ui/toast";

vi.mock("@/services/userService", () => ({
  userService: {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
  },
}));

vi.mock("@/services/rbacService", () => ({
  rbacService: {
    ensureDefaultClinicalRoleAssigned: vi.fn(),
  },
}));

vi.mock("@/components/ui/toast", () => ({
  addToast: vi.fn(),
}));

const baseProps = {
  role: "doctor" as const,
  email: "Doctor@Clinic.com",
  displayName: "Dr. Shrestha",
  phone: "9800000000",
  clinicId: "clinic-1",
  branchId: "branch-1",
};

describe("ClinicalProfileLoginAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // Not auto-registered here the way it would be with vitest's `globals:
  // true` — without this, each test's rendered DOM accumulates in
  // document.body across the whole file instead of being torn down.
  afterEach(() => {
    cleanup();
  });

  it("prompts to save an email first when the profile has none", async () => {
    render(<ClinicalProfileLoginAccess {...baseProps} email={undefined} />);

    expect(
      await screen.findByText(/save an email address/i),
    ).toBeInTheDocument();
    // No lookup is attempted without an email to check.
    expect(userService.getUserByEmail).not.toHaveBeenCalled();
  });

  it("shows 'No login access yet' once the check resolves with no match", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(null);

    render(<ClinicalProfileLoginAccess {...baseProps} />);

    expect(screen.getByText(/checking login status/i)).toBeInTheDocument();

    expect(
      await screen.findByText(/no login access yet/i),
    ).toBeInTheDocument();
    // The live email prop ("Doctor@Clinic.com") is normalized before the
    // lookup — this is the case/whitespace-tolerance fix this component
    // exists to protect.
    expect(userService.getUserByEmail).toHaveBeenCalledWith(
      "doctor@clinic.com",
    );
  });

  it("shows the existing login when the check finds one, instead of offering to create a duplicate", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue({
      id: "u1",
      email: "doctor@clinic.com",
    } as any);

    render(<ClinicalProfileLoginAccess {...baseProps} />);

    expect(
      await screen.findByText(/has a login account/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create login/i }),
    ).not.toBeInTheDocument();
  });

  it("distinguishes a failed check from a confirmed 'no login' — and offers a retry, not a create button", async () => {
    vi.mocked(userService.getUserByEmail).mockRejectedValue(
      new Error("network error"),
    );

    render(<ClinicalProfileLoginAccess {...baseProps} />);

    expect(
      await screen.findByText(/couldn't check login status/i),
    ).toBeInTheDocument();
    // The failure must never be rendered as "No login access yet" — that
    // would invite creating a second, duplicate login for someone who
    // already has one.
    expect(screen.queryByText(/no login access yet/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create login/i }),
    ).not.toBeInTheDocument();

    vi.mocked(userService.getUserByEmail).mockResolvedValueOnce(null);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(
      await screen.findByText(/no login access yet/i),
    ).toBeInTheDocument();
  });

  it("creates a login with no password collected, assigns the default RBAC role, and reflects the new state", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(null);
    vi.mocked(userService.createUser).mockResolvedValue("new-uid");
    vi.mocked(rbacService.ensureDefaultClinicalRoleAssigned).mockResolvedValue(
      undefined,
    );

    render(<ClinicalProfileLoginAccess {...baseProps} />);

    const createButton = await screen.findByRole("button", {
      name: /create login/i,
    });

    await userEvent.click(createButton);

    await waitFor(() => expect(userService.createUser).toHaveBeenCalled());

    // Second positional arg is the password — must be undefined so
    // userService.createUser generates one internally rather than using an
    // admin-typed credential nobody should ever be collecting.
    expect(userService.createUser).toHaveBeenCalledWith(
      "doctor@clinic.com",
      undefined,
      expect.objectContaining({
        displayName: "Dr. Shrestha",
        role: "doctor",
        clinicId: "clinic-1",
        branchId: "branch-1",
        phone: "9800000000",
      }),
      undefined,
      "login-access-panel",
    );

    expect(rbacService.ensureDefaultClinicalRoleAssigned).toHaveBeenCalledWith(
      "clinic-1",
      "new-uid",
      "doctor",
    );

    expect(
      await screen.findByText(/has a login account/i),
    ).toBeInTheDocument();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ color: "success" }),
    );
  });

  it("does nothing when the admin cancels the confirmation", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(null);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ClinicalProfileLoginAccess {...baseProps} />);

    const createButton = await screen.findByRole("button", {
      name: /create login/i,
    });

    await userEvent.click(createButton);

    expect(userService.createUser).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /create login/i }),
    ).toBeInTheDocument();
  });

  it("surfaces a warning, not a failure, when the login is created but RBAC assignment fails", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(null);
    vi.mocked(userService.createUser).mockResolvedValue("new-uid");
    vi.mocked(
      rbacService.ensureDefaultClinicalRoleAssigned,
    ).mockRejectedValue(new Error("no default role"));

    render(<ClinicalProfileLoginAccess {...baseProps} />);

    const createButton = await screen.findByRole("button", {
      name: /create login/i,
    });

    await userEvent.click(createButton);

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Login created, access setup incomplete",
          color: "warning",
        }),
      ),
    );
    // The login itself still succeeded — the panel should reflect that,
    // not roll back to "No login access yet".
    expect(
      await screen.findByText(/has a login account/i),
    ).toBeInTheDocument();
  });
});
