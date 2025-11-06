"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/custom/accordion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/custom/sheet";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Bot,
  EllipsisVertical,
  LogIn,
  LogOut,
  Search,
  Server,
  Settings as SettingsIcon,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

const gradientSurfaceClass =
  "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-accent-foreground hover:bg-gradient-to-b hover:from-muted/70 hover:via-muted/40 hover:to-background hover:text-accent-foreground";

const dropdownMenuItemClassName =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:no-underline focus-visible:bg-muted focus-visible:text-accent-foreground";

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
  const avatarWrapperClass = avatarSizeClass;
  const avatarImageClass = "h-full w-full rounded-full object-cover";
  const inferredAuthenticated = Boolean(normalizedName || email || user?.image);
  const isAuthenticated = isAuthenticatedProp ?? inferredAuthenticated;
  const shouldRenderAvatar = (showDetails || hasImage) && user;
  const hasSignInHandler = typeof onSignIn === "function";
  const shouldForceSignInButton =
    forceUnauthSignInButton && !isAuthenticated && hasSignInHandler;
  const isSplitTrigger =
    !showDetails && !isAuthenticated && !shouldForceSignInButton;
  const secondaryText = isAuthenticated ? (email ?? "") : "Sign up or Sign in";
  const router = useRouter();
  const navigateWithRefresh = React.useCallback(
    (pathname: string) => {
      router.push(pathname);
      router.refresh();
    },
    [router],
  );

  const handleSignInClick = React.useCallback(() => {
    onSignIn?.();
  }, [onSignIn]);

  const handleSignUpClick = React.useCallback(() => {
    onSignUp?.();
  }, [onSignUp]);

  const triggerAriaLabel = !showDetails ? displayName : undefined;

  let triggerElement: React.ReactNode;

  if (shouldForceSignInButton) {
    const buttonClassName = cn(
      "flex h-auto items-center gap-2 rounded-md p-2 text-left text-sm font-medium text-foreground hover:text-accent-foreground",
      showDetails
        ? "bg-transparent hover:bg-transparent"
        : gradientSurfaceClass,
      fullWidth ? "w-full" : "w-auto",
      !showDetails
        ? "!gap-1.5 rounded-md !px-2 !py-1.5 md:h-9 md:rounded-md"
        : null,
    );
    const ariaLabel = showDetails ? undefined : (triggerAriaLabel ?? "Sign in");

    triggerElement = (
      <div
        className={cn(
          "flex items-center gap-2",
          fullWidth ? "w-full" : "w-auto",
          triggerClassName,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            buttonClassName,
            showDetails ? "justify-between" : "justify-start",
            fullWidth && "flex-1",
          )}
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
                <span className="truncate font-semibold">{displayName}</span>
                {secondaryText ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {secondaryText}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 text-foreground" />
              <span className="sr-only">Sign in</span>
            </>
          )}
        </Button>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto flex h-9 w-9 justify-end px-0 hover:bg-transparent"
            aria-label="Open account menu"
            disabled={isSigningOut}
          >
            <EllipsisVertical className="h-4 w-4 text-foreground" />
            <span className="sr-only">Open account menu</span>
          </Button>
        </DropdownMenuTrigger>
      </div>
    );
  } else if (isSplitTrigger) {
    triggerElement = (
      <div
        role="group"
        aria-label="Account actions"
        className={cn(
          "flex items-center overflow-hidden",
          triggerClassName,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-9 min-w-[76px] flex-1 rounded-none rounded-l-sm px-3 text-sm font-medium",
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
              "h-9 w-9 rounded-none rounded-r-sm px-0",
              "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-accent-foreground shadow-[0_1px_0_0_hsl(var(--foreground)_/_6%),0_4px_8px_-10px_hsl(var(--foreground)_/_28%)]",
            )}
            aria-label="Open account menu"
            disabled={isSigningOut}
          >
            <span className="relative flex w-[18px] items-center justify-center text-foreground">
              <span className="absolute h-px w-3 -translate-y-1 rounded-full bg-current" />
              <span className="absolute h-px w-3 rounded-full bg-current" />
              <span className="absolute h-px w-3 translate-y-1 rounded-full bg-current" />
            </span>
          </Button>
        </DropdownMenuTrigger>
      </div>
    );
  } else {
    triggerElement = (
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "flex h-auto items-center gap-4 rounded-md p-2 text-left text-sm font-medium text-foreground hover:text-accent-foreground",
            showDetails
              ? "bg-transparent hover:bg-transparent"
              : cn(
                  gradientSurfaceClass,
                  "hover:bg-transparent",
                ),
            fullWidth ? "w-full justify-start" : "w-auto justify-center",
            !showDetails
              ? "!gap-1.5 rounded-md !px-2 !py-1.5 md:h-9 md:rounded-md"
              : null,
            triggerClassName,
          )}
          disabled={isSigningOut}
          aria-label={triggerAriaLabel}
        >
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
          {showDetails ? (
            <EllipsisVertical className="h-4 w-4 text-foreground/60" />
          ) : null}
          {!showDetails ? (
            <span className="relative flex w-[18px] items-center justify-center text-foreground">
              <span className="absolute h-px w-3 -translate-y-1 rounded-full bg-current" />
              <span className="absolute h-px w-3 rounded-full bg-current" />
              <span className="absolute h-px w-3 translate-y-1 rounded-full bg-current" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
    );
  }

  return (
    <div>
      <DropdownMenu>
        {triggerElement}
        <DropdownMenuContent
          align="center"
          className="w-60 mr-2 sm:mr-0"
        >
          <div className="flex flex-col space-y-1">
            <DropdownMenuItem
              onSelect={() => navigateWithRefresh("/llms")}
              className={cn(dropdownMenuItemClassName, "sm:hidden")}
            >
              <Bot className="h-4 w-4" />
              <span>LLMs</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigateWithRefresh("/gpus")}
              className={cn(dropdownMenuItemClassName, "sm:hidden")}
            >
              <Server className="h-4 w-4" />
              <span>GPUs</span>
            </DropdownMenuItem>
            {isAuthenticated ? (
              <Accordion
                type="single"
                collapsible
                className="-mx-2 w-[calc(100%+16px)] px-2"
              >
                <AccordionItem value="favorites" className="border-none">
                  <AccordionTrigger className="flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:no-underline focus-visible:bg-muted focus-visible:text-accent-foreground [&>svg]:hidden">
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Favorites
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pt-0 [&>div]:pb-0">
                    <div className="flex flex-col gap-1">
                      <DropdownMenuItem
                        onSelect={() => navigateWithRefresh("/llms?favorites=true")}
                        className={dropdownMenuItemClassName}
                      >
                        <span>LLMs</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => navigateWithRefresh("/gpus?favorites=true")}
                        className={dropdownMenuItemClassName}
                      >
                        <span>GPUs</span>
                      </DropdownMenuItem>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
            {isAuthenticated ? (
              <DropdownMenuItem asChild>
                <Link
                  href="/settings"
                  className={dropdownMenuItemClassName}
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            asChild
            onSelect={(event) => {
              event.preventDefault();
            }}
            className={dropdownMenuItemClassName}
          >
            <ModeToggle appearance="menu" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={dropdownMenuItemClassName}
            onSelect={() => {
              if (isAuthenticated) {
                if (!isSigningOut) {
                  onSignOut();
                }
              } else {
                onSignIn?.();
              }
            }}
            disabled={isAuthenticated && isSigningOut}
          >
            {isAuthenticated ? (
              <LogOut className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            <span>
              {isAuthenticated
                ? isSigningOut
                  ? "Signing out..."
                  : "Sign out"
                : "Sign in"}
            </span>
          </DropdownMenuItem>
          {isAuthenticated ? (
            <>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuLabel className="flex items-center gap-2 pt-2 sm:hidden">
                <Avatar className="h-8 w-8">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={displayName} />
                  ) : null}
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {displayName}
                  </span>
                  {email ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuLabel>
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
      <div className="scrollbar-hide flex-1 overflow-y-auto">
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
    <NavigationMenu className="flex w-full max-w-none justify-between px-2 sm:hidden">
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
