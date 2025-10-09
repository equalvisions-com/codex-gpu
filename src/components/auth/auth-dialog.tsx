"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Github } from "@/components/icons/github";
import { Google } from "@/components/icons/google";
import { HuggingFace } from "@/components/icons/huggingface";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/providers/auth-client-provider";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type AuthView = "signIn" | "signUp";

interface AuthDialogProps {
  open: boolean;
  initialView: AuthView;
  onOpenChange: (open: boolean) => void;
  onViewChange?: (view: AuthView) => void;
  onComplete?: (destination: string) => void;
  callbackUrl?: string;
  errorCallbackUrl?: string;
  defaultEmail?: string;
}

export function AuthDialog({
  open,
  initialView,
  onOpenChange,
  onViewChange,
  onComplete,
  callbackUrl = "/",
  errorCallbackUrl,
  defaultEmail,
}: AuthDialogProps) {
  const seededEmail = React.useRef(false);
  const [view, setView] = React.useState<AuthView>(initialView);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [socialPending, setSocialPending] = React.useState<"github" | "google" | "huggingface" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { refetch } = useAuth();

  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

  React.useEffect(() => {
    if (defaultEmail && !seededEmail.current) {
      setEmail(defaultEmail);
      seededEmail.current = true;
    }
  }, [defaultEmail, open]);

  React.useEffect(() => {
    if (!open) {
      setPending(false);
      setSocialPending(null);
      setError(null);
      setPassword("");
      setName("");
      if (!defaultEmail) {
        setEmail("");
      }
      seededEmail.current = false;
    }
  }, [defaultEmail, open]);

  const copy = React.useMemo(() => {
    if (view === "signIn") {
      return {
        title: "Sign in to OpenStatus",
        description: "Welcome back! Please sign in to continue.",
        cta: pending ? "Signing in…" : "Continue",
        alternateLabel: "Don’t have an account?",
        alternateAction: "Sign up",
      };
    }

    return {
      title: "Create your OpenStatus account",
      description: "Start building with OpenStatus in just a couple of steps.",
      cta: pending ? "Creating…" : "Create account",
      alternateLabel: "Already have an account?",
      alternateAction: "Sign in",
    };
  }, [pending, view]);

  const switchView = React.useCallback(
    (next: AuthView) => {
      if (next === view) return;
      setView(next);
      setError(null);
      onViewChange?.(next);
    },
    [onViewChange, view]
  );

  const handleEmailSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const result = await authClient.signIn.email(
        {
          email,
          password,
          callbackURL: callbackUrl,
        },
        {
          onError: (ctx) => setError(ctx.error.message),
        }
      );

      if (!result.error) {
        await refetch();
        onComplete?.(callbackUrl);
      }
    } catch (err) {
      setError("We could not sign you in. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleEmailSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const normalizedName = name.trim();
      const result = await authClient.signUp.email(
        {
          email,
          password,
          name: normalizedName,
          callbackURL: callbackUrl,
        },
        {
          onError: (ctx) => setError(ctx.error.message),
        }
      );

      if (!result.error) {
        await refetch();
        onComplete?.(callbackUrl);
      }
    } catch (err) {
      setError("We could not create your account. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setSocialPending("google");
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
        errorCallbackURL: errorCallbackUrl ?? callbackUrl ?? "/",
        newUserCallbackURL: callbackUrl,
      });
    } catch (err) {
      setError("Google sign in failed. Please try again.");
      setSocialPending(null);
    }
  };

  const handleGithub = async () => {
    setSocialPending("github");
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: callbackUrl,
        errorCallbackURL: errorCallbackUrl ?? callbackUrl ?? "/",
        newUserCallbackURL: callbackUrl,
      });
    } catch (err) {
      setError("GitHub sign in failed. Please try again.");
      setSocialPending(null);
    }
  };

  const handleHuggingFace = async () => {
    setSocialPending("huggingface");
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "huggingface",
        callbackURL: callbackUrl,
        errorCallbackURL: errorCallbackUrl ?? callbackUrl ?? "/",
        newUserCallbackURL: callbackUrl,
      });
    } catch (err) {
      setError("Hugging Face sign in failed. Please try again.");
      setSocialPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md gap-0 p-0 sm:rounded-2xl", "border-border bg-background")}>
        <div className="grid gap-4 p-4">
          <DialogHeader className="text-left">
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex items-center justify-center gap-3">
              <SocialButton
                provider="google"
                icon={Google}
                pending={socialPending === "google"}
                disabled={socialPending !== null}
                onClick={handleGoogle}
                label="Continue with Google"
              />
              <SocialButton
                provider="github"
                icon={Github}
                pending={socialPending === "github"}
                disabled={socialPending !== null}
                onClick={handleGithub}
                label="Continue with GitHub"
              />
              <SocialButton
                provider="huggingface"
                icon={HuggingFace}
                pending={socialPending === "huggingface"}
                disabled={socialPending !== null}
                onClick={handleHuggingFace}
                label="Continue with Hugging Face"
              />
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <Separator className="flex-1" />
              <span>or</span>
              <Separator className="flex-1" />
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {view === "signIn" ? (
            <form className="grid gap-4" onSubmit={handleEmailSignIn}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={pending}>
                {copy.cta}
              </Button>
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={handleEmailSignUp}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={pending}>
                {copy.cta}
              </Button>
            </form>
          )}

          <div className="grid gap-3">
            <div className="text-center text-sm text-muted-foreground">
              {copy.alternateLabel}{" "}
              <Button
                type="button"
                variant="link"
                className="px-0 text-sm"
                onClick={() =>
                  switchView(view === "signIn" ? "signUp" : "signIn")
                }
              >
                {copy.alternateAction}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SocialButtonProps {
  provider: "github" | "google" | "huggingface";
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  label: string;
}

function SocialButton({
  icon: Icon,
  onClick,
  disabled,
  pending,
  label,
}: SocialButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex py-2 w-full items-center justify-center rounded-lg border border-border bg-background transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
