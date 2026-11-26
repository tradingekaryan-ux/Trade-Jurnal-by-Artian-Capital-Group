"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Shield } from "lucide-react";
import { postJson } from "@/lib/use-api";
import { Button } from "./ui/button";

interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  isAdmin: boolean;
}

export function UserMenu() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: SessionInfo) => setSession(data))
      .catch(() => setSession(null));
  }, []);

  const logout = async () => {
    await postJson("/api/auth", {}, "DELETE");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-1">
      {session?.username && (
        <div className="truncate text-xs font-medium" title={session.username}>
          {session.username}
        </div>
      )}
      {session?.isAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Shield className="h-3 w-3" /> Admin · Model AI
        </Link>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full justify-start px-1 text-xs text-muted-foreground"
        onClick={logout}
      >
        <LogOut className="mr-1.5 h-3 w-3" /> Keluar
      </Button>
    </div>
  );
}
