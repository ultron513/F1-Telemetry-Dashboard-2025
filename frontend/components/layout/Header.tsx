"use client";

import { Bell, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-6">
      <h1 className="text-2xl font-bold">
        F1 Engineering Analytics Dashboard
      </h1>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon">
          <Bell className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon">
          <Moon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}