import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createdSince, listNotifications, markRead, unreadCount } from "./store";

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const findMany = vi.mocked(db.notification.findMany);
const count = vi.mocked(db.notification.count);
const updateMany = vi.mocked(db.notification.updateMany);

const row = (id: string, userId = "user_a") => ({
  id,
  userId,
  kind: "NEW_CASE",
  title: "New case",
  body: "A case needs a decision",
  linkPath: "/admin",
  readAt: null,
  createdAt: new Date("2026-09-20T10:00:00.000Z"),
});

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  updateMany.mockReset();
});

describe("notification store", () => {
  it("lists only the signed-in user's notifications", async () => {
    findMany.mockResolvedValue([row("n1")] as never);
    await listNotifications("user_a");
    expect(findMany.mock.calls[0]![0]!.where).toMatchObject({ userId: "user_a" });
  });

  it("reports one more row than the page to know whether there is another page", async () => {
    findMany.mockResolvedValue([row("n1"), row("n2"), row("n3")] as never);
    const page = await listNotifications("user_a", { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
  });

  it("counts only the user's own unread rows", async () => {
    count.mockResolvedValue(3);
    await unreadCount("user_a");
    expect(count.mock.calls[0]![0]!.where).toEqual({ userId: "user_a", readAt: null });
  });

  it("cannot mark another user's notification read, even with its id", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await markRead("user_a", { ids: ["notification_of_user_b"] });
    expect(updateMany.mock.calls[0]![0]!.where).toMatchObject({ userId: "user_a", id: { in: ["notification_of_user_b"] } });
  });

  it("mark all is still limited to the user", async () => {
    updateMany.mockResolvedValue({ count: 2 });
    await markRead("user_a", { all: true });
    expect(updateMany.mock.calls[0]![0]!.where).toEqual({ userId: "user_a", readAt: null });
  });

  it("the live stream query is limited to the user", async () => {
    findMany.mockResolvedValue([] as never);
    await createdSince("user_a", new Date());
    expect(findMany.mock.calls[0]![0]!.where).toMatchObject({ userId: "user_a" });
  });
});
