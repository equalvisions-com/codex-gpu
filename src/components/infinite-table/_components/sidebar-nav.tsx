"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Server,
  Star,
  Cpu,
  Bot,
  Search,
  LogOut,
  LogIn,
  ChevronsUpDown,
  Settings as SettingsIcon,
  Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useHotKey } from "@/hooks/use-hot-key";
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
import SpotlightSearchDialog from "./spotlight-search-dialog";

interface SidebarLinkProps {
  href?: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
}

function SidebarLink({ href, label, icon: Icon, onClick, disabled }: SidebarLinkProps) {
  const baseClasses =
    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-foreground hover:bg-muted/50 hover:text-accent-foreground";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          baseClasses,
          "text-left",
          disabled ? "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-foreground" : null,
        )}
      >
        {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </button>
    );
  }

  if (!href) {
    return null; // If no href and no onClick, don't render anything
  }

  return (
    <Link
      href={href}
      className={cn(baseClasses)}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
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
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate">{displayName}</span>
              {email ? (
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              ) : null}
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

interface SidebarNavProps {
  currentView?: 'gpus' | 'cpus';
}

export function SidebarNav({ currentView = 'gpus' }: SidebarNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, signOut } = useAuth();
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const { showSignIn } = useAuthDialog();
  const queryClient = useQueryClient();
  const [isSpotlightOpen, setIsSpotlightOpen] = React.useState(false);

  // Add global keyboard shortcut for search (Cmd+K / Ctrl+K)
  useHotKey(() => setIsSpotlightOpen(true), "k");

  const handleSignIn = React.useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignIn({ callbackUrl });
  }, [showSignIn]);

  const handleFavoritesClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("favorites", "true");
    const baseUrl = currentView === 'cpus' ? '/cpus' : '';
    router.push(`${baseUrl}?${params.toString()}`, { scroll: false });
  };

  const handleCurrentViewClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("favorites"); // Remove favorites filter when going to main view
    const baseUrl = currentView === 'cpus' ? '/cpus' : '';
    router.push(params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl || "/", { scroll: false });
  };

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
    <nav className="flex min-h-full flex-1 flex-col gap-6">
      <div className="space-y-1">
        <div className="mb-1 px-2 text-xs uppercase tracking-wide text-muted-foreground">
          Menu
        </div>
        <div className="space-y-1">
          <SidebarLink href="/" label="Home" icon={Home} />
          {currentView === 'gpus' ? (
            <SidebarLink label="GPUs" icon={Server} onClick={handleCurrentViewClick} />
          ) : (
            <SidebarLink href="/" label="GPUs" icon={Server} />
          )}
          {currentView === 'cpus' ? (
            <SidebarLink label="CPUs" icon={Cpu} onClick={handleCurrentViewClick} />
          ) : (
            <SidebarLink href="/cpus" label="CPUs" icon={Cpu} />
          )}
          <SidebarLink href="/models" label="LLMs" icon={Bot} />
          <SidebarLink
            label="Search"
            icon={Search}
            onClick={() => setIsSpotlightOpen(true)}
          />
          {session ? (
            <SidebarLink label="Favorites" icon={Star} onClick={handleFavoritesClick} />
          ) : null}
          {!session ? (
            <SidebarLink label="Sign in" icon={LogIn} onClick={handleSignIn} />
          ) : null}
        </div>
      </div>
      {session ? (
        <div className="mt-auto">
          <UserMenu
            user={{
              name: session.user?.name,
              email: session.user?.email,
              image: session.user?.image,
            }}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />
        </div>
      ) : null}
      {isSpotlightOpen && (
        <SpotlightSearchDialog open={isSpotlightOpen} onOpenChange={setIsSpotlightOpen} />
      )}
    </nav>
  );
}

export default SidebarNav;
