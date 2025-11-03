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
  Settings as SettingsIcon,
  Search,
  X,
  Star,
  Send,
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/custom/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/custom/accordion";

const gradientSurfaceClass =
  "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-accent-foreground hover:bg-gradient-to-b hover:from-muted/70 hover:via-muted/40 hover:to-background hover:text-accent-foreground";

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
  forceUnauthSignInButton?: boolean;
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
  forceUnauthSignInButton = false,
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
  const hasSignInHandler = typeof onSignIn === "function";
  const shouldForceSignInButton =
    forceUnauthSignInButton && !isAuthenticated && hasSignInHandler;
  const isSplitTrigger = !showDetails && !isAuthenticated && !shouldForceSignInButton;
  const secondaryText = isAuthenticated ? email ?? "" : "Sign in or Sign up";

  const handleSignInClick = React.useCallback(() => {
    onSignIn?.();
  }, [onSignIn]);

  const handleSignUpClick = React.useCallback(() => {
    onSignUp?.();
  }, [onSignUp]);

  const triggerAriaLabel = !showDetails ? displayName : undefined;

  if (shouldForceSignInButton) {
    const buttonClassName = cn(
      "flex items-center gap-2 rounded-md p-2 h-auto text-left text-sm font-medium text-foreground hover:text-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
      showDetails
        ? "bg-transparent hover:bg-transparent"
        : gradientSurfaceClass,
      fullWidth ? "w-full justify-start" : "w-auto justify-center",
      !showDetails ? "rounded-full md:rounded-md md:h-9 !px-2 !py-1.5 !gap-1.5" : null,
      triggerClassName,
    );
    const ariaLabel = showDetails ? undefined : triggerAriaLabel ?? "Sign in";

    return (
      <div>
        <Button
          type="button"
          variant="ghost"
          className={buttonClassName}
          onClick={handleSignInClick}
          disabled={isSigningOut}
          aria-label={ariaLabel}
        >
          {showDetails ? (
            <>
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border border-border text-muted-foreground",
                  avatarSizeClass,
                )}
              >
                <LogIn className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate">{displayName}</span>
                {secondaryText ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {secondaryText}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 text-foreground/70" />
              <span className="sr-only">Sign in</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <DropdownMenu>
        {isSplitTrigger ? (
          <div
            role="group"
            aria-label="Account actions"
            className={cn(
              "flex items-center overflow-hidden rounded-full",
              triggerClassName,
            )}
          >
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-9 min-w-[76px] flex-1 rounded-none rounded-l-full px-3 text-xs font-bold focus-visible:ring-0 focus-visible:ring-offset-0",
              "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-accent-foreground shadow-[0_1px_0_0_hsl(var(--foreground)_/_6%),0_4px_8px_-10px_hsl(var(--foreground)_/_28%)]",
              "border-r-0",
            )}
            onClick={handleSignUpClick}
            disabled={isSigningOut}
          >
              Sign up
            </Button>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-9 w-9 rounded-none rounded-r-full px-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                  "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-accent-foreground shadow-[0_1px_0_0_hsl(var(--foreground)_/_6%),0_4px_8px_-10px_hsl(var(--foreground)_/_28%)]",
                )}
                aria-label="Open account menu"
                disabled={isSigningOut}
              >
                <span className="relative flex w-[18px] items-center justify-center text-foreground/70">
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
                "flex items-center gap-4 rounded-md p-2 h-auto text-left text-sm font-medium text-foreground hover:text-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
                showDetails
                  ? "bg-transparent hover:bg-transparent"
                  : cn(
                      gradientSurfaceClass,
                      "shadow-[0_1px_0_0_hsl(var(--foreground)_/_6%),0_4px_8px_-10px_hsl(var(--foreground)_/_28%)] hover:bg-transparent",
                    ),
                fullWidth ? "w-full justify-start" : "w-auto justify-center",
                !showDetails
                  ? "rounded-full md:rounded-md md:h-9 !px-2 !py-1.5 !gap-1.5"
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
              {shouldRenderAvatar ? (
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
              ) : null}
              {!shouldRenderAvatar && showDetails && !isAuthenticated ? (
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full border border-border text-muted-foreground",
                    avatarSizeClass,
                  )}
                >
                  <LogIn className="h-4 w-4" />
                </div>
              ) : null}
              {showDetails ? (
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate">{displayName}</span>
                  {secondaryText ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {secondaryText}
                    </span>
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
          ) : null}
          <DropdownMenuSeparator className="-mx-2" />
          <Accordion
            type="single"
            collapsible
            className="-mx-2 w-[calc(100%+16px)] px-2"
          >
            <AccordionItem value="favorites" className="border-none">
              <AccordionTrigger className="px-2 py-2 text-left text-sm font-medium text-foreground hover:no-underline">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Favorites
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-0 pt-0 [&>div]:pb-0">
                <div className="flex flex-col gap-1">
                  <DropdownMenuItem asChild>
                    <Link
                      href="/llms?favorites=true"
                      className="flex w-full items-center gap-2"
                    >
                      <span>LLMs</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/gpus?favorites=true"
                      className="flex w-full items-center gap-2"
                    >
                      <span>GPUs</span>
                    </Link>
                  </DropdownMenuItem>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {isAuthenticated ? (
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex w-full items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link
              href="https://openstatus.dev/submit"
              className="flex w-full items-center gap-2"
            >
              <Send className="h-4 w-4" />
              <span>Submit</span>
            </Link>
          </DropdownMenuItem>
          {!isAuthenticated ? (
            <DropdownMenuItem
              onSelect={() => {
                onSignIn?.();
              }}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            asChild
            onSelect={(event) => {
              event.preventDefault();
            }}
          >
            <ModeToggle appearance="menu" />
          </DropdownMenuItem>
          {isAuthenticated ? (
            <>
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
  showUserMenuFooter?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export function SidebarPanel({
  user,
  isSigningOut,
  onSignOut,
  className,
  showUserMenuFooter = true,
  onSignIn,
  onSignUp,
}: SidebarPanelProps) {
  const isAuthenticated = Boolean(user);
  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="mx-auto w-full max-w-full">
          <DataTableFilterControls />
        </div>
      </div>
      {showUserMenuFooter ? (
        <div className="flex-shrink-0 border-t border-border p-2">
          <UserMenu
            user={user}
            onSignOut={onSignOut}
            isSigningOut={isSigningOut}
            onSignIn={onSignIn}
            onSignUp={onSignUp}
            forceUnauthSignInButton
            isAuthenticated={isAuthenticated}
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
  sheetTitle = "Search",
}: MobileTopNavProps) {
  return (
    <NavigationMenu className="flex w-full max-w-none justify-between sm:hidden px-2">
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
              side="right"
              className="overflow-y-auto p-0 sm:max-w-md"
              hideClose
            >
              <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <SheetTitle className="text-sm font-semibold">
                    {sheetTitle}
                  </SheetTitle>
                  <SheetClose asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </SheetClose>
                </div>
              </SheetHeader>
              <SheetDescription className="sr-only">
                Filters and account options
              </SheetDescription>
              <div className="p-4">{renderSidebar()}</div>
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
