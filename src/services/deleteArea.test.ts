import { beforeEach, expect, it, vi } from "vitest";
const mockApiDelete = vi.fn();
vi.mock("@/lib/api", () => ({ apiDelete: (...args: any[]) => mockApiDelete(...args) }));
import { deleteArea } from "./deleteArea";

beforeEach(() => {
  vi.resetAllMocks();
});

it("calls apiDelete with the area id", async () => {
  mockApiDelete.mockResolvedValue({ status: "success" });
  await deleteArea("a", "Area");
  expect(mockApiDelete).toHaveBeenCalledWith("/areas/a");
});

it("surfaces deletion failures instead of hiding the area", async () => {
  mockApiDelete.mockRejectedValue(new Error("denied"));
  await expect(deleteArea("a", "Area")).rejects.toThrow("denied");
});
