"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";

let count = 0;
function genId() {
  return (count = (count + 1) % 100000).toString();
}

type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface ToastContent {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastContent {
  id: string;
}

type Listener = (toasts: ToastItem[]) => void;
const listeners = new Set<Listener>();
let toasts: ToastItem[] = [];

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function toast(content: ToastContent) {
  const id = genId();
  const item: ToastItem = { id, ...content };
  toasts = [item, ...toasts];
  notify();

  return {
    id,
    dismiss: () => {
      toasts = toasts.filter((t) => t.id !== id);
      notify();
    },
    update: (next: Partial<ToastContent>) => {
      toasts = toasts.map((t) => (t.id === id ? { ...t, ...next } : t));
      notify();
    },
  };
}

export function useToast() {
  const [state, setState] = React.useState<ToastItem[]>([]);
  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return {
    toasts: state,
    show: toast,
    dismiss: (id: string) => {
      toasts = toasts.filter((t) => t.id !== id);
      notify();
    },
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastRoot />
    </>
  );
}

function ToastRoot() {
  const [state, setState] = React.useState<ToastItem[]>([]);
  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {state.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

const VARIANT_STYLE: Record<ToastVariant, string> = {
  default: "bg-primary text-primary-foreground",
  success: "bg-green-500 text-white",
  destructive: "bg-red-500 text-white",
  warning: "bg-amber-500 text-white",
};

function ToastItem({ toast }: { toast: ToastItem }) {
  const [open, setOpen] = React.useState(true);
  const duration = toast.duration ?? 4000;

  React.useEffect(() => {
    const t = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!open) return null;

  const VariantIcon =
    toast.variant === "success"
      ? CheckCircle2
      : toast.variant === "destructive"
        ? AlertCircle
        : toast.variant === "warning"
          ? Info
          : Info;

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-opacity data-[state=closed]:animate-out data-[state=closed]:fade-out",
        VARIANT_STYLE[toast.variant ?? "default"],
        "data-[state=open]:animate-in data-[state=open]:fade-in",
      )}
      data-state={open ? "open" : "closed"}
    >
      <div className="flex items-center space-x-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
          <VariantIcon className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description && <div className="text-sm opacity-80">{toast.description}</div>}
        </div>
      </div>
      <button
        className="inline-flex items-center justify-center rounded-md p-2 text-white/60 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-white"
        onClick={() => setOpen(false)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
