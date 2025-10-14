"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-client-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Settings as SettingsIcon, ChevronsUpDown } from "lucide-react";
import { TopNavSearch } from "./top-nav-search";

interface NavItem {
  href: string;
  label: string;
  isActive?: boolean;
}

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onSignOut: () => void;
  isSigningOut: boolean;
}

function UserMenu({ user, onSignOut, isSigningOut }: UserMenuProps) {
  const normalizedName = user.name?.trim();
  const email = user.email ?? "";
  const displayName = normalizedName || email || "Account";
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const hasImage = Boolean(user.image);
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/50 hover:text-accent-foreground"
            disabled={isSigningOut}
          >
            <div className="relative h-8 w-8">
              {hasImage && !imageLoaded ? (
                <Skeleton className="h-8 w-8 rounded-full" />
              ) : null}
              <Avatar className={cn("h-8 w-8", hasImage && !imageLoaded ? "opacity-0" : "opacity-100")}>
                {hasImage ? (
                  <AvatarImage
                    src={user.image!}
                    alt={displayName}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                ) : null}
              </Avatar>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {user.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{displayName}</span>
              {email ? (
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex w-full items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              if (!isSigningOut) {
                onSignOut();
              }
            }}
            disabled={isSigningOut}
          >
            <LogOut className="h-4 w-4" />
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ModelsNavBarProps {
  className?: string;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "GPUs",
  },
  {
    href: "/cpus",
    label: "CPUs",
  },
  {
    href: "/models",
    label: "LLMs",
    isActive: true,
  },
];

export function ModelsNavBar({ className }: ModelsNavBarProps) {
  const { session, signOut } = useAuth();
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSignOut = React.useCallback(() => {
    startSignOutTransition(async () => {
      try {
        await signOut();
      } finally {
        queryClient.clear();
        router.replace("/", { scroll: false });
        router.refresh();
      }
    });
  }, [queryClient, router, signOut]);

  return (
    <nav
      className={cn(
        "w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 h-14 items-center gap-4">
          {/* Left Column - Logo */}
          <div className="flex items-center">
            <img
              src="/logos/logo.svg"
              alt="Logo"
              className="h-8 w-auto"
            />
          </div>

          {/* Middle Column - Search */}
          <div className="flex items-center justify-center">
            <TopNavSearch className="hidden sm:flex w-full max-w-xs" />
          </div>

          {/* Right Column - Navigation and User Menu */}
          <div className="flex items-center justify-end gap-4">
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium",
                    item.isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            {session ? (
              <UserMenu
                user={{
                  name: session.user?.name,
                  email: session.user?.email,
                  image: session.user?.image,
                }}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
              />
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
