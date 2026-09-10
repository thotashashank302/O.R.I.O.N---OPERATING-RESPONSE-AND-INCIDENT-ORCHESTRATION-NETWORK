import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/logout/route";
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/server/auth/supabase-session", () => ({ createSupabaseSessionClient: async () => ({ auth: { signOut } }) }));
describe("logout", () => {
  beforeEach(() => signOut.mockReset());
  it("ends only the current session", async () => {
    signOut.mockResolvedValue({ error: null });
    const response = await POST();
    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not report success when session revocation fails", async () => {
    signOut.mockResolvedValue({ error: new Error("Auth unavailable") });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await POST()).status).toBe(500); } finally { log.mockRestore(); }
  });
});
