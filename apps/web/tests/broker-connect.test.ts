// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TooltipProvider } from "../src/components/ui/tooltip";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/filter-bar", () => ({ FilterBar: () => null }));
vi.mock("@/lib/use-api", () => ({
  postJson: vi.fn(),
  useApi: (url: string) => ({
    data:
      url === "/api/settings"
        ? { timeZone: "UTC", importTimeZone: "UTC", models: [] }
        : { formats: [] },
    error: null,
    loading: false,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  TabsList: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  TabsTrigger: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  TabsContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

const { default: ImportPage } = await import("../src/app/import/page");
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("offers only file upload and manual entry, with no broker sync option", async () => {
  await act(async () =>
    root.render(createElement(TooltipProvider, null, createElement(ImportPage))),
  );
  const text = container.textContent ?? "";
  expect(text).toContain("File upload");
  expect(text).toContain("Manual");
  expect(text).not.toContain("Broker sync");
  expect(text).not.toContain("Connect a broker");
});
