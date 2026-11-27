// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/components/filter-bar", () => ({ FilterBar: () => null }));

const { default: ProfilePage } = await import("../src/app/profile/page");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/api/auth"
          ? { id: "u1" }
          : url === "/api/posts"
            ? {
                posts: [
                  {
                    id: "p1",
                    userId: "u1",
                    author: "ekaryan",
                    kind: "promo",
                    title: "Promo uji",
                    description: "Diskon",
                    promoCode: "ART123",
                    codeEnabled: true,
                    url: "https://example.com",
                    urlEnabled: true,
                    hasImage: false,
                    createdAt: "2026-11-27T00:00:00.000Z",
                  },
                ],
              }
            : {
                profile: {
                  username: "ekaryan",
                  role: "member",
                  created_at: "2026-11-27T00:00:00.000Z",
                  display_name: "",
                  bio: "",
                  avatar_url: null,
                  banner_url: null,
                },
              };
      return { ok: true, json: async () => body };
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const buttons = () => Array.from(container.querySelectorAll("button"));
const click = async (text: string) => {
  const button = buttons().find((item) => item.textContent?.trim() === text);
  expect(button, text).toBeTruthy();
  await act(async () => button!.click());
};

it("kelola postingan sendiri ada di profil: copy code, URL, edit, hapus", async () => {
  await act(async () => root.render(createElement(ProfilePage)));
  expect(container.textContent).toContain("Salin: ART123");
  expect(container.textContent).toContain("Kunjungi situs ↗");
  expect(buttons().some((b) => b.textContent?.trim() === "Edit")).toBe(true);
  expect(buttons().some((b) => b.textContent?.trim() === "Hapus")).toBe(true);

  await click("Edit");
  expect(container.querySelector('input[value="Promo uji"]')).toBeTruthy();
  expect(container.querySelector('input[value="ART123"]')).toBeTruthy();
  expect(container.textContent).toContain("Simpan postingan");
});
