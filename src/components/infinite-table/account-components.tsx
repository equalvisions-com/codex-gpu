"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import {
  LogOut,
  LogIn,
  Sun,
  Settings as SettingsIcon,
  Search,
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface AccountUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface UserMenuProps {
  user: AccountUser | null | undefined;
  onSignOut: () => void;
  isSigningOut: boolean;
  fullWidth?: boolean;
  showDetails?: boolean;
  triggerClassName?: string;
  isAuthenticated?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export function UserMenu({
  user,
  onSignOut,
  isSigningOut,
  fullWidth = true,
  showDetails = true,
  triggerClassName,
  isAuthenticated: isAuthenticatedProp,
  onSignIn,
  onSignUp,
}: UserMenuProps) {
  const normalizedName = user?.name?.trim();
  const email = user?.email ?? "";
  const displayName = normalizedName || email || "Account";
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const hasImage = Boolean(user?.image);
  const avatarSizeClass = showDetails ? "h-8 w-8" : "h-6 w-6";
  const avatarWrapperClass = showDetails
    ? avatarSizeClass
    : cn(avatarSizeClass, "border border-border");
  const avatarImageClass = cn(
    "h-full w-full rounded-full object-cover",
    !showDetails && "border border-border",
  );
  const inferredAuthenticated = Boolean(normalizedName || email || user?.image);
  const isAuthenticated = isAuthenticatedProp ?? inferredAuthenticated;
  const shouldRenderAvatar = (showDetails || hasImage) && user;
  const isSplitTrigger = !showDetails && !isAuthenticated;

  const handleSignInClick = React.useCallback(() => {
    onSignIn?.();
  }, [onSignIn]);

  const handleSignUpClick = React.useCallback(() => {
    onSignUp?.();
  }, [onSignUp]);

  const triggerAriaLabel = !showDetails ? displayName : undefined;

  return (
    <div>
      <DropdownMenu>
        {isSplitTrigger ? (
          <div
            role="group"
            aria-label="Account actions"
            className={cn(
              "flex items-center overflow-hidden rounded-full border border-border bg-muted/70",
              triggerClassName,
            )}
          >
            <Button
              type="button"
              variant="ghost"
              className="h-9 min-w-[76px] flex-1 rounded-none rounded-l-full border-r border-border/70 px-3 text-xs font-bold text-foreground/70 hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={handleSignUpClick}
              disabled={isSigningOut}
            >
              Sign up
            </Button>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-none rounded-r-full px-0 text-foreground/70 hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="Open account menu"
                disabled={isSigningOut}
              >
                <span className="relative flex w-[18px] items-center justify-center">
                  <span className="absolute h-px w-3 -translate-y-1 rounded-full bg-current" />
                  <span className="absolute h-px w-3 rounded-full bg-current" />
                  <span className="absolute h-px w-3 translate-y-1 rounded-full bg-current" />
                </span>
              </Button>
            </DropdownMenuTrigger>
          </div>
        ) : (
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "flex items-center gap-2 rounded-md p-2 h-auto text-left text-sm font-medium text-foreground bg-background hover:bg-muted/70 hover:text-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
                fullWidth ? "w-full justify-start" : "w-auto justify-center",
                !showDetails
                  ? "rounded-full border border-border bg-muted/70 !px-2 !py-1.5 !gap-1.5"
                  : null,
                triggerClassName,
              )}
              disabled={isSigningOut}
              aria-label={triggerAriaLabel}
            >
              {!showDetails ? (
                <span className="relative flex w-[18px] items-center justify-center text-foreground/70">
                  <span className="absolute h-px w-3 -translate-y-1 rounded-full bg-current" />
                  <span className="absolute h-px w-3 rounded-full bg-current" />
                  <span className="absolute h-px w-3 translate-y-1 rounded-full bg-current" />
                </span>
              ) : null}
              {shouldRenderAvatar && (
                <div className={cn("relative", avatarSizeClass)}>
                  {hasImage && !imageLoaded ? (
                    <Skeleton className={cn("rounded-full", avatarSizeClass)} />
                  ) : null}
                  <Avatar
                    className={cn(
                      avatarWrapperClass,
                      hasImage && !imageLoaded ? "opacity-0" : "opacity-100",
                    )}
                  >
                    {hasImage ? (
                      <AvatarImage
                        src={user!.image!}
                        alt={displayName}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(true)}
                        className={avatarImageClass}
                      />
                    ) : null}
                  </Avatar>
                </div>
              )}
              {showDetails ? (
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate">{displayName}</span>
                  {email ? (
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  ) : null}
                </div>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="center" className="w-60">
          {isAuthenticated ? (
            <DropdownMenuLabel className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {user?.image ? (
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
          ) : (
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">OpenStatus</span>
              <span className="text-xs text-muted-foreground">
                Sign in to save favorites and manage your account
              </span>
            </DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Navigate
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/llms" className="cursor-pointer flex w-full items-center gap-2">
              <span>LLMs</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/gpus" className="cursor-pointer flex w-full items-center gap-2">
              <span>GPUs</span>
            </Link>
          </DropdownMenuItem>
          {!isAuthenticated ? (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                onSignIn?.();
              }}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {isAuthenticated ? (
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer flex w-full items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="cursor-default focus:bg-transparent focus:text-foreground"
            onSelect={(event) => event.preventDefault()}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Sun className="h-4 w-4" />
                <span>Theme</span>
              </div>
              <ModeToggle className="h-8 w-8 [&>svg]:h-4 [&>svg]:w-4" />
            </div>
          </DropdownMenuItem>
          {isAuthenticated ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
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
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export interface SidebarPanelProps {
  user: AccountUser | null | undefined;
  isSigningOut: boolean;
  onSignOut: () => void;
  className?: string;
  hideNavigation?: boolean;
}

export function SidebarPanel({
  user,
  isSigningOut,
  onSignOut,
  className,
  hideNavigation,
}: SidebarPanelProps) {
  const isAuthenticated = Boolean(user);
  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="mx-auto w-full max-w-full">
          <DataTableFilterControls hideNavigation={hideNavigation} />
        </div>
      </div>
      {isAuthenticated ? (
        <div className="flex-shrink-0 border-t border-border p-2">
          <UserMenu
            user={user}
            onSignOut={onSignOut}
            isSigningOut={isSigningOut}
            isAuthenticated
          />
        </div>
      ) : null}
    </div>
  );
}

export interface MobileTopNavProps {
  brandLabel?: string;
  user: AccountUser | null;
  onSignOut: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  isSigningOut: boolean;
  renderSidebar: () => React.ReactNode;
  sheetTitle?: string;
}

export function MobileTopNav({
  brandLabel = "OpenStatus",
  user,
  onSignOut,
  onSignIn,
  onSignUp,
  isSigningOut,
  renderSidebar,
  sheetTitle = "Filters & account",
}: MobileTopNavProps) {
  return (
    <NavigationMenu className="flex w-full max-w-none justify-between sm:hidden px-4">
      <NavigationMenuList className="flex w-full items-center gap-3">
        <NavigationMenuItem className="mr-auto">
          <NavigationMenuLink asChild>
            <span className="select-none text-sm font-medium text-background">
              {brandLabel}
            </span>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
              >
                <Search className="h-5 w-5 text-foreground/70" />
                <span className="sr-only">Toggle filters</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-full max-w-full flex-col p-0 sm:max-w-sm"
            >
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle className="text-sm font-semibold">
                  {sheetTitle}
                </SheetTitle>
              </SheetHeader>
              {renderSidebar()}
            </SheetContent>
          </Sheet>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <UserMenu
            user={user}
            onSignOut={onSignOut}
            onSignIn={onSignIn}
            onSignUp={onSignUp}
            isSigningOut={isSigningOut}
            fullWidth={false}
            showDetails={false}
            isAuthenticated={Boolean(user)}
          />
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
