"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  BookOpen,
  HelpCircle,
  Settings as SettingsIcon,
  Star,
  Cpu,
  Bot,
  LogOut,
  LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/providers/auth-client-provider";

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

export function SidebarNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, signOut } = useAuth();
  const [isSigningOut, startSignOutTransition] = React.useTransition();

  const handleFavoritesClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('favorites', 'true');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleGPUsClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('favorites'); // Remove favorites filter when going to main view
    router.push(params.toString() ? `?${params.toString()}` : '/', { scroll: false });
  };

  const handleSignOut = React.useCallback(() => {
    startSignOutTransition(async () => {
      try {
        await signOut();
      } finally {
        router.refresh();
      }
    });
  }, [router, signOut]);

  return (
    <nav className="space-y-3">
      <div className="space-y-1">
        <div className="mb-1 px-2 text-xs uppercase tracking-wide text-muted-foreground">
          Deploy
        </div>
        <div className="space-y-1">
          <SidebarLink label="GPUs" icon={Server} onClick={handleGPUsClick} />
          <SidebarLink href="/cpus" label="CPUs" icon={Cpu} />
          <SidebarLink href="/models" label="LLMs" icon={Bot} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="mb-1 px-2 text-xs uppercase tracking-wide text-muted-foreground">
          Account
        </div>
        <div className="space-y-1">
          <SidebarLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
          <SidebarLink label="Favorites" icon={Star} onClick={handleFavoritesClick} />
          <SidebarLink href="/settings" label="Settings" icon={SettingsIcon} />
          {session ? (
            <SidebarLink
              label={isSigningOut ? "Signing out..." : "Sign out"}
              icon={LogOut}
              onClick={handleSignOut}
              disabled={isSigningOut}
            />
          ) : (
            <SidebarLink href="/signin" label="Sign in" icon={LogIn} />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="mb-1 px-2 text-xs uppercase tracking-wide text-muted-foreground">
          Resources
        </div>
        <div className="space-y-1">
          <SidebarLink href="/docs" label="Documentation" icon={BookOpen} />
          <SidebarLink href="/help" label="Support" icon={HelpCircle} />
        </div>
      </div>
    </nav>
  );
}

export default SidebarNav;
