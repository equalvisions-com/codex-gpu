"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Palette, UserRound, ChevronRight, Lock } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

const navItems = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "security", label: "Security", icon: Lock },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "notifications", label: "Notifications", icon: Bell },
];

export function SettingsDialog({ open, onOpenChange, user }: SettingsDialogProps) {
  const router = useRouter();
  const [activeItem, setActiveItem] = React.useState(navItems[0].value);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, startDelete] = React.useTransition();
  const activeLabel =
    navItems.find((item) => item.value === activeItem)?.label ?? "Settings";

  const displayName = user?.name?.trim() ?? "";
  const displayEmail = user?.email?.trim() ?? "";
  const displayImage = user?.image ?? "";
  const fallbackInitial = (displayName || displayEmail || "A").charAt(0).toUpperCase();

  const handleDeleteDialogChange = (nextOpen: boolean) => {
    setIsDeleteDialogOpen(nextOpen);
    if (!nextOpen) {
      setDeleteError(null);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteError(null);
    startDelete(async () => {
      try {
        await authClient.deleteUser({ callbackURL: "/" });
        handleDeleteDialogChange(false);
        onOpenChange(false);
        router.replace("/", { scroll: false });
        router.refresh();
      } catch (error) {
        console.error("Failed to delete account", error);
        setDeleteError("Unable to delete your account. Please try again.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-3xl flex-col gap-0 border border-border/60 bg-background p-0 sm:p-0 h-[560px] overflow-hidden [&>button:last-of-type]:top-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid h-full flex-1 grid-cols-12">
          <aside className="col-span-4 hidden h-full border-r border-border/60 bg-muted/40 sm:block">
            <div className="h-full overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeItem === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setActiveItem(item.value)}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                        "text-foreground hover:text-foreground hover:border-border/70 hover:bg-gradient-to-b hover:from-muted/70 hover:via-muted/40 hover:to-background",
                        isActive
                          ? "border-border/70 bg-gradient-to-b from-muted/70 via-muted/40 to-background text-foreground"
                          : "border-transparent",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
          <section className="col-span-12 h-full overflow-hidden bg-background sm:col-span-8">
            <div className="flex items-center gap-2 px-6 pt-6 text-sm text-muted-foreground">
              <span className="text-foreground/70">Settings</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
              <span className="font-medium text-foreground">{activeLabel}</span>
            </div>
            <div className="px-6 pt-3 sm:hidden">
              <Select value={activeItem} onValueChange={setActiveItem}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent align="start">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SelectItem key={item.value} value={item.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-[calc(100%-56px)]">
              <div className="px-6 py-5">
                {activeItem === "profile" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Profile</div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Manage your profile details and preferences.
                            </p>
                          </div>
                          <Button size="sm" variant="outline">Edit profile</Button>
                        </div>
                        <Avatar className="h-12 w-12">
                          {displayImage ? (
                            <AvatarImage src={displayImage} alt={displayName || "Avatar"} />
                          ) : null}
                          <AvatarFallback className="text-base font-semibold">
                            {fallbackInitial}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="settings-name">Name</Label>
                          <Input
                            id="settings-name"
                            defaultValue={displayName}
                            placeholder="Ada Lovelace"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="settings-email">Email</Label>
                          <Input
                            id="settings-email"
                            type="email"
                            defaultValue={displayEmail}
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeItem === "security" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            Sign-in security
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Update your password and review access controls.
                          </p>
                        </div>
                        <Button size="sm">Change Password</Button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">
                            Delete account
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Permanently remove your account and all associated data.
                          </p>
                        </div>
                        <Dialog open={isDeleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteDialogChange(true)}>
                            Delete
                          </Button>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete account</DialogTitle>
                              <DialogDescription>
                                This will immediately remove your account and data. This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            {deleteError ? (
                              <p className="text-sm text-destructive">{deleteError}</p>
                            ) : null}
                            <div className="flex justify-end gap-3 pt-2">
                              <Button variant="outline" onClick={() => handleDeleteDialogChange(false)} disabled={isDeleting}>
                                Cancel
                              </Button>
                              <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                                {isDeleting ? "Deleting..." : "Delete account"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeItem === "appearance" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">Theme</div>
                          <p className="text-sm text-muted-foreground">
                            Switch between light, dark, or system.
                          </p>
                        </div>
                        <ModeToggle className="shrink-0 rounded-lg border border-border/60 bg-background hover:bg-muted" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeItem === "notifications" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                      <div className="text-sm font-semibold text-foreground">
                        Notifications
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Control alerts and delivery preferences.
                      </p>
                      <div className="mt-4 space-y-3 text-sm">
                        <label className="flex items-start gap-3">
                          <Checkbox />
                          <div>
                            <div className="font-medium text-foreground">
                              Product updates
                            </div>
                            <p className="text-muted-foreground">
                              Release notes, beta access, and feature
                              announcements.
                            </p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3">
                          <Checkbox />
                          <div>
                            <div className="font-medium text-foreground">
                              Billing alerts
                            </div>
                            <p className="text-muted-foreground">
                              Invoices, payment issues, and usage thresholds.
                            </p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3">
                          <Checkbox />
                          <div>
                            <div className="font-medium text-foreground">
                              Security
                            </div>
                            <p className="text-muted-foreground">
                              New device sign-ins and sensitive account changes.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}

              </div>
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
