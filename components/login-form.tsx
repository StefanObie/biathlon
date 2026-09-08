"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  requestLogin,
  requestSignup,
  type RequestLoginState,
  type RequestSignupState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

const initialLoginState: RequestLoginState = {};
const initialSignupState: RequestSignupState = {};

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [loginState, loginAction, loginPending] = useActionState(
    requestLogin,
    initialLoginState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    requestSignup,
    initialSignupState,
  );

  const needsInviteCode = loginState.status === "needs_invite_code";

  useEffect(() => {
    if (loginState.status === "otp_sent" || signupState.status === "otp_sent") {
      setStep("code");
    }
  }, [loginState.status, signupState.status]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      router.push("/leagues");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "code") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Enter your code</CardTitle>
            <CardDescription>We sent a 6-digit code to {email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="code">Code</FieldLabel>
                  <InputOTP
                    id="code"
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </Field>
                {error && (
                  <Field data-invalid>
                    <FieldError>{error}</FieldError>
                  </Field>
                )}
                <Field>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || code.length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Verify"}
                  </Button>
                  <FieldDescription className="text-center">
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={() => {
                        setStep("email");
                        setCode("");
                        setInviteCode("");
                        setError(null);
                      }}
                    >
                      Use a different email
                    </button>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            {needsInviteCode
              ? "New account — enter your team's invite code to continue"
              : "Enter your email below and we'll send you a login code"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={needsInviteCode ? signupAction : loginAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {needsInviteCode && (
                <Field>
                  <FieldLabel htmlFor="inviteCode">Invite code</FieldLabel>
                  <Input
                    id="inviteCode"
                    name="inviteCode"
                    placeholder="Ask your league admin"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </Field>
              )}
              {(loginState.error || signupState.error) && (
                <Field data-invalid>
                  <FieldError>
                    {loginState.error || signupState.error}
                  </FieldError>
                </Field>
              )}
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginPending || signupPending}
                >
                  {needsInviteCode ? "Create account" : "Send code"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
