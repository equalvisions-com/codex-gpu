"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bell, Palette, UserRound, ChevronRight, Lock, MessageSquare } from "lucide-react";
import { SettingsContactForm } from "./settings-contact-form";
import { SettingsSubmitForm } from "./settings-submit-form";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  isAuthenticated?: boolean;
}

const navItems = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "security", label: "Security", icon: Lock },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "contact", label: "Contact", icon: MessageSquare },
];
const passwordProviderIds = ["email", "credentials", "credential", "password"];

export function SettingsDialog({ open, onOpenChange, user, isAuthenticated = true }: SettingsDialogProps) {
  const router = useRouter();
  const filteredNavItems = React.useMemo(
    () =>
      isAuthenticated
        ? navItems
        : navItems.filter((item) => item.value === "appearance" || item.value === "contact"),
    [isAuthenticated]
  );
  const [activeItem, setActiveItem] = React.useState(filteredNavItems[0].value);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({ current: "", next: "", confirm: "" });
  const [revokeOtherSessions, setRevokeOtherSessions] = React.useState(true);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = React.useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = React.useState(false);
  const [revokeSessionsMessage, setRevokeSessionsMessage] = React.useState<string | null>(null);
  const [revokeSessionsError, setRevokeSessionsError] = React.useState<string | null>(null);
  const [isNewsletterSubscribed, setIsNewsletterSubscribed] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [isContactFormOpen, setIsContactFormOpen] = React.useState(false);
  const [isSubmitFormOpen, setIsSubmitFormOpen] = React.useState(false);
  const isMounted = React.useRef(true);
  const activeLabel =
    filteredNavItems.find((item) => item.value === activeItem)?.label ?? "Settings";

  const initialName = user?.name?.trim() ?? "";
  const displayEmail = user?.email?.trim() ?? "";
  const displayImage = user?.image ?? "";
  const [profileName, setProfileName] = React.useState(initialName);
  const [nameInput, setNameInput] = React.useState(initialName);
  const closeResetTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    setProfileName(initialName);
    setNameInput(initialName);
  }, [initialName]);
  React.useEffect(() => {
    if (closeResetTimeout.current) {
      clearTimeout(closeResetTimeout.current);
      closeResetTimeout.current = null;
    }
    if (open) return;
    closeResetTimeout.current = setTimeout(() => {
      setActiveItem(filteredNavItems[0].value);
      setIsDeleteDialogOpen(false);
      setDeleteError(null);
      setIsEditingProfile(false);
      setProfileError(null);
      setIsSavingProfile(false);
      setProfileName(initialName);
      setNameInput(initialName);
      setIsChangingPassword(false);
      setPasswordForm({ current: "", next: "", confirm: "" });
      setRevokeOtherSessions(true);
      setPasswordError(null);
      setPasswordSuccess(null);
      setIsSavingPassword(false);
      setRevokeSessionsMessage(null);
      setRevokeSessionsError(null);
      setIsRevokingSessions(false);
      setIsDeleting(false);
      setIsNewsletterSubscribed(false);
      setDeletePassword("");
      setIsContactFormOpen(false);
      setIsSubmitFormOpen(false);
      closeResetTimeout.current = null;
    }, 200);
    return () => {
      if (closeResetTimeout.current) {
        clearTimeout(closeResetTimeout.current);
        closeResetTimeout.current = null;
      }
    };
  }, [open, initialName, filteredNavItems]);
  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  const fallbackInitial = (profileName || displayEmail || "A").charAt(0).toUpperCase();

  const handleDeleteDialogChange = (nextOpen: boolean) => {
    setIsDeleteDialogOpen(nextOpen);
    if (!nextOpen) {
      setDeleteError(null);
      setDeletePassword("");
    }
  };

  const resetPasswordForm = () => {
    setPasswordForm({ current: "", next: "", confirm: "" });
    setPasswordError(null);
  };

  const handleTogglePassword = () => {
    setIsChangingPassword((prev) => {
      const next = !prev;
      if (!next) {
        resetPasswordForm();
        setPasswordSuccess(null);
      }
      return next;
    });
  };

  const handlePasswordFieldChange = (field: keyof typeof passwordForm) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordError("Please complete all password fields.");
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("New passwords must match.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const changeResult = await authClient.changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
        revokeOtherSessions,
      });
      const changeError = (changeResult as { error?: { code?: string; message?: string } } | undefined)?.error;
      if (changeError) {
        const friendlyError =
          changeError.code === "INVALID_PASSWORD"
            ? "Current password is incorrect"
            : changeError.message || "Unable to change your password right now. Please try again.";
        if (isMounted.current) {
          setPasswordError(friendlyError);
        }
        return;
      }
      if (isMounted.current) {
        setPasswordSuccess("Password updated successfully.");
        resetPasswordForm();
        setIsChangingPassword(false);
      }
    } catch (error) {
      console.error("Failed to change password", error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : "Unable to change your password right now. Please try again.";
      if (isMounted.current) {
        setPasswordError(fallbackMessage);
      }
    } finally {
      if (isMounted.current) {
        setIsSavingPassword(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      if (hasEmailPasswordAccount && !deletePassword.trim()) {
        setDeleteError("Please enter your password to delete your account.");
        setIsDeleting(false);
        return;
      }
      const deletionResult = await authClient.deleteUser({
        callbackURL: "/",
        ...(hasEmailPasswordAccount ? { password: deletePassword } : {}),
      });
      const deletionError = (deletionResult as { error?: { message?: string } } | undefined)?.error;
      if (deletionError) {
        if (isMounted.current) {
          setDeleteError(deletionError.message || "Unable to delete your account. Please try again.");
        }
        return;
      }
      if (isMounted.current) {
        handleDeleteDialogChange(false);
        onOpenChange(false);
        router.replace("/", { scroll: false });
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete account", error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : "Unable to delete your account. Please try again.";
      if (isMounted.current) {
        setDeleteError(fallbackMessage);
      }
    } finally {
      if (isMounted.current) {
        setIsDeleting(false);
      }
    }
  };

  const handleProfileAction = async () => {
    if (isSavingProfile) return;
    if (!isEditingProfile) {
      setProfileError(null);
      setIsEditingProfile(true);
      setNameInput(profileName);
      return;
    }
    const nextName = nameInput.trim();
    if (nextName === profileName) {
      setIsEditingProfile(false);
      return;
    }
    setProfileError(null);
    setIsSavingProfile(true);
    try {
      const updateResult = await authClient.updateUser({ name: nextName || undefined });
      const updateError = (updateResult as { error?: { message?: string } } | undefined)?.error;
      if (updateError) {
        if (isMounted.current) {
          setProfileError(updateError.message || "Unable to save your profile right now. Please try again.");
        }
        return;
      }
      if (isMounted.current) {
        setProfileName(nextName);
        setIsEditingProfile(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update profile", error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : "Unable to save your profile right now. Please try again.";
      if (isMounted.current) {
        setProfileError(fallbackMessage);
      }
    } finally {
        if (isMounted.current) {
          setIsSavingProfile(false);
        }
    }
  };

  const shouldFetchAccounts = open && Boolean(user);
  const userKey = user?.id ?? user?.email ?? "anonymous";
  const accountsQuery = useQuery({
    queryKey: ["auth", "accounts", userKey],
    queryFn: async () => {
      try {
        const result = await authClient.listAccounts();
        const listError = (result as { error?: { message?: string } } | undefined)?.error;
        if (listError) {
          throw new Error(listError.message || "Unable to load connected accounts.");
        }
        const data = (result as { data?: unknown } | undefined)?.data ?? result;
        if (Array.isArray(data)) {
          return data;
        }
        throw new Error("Unexpected accounts payload");
      } catch (error) {
        console.error("Failed to load connected accounts", error);
        throw error;
      }
    },
    enabled: shouldFetchAccounts,
    staleTime: Infinity,
  });
  const connectedAccounts = React.useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    if (!Array.isArray(accounts)) return [];
    return accounts
      .map((account) => {
        const typed = account as { providerId?: string; accountId?: string };
        return {
          providerId: typed.providerId?.toLowerCase() ?? "unknown",
          accountId: typed.accountId ?? "",
        };
      })
      .filter((account) => Boolean(account.providerId));
  }, [accountsQuery.data]);
  const providerLabels: Record<string, string> = {
    google: "Google",
    github: "GitHub",
    huggingface: "Hugging Face",
    email: "Email and password",
  };
  const displayConnectedAccounts = React.useMemo(
    () => connectedAccounts.filter((account) => !passwordProviderIds.includes(account.providerId)),
    [connectedAccounts],
  );
  const hasEmailPasswordAccount = React.useMemo(
    () =>
      connectedAccounts.some((account) => passwordProviderIds.includes(account.providerId)),
    [connectedAccounts],
  );
  const isPasswordChangeAllowed = accountsQuery.isSuccess && hasEmailPasswordAccount;

  const handleRevokeOtherSessions = async () => {
    if (isRevokingSessions) return;
    setRevokeSessionsError(null);
    setRevokeSessionsMessage(null);
    setIsRevokingSessions(true);
    try {
      const revokeResult = await authClient.revokeOtherSessions();
      const revokeError = (revokeResult as { error?: { message?: string } } | undefined)?.error;
      if (revokeError) {
        if (isMounted.current) {
          setRevokeSessionsError(revokeError.message || "Unable to revoke other sessions. Please try again.");
        }
        return;
      }
      if (isMounted.current) {
        setRevokeSessionsMessage("Other sessions revoked.");
      }
    } catch (error) {
      console.error("Failed to revoke other sessions", error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : "Unable to revoke other sessions. Please try again.";
      if (isMounted.current) {
        setRevokeSessionsError(fallbackMessage);
      }
    } finally {
      if (isMounted.current) {
        setIsRevokingSessions(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-3xl flex-col gap-0 h-auto h-auto sm:h-[520px] overflow-hidden rounded-lg border border-border/60 bg-background p-0 sm:p-0 [&>button:last-of-type]:top-4 [&>button:last-of-type]:right-4 sm:[&>button:last-of-type]:top-6 sm:[&>button:last-of-type]:right-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid h-full flex-1 grid-cols-12">
          <aside className="col-span-4 hidden h-full border-r border-border/60 bg-muted/40 sm:block">
            <div className="h-full overflow-y-auto px-5 py-6">
              <div className="space-y-2">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeItem === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setActiveItem(item.value)}
                      className={[
                        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none",
                        "text-foreground hover:text-foreground hover:border-border/70 hover:bg-gradient-to-b hover:from-muted/70 hover:via-muted/40 hover:to-background",
                        isActive
                          ? "border-border/70 bg-gradient-to-b from-muted/70 via-muted/40 to-background text-foreground"
                          : "border-transparent",
                      ].join(" ")}
                      aria-current={isActive ? "page" : undefined}
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
            <div className="flex h-full flex-col">
              <div className="px-4 py-4 sm:px-6 sm:pt-6 sm:pb-0">
                <div className="hidden items-center gap-2 text-sm text-foreground/70 sm:flex">
                  <span className="text-foreground/70">Settings</span>
                  <ChevronRight className="h-3 w-3 text-foreground/70" aria-hidden />
                  <span className="font-medium text-foreground">{activeLabel}</span>
                </div>
                <div className="space-y-3 sm:hidden">
                  <p className="text-base font-semibold leading-none tracking-tight text-foreground">
                    Settings
                  </p>
                  <Select value={activeItem} onValueChange={setActiveItem}>
                    <SelectTrigger className="w-full border-border/60">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {filteredNavItems.map((item) => {
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
              </div>
              <ScrollArea className="flex-1 min-h-0" data-disable-hotkeys="true">
                <div className="px-4 pb-4 pt-0 sm:px-6 sm:py-6">
                  {activeItem === "profile" ? (
                    <div className="space-y-4 sm:space-y-6">
                      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">Profile</div>
                          <p className="text-sm text-foreground/70">
                            Manage your profile details and preferences.
                          </p>
                        </div>
                        <div className="mt-5 divide-y divide-border/70">
                          <div
                            className={
                              isEditingProfile
                                ? "flex flex-col gap-3 pb-5 sm:flex-row sm:flex-nowrap sm:items-start sm:gap-5"
                                : "flex flex-row flex-wrap items-start gap-3 pb-5 sm:flex-row sm:flex-nowrap sm:gap-5"
                            }
                          >
                            <Avatar className="h-12 w-12">
                              {displayImage ? (
                                <AvatarImage src={displayImage} alt={profileName || "Avatar"} />
                              ) : null}
                              <AvatarFallback className="text-base font-semibold">
                                {fallbackInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-[180px] space-y-1">
                              <Label htmlFor="settings-name">Name</Label>
                              {isEditingProfile ? (
                                <Input
                                  id="settings-name"
                                  value={nameInput}
                                  onChange={(event) => setNameInput(event.target.value)}
                                  placeholder="Name or organization"
                                  disabled={isSavingProfile}
                                />
                              ) : (
                                <p className="text-sm text-foreground/70">
                                  {profileName || ""}
                                </p>
                              )}
                            </div>
                            <div className="flex w-full justify-end sm:w-auto sm:self-start sm:justify-start">
                              <Button
                                size="sm"
                                variant={isEditingProfile ? "default" : "outline"}
                                onClick={handleProfileAction}
                                disabled={isSavingProfile}
                                className={[
                                  "w-full sm:w-auto transition-colors duration-200",
                                  isEditingProfile ? "sm:mt-[30px]" : "",
                                ].join(" ")}
                              >
                                {isSavingProfile ? "Saving..." : isEditingProfile ? "Save" : "Edit"}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1 py-4">
                            <Label>Email</Label>
                            <p className="text-sm text-foreground/70">
                              {displayEmail || "Not set"}
                            </p>
                          </div>
                          <div className="space-y-1 pt-4">
                            <Label>Connected accounts</Label>
                            {accountsQuery.isLoading ? (
                              <div className="space-y-2">
                                <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
                                <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
                              </div>
                            ) : null}
                            {!accountsQuery.isLoading && !accountsQuery.isError && displayConnectedAccounts.length === 0 ? (
                              <p className="text-sm text-foreground/70">None</p>
                            ) : null}
                            {!accountsQuery.isLoading && !accountsQuery.isError && displayConnectedAccounts.length > 0 ? (
                              <div className="space-y-1.5">
                                {displayConnectedAccounts.map((account) => {
                                  const label = providerLabels[account.providerId] ?? account.providerId;
                                  return (
                                    <p
                                      key={`${account.providerId}:${account.accountId || "default"}`}
                                      className="text-sm text-foreground/70"
                                    >
                                      {label}
                                    </p>
                                  );
                                })}
                              </div>
                            ) : null}
                            {accountsQuery.isError ? (
                              <p className="text-sm text-destructive">
                                Unable to load connected accounts. Please try again.
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {profileError ? (
                          <p className="pt-4 text-sm text-destructive">{profileError}</p>
                        ) : null}
                      </div>
                    </div>
                ) : null}

                {activeItem === "security" ? (
                  <div className="space-y-4 sm:space-y-6">
                    {isPasswordChangeAllowed ? (
                      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">
                              Change password
                            </div>
                            <p className="text-sm text-foreground/70">
                              Update the password associated with your account.
                            </p>
                          </div>
                          {!isChangingPassword ? (
                            <Button size="sm" variant="outline" onClick={handleTogglePassword}>
                              Change
                            </Button>
                          ) : null}
                        </div>
                        {isChangingPassword ? (
                          <form className="mt-5 space-y-5" onSubmit={handlePasswordSubmit}>
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <Label htmlFor="current-password">Current password</Label>
                                <Input
                                  id="current-password"
                                  type="password"
                                  autoComplete="current-password"
                                  value={passwordForm.current}
                                  onChange={handlePasswordFieldChange("current")}
                                  disabled={isSavingPassword}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="new-password">New password</Label>
                                <Input
                                  id="new-password"
                                  type="password"
                                  autoComplete="new-password"
                                  value={passwordForm.next}
                                  onChange={handlePasswordFieldChange("next")}
                                  disabled={isSavingPassword}
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="confirm-password">Confirm new password</Label>
                                <Input
                                  id="confirm-password"
                                  type="password"
                                  autoComplete="new-password"
                                  value={passwordForm.confirm}
                                  onChange={handlePasswordFieldChange("confirm")}
                                  disabled={isSavingPassword}
                                  required
                                />
                              </div>
                            </div>
                            <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
                              <Checkbox
                                id="revoke-sessions"
                                checked={revokeOtherSessions}
                                onCheckedChange={(checked) => setRevokeOtherSessions(Boolean(checked))}
                                disabled={isSavingPassword}
                              />
                              <div className="space-y-1 text-sm">
                                <span className="font-medium text-foreground">Revoke other sessions</span>
                                <p className="text-foreground/70">
                                  Sign out on all other devices after the password changes.
                                </p>
                              </div>
                            </label>
                            {passwordError ? (
                              <p className="text-sm text-destructive" aria-live="polite">
                                {passwordError}
                              </p>
                            ) : null}
                            {passwordSuccess ? (
                              <p className="text-sm text-emerald-500" aria-live="polite">
                                {passwordSuccess}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleTogglePassword}
                                disabled={isSavingPassword}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" size="sm" disabled={isSavingPassword}>
                                {isSavingPassword ? "Saving..." : "Save password"}
                              </Button>
                            </div>
                          </form>
                        ) : null}
                        {!isChangingPassword && passwordSuccess ? (
                          <p className="mt-4 text-sm text-emerald-500" aria-live="polite">
                            {passwordSuccess}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">
                            Session management
                          </div>
                          <p className="text-sm text-foreground/70">
                            Sign out from all other devices and keep this session active.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRevokeOtherSessions}
                          disabled={isRevokingSessions}
                        >
                          {isRevokingSessions ? "Revoking..." : "Revoke"}
                        </Button>
                      </div>
                      {revokeSessionsError ? (
                        <p className="mt-3 text-sm text-destructive">{revokeSessionsError}</p>
                      ) : null}
                      {revokeSessionsMessage ? (
                        <p className="mt-3 text-sm text-emerald-500">{revokeSessionsMessage}</p>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-destructive/60 bg-destructive/5 p-4 shadow-sm shadow-black/5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">
                            Delete account
                          </div>
                          <p className="text-sm text-foreground/70">
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
                            {hasEmailPasswordAccount ? (
                              <div className="space-y-2">
                                <Label htmlFor="delete-password">Password</Label>
                                <Input
                                  id="delete-password"
                                  type="password"
                                  name="delete-password"
                                  autoComplete="new-password"
                                  value={deletePassword}
                                  onChange={(event) => setDeletePassword(event.target.value)}
                                  disabled={isDeleting}
                                />
                              </div>
                            ) : null}
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
                  <div className="space-y-4 sm:space-y-6">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">Theme</div>
                          <p className="text-sm text-foreground/70">
                            Switch between light, dark, or system.
                          </p>
                        </div>
                        <ModeToggle variant="outline" size="sm" className="shrink-0" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeItem === "notifications" ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                      <div className="space-y-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold text-foreground">Subscribe to newsletter</Label>
                            <p className="text-foreground/70">Get product updates and insights.</p>
                          </div>
                          <Switch
                            checked={isNewsletterSubscribed}
                            onCheckedChange={(checked) => setIsNewsletterSubscribed(Boolean(checked))}
                            aria-label="Subscribe to newsletter"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeItem === "contact" ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">Send us a message</div>
                          <p className="text-sm text-foreground/70">
                            Reach out with questions or feedback.
                          </p>
                        </div>
                        {!isContactFormOpen ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsContactFormOpen(true)}
                          >
                            Contact
                          </Button>
                        ) : null}
                      </div>
                      {isContactFormOpen ? (
                        <div className="mt-5">
                          <SettingsContactForm
                            defaultName={user?.name?.trim() ?? ""}
                            defaultEmail={user?.email?.trim() ?? ""}
                            onCancel={() => setIsContactFormOpen(false)}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 shadow-sm shadow-black/5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">Submit</div>
                          <p className="text-sm text-foreground/70">
                            Share an LLM provider, GPU cloud provider, or ML tool.
                          </p>
                        </div>
                        {!isSubmitFormOpen ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsSubmitFormOpen(true)}
                          >
                            Submit
                          </Button>
                        ) : null}
                      </div>
                      {isSubmitFormOpen ? (
                        <div className="mt-5">
                          <SettingsSubmitForm
                            defaultName={user?.name?.trim() ?? ""}
                            defaultEmail={user?.email?.trim() ?? ""}
                            onCancel={() => setIsSubmitFormOpen(false)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

              </div>
            </ScrollArea>
          </div>
        </section>
      </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
