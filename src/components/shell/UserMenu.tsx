import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Repeat } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";

export function UserMenu({
  name,
  subtitle,
  children,
}: {
  name: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const leave = async () => {
    await signOut();
    void navigate({ to: "/sign-in" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <Avatar className="size-9 border border-primary/15">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {initials(name) || "PL"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="font-medium">{name}</div>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
        <DropdownMenuItem onSelect={leave}>
          <Repeat /> Switch account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={leave}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
