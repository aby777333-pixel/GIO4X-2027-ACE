"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@gio4x/supabase";
import { BASE_PATH, siteOrigin } from "@/lib/base-path";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type AuthActionResult =
  | { ok: true; redirectTo?: string; message?: string }
  | { ok: false; error: string; field?: string };

export type SignupInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: "trader" | "ib" | "affiliate";
  referralCode?: string;
  /** Account type chosen on the website (classic | premium | ecn). */
  plan?: string;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function getEnvInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function getRequestContext() {
  const h = headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  const userAgent = h.get("user-agent") || "";
  const country = h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "";
  return { ip, userAgent, country };
}

// Public base of this app: website origin + base path (…/portal). E-mail
// links are built on it, so it must match Supabase Auth → Redirect URLs.
function siteUrl(): string {
  return `${siteOrigin()}${BASE_PATH}`;
}

// ---------------------------------------------------------------------------
// signUp — creates auth.users; handle_new_user trigger fills profile/wallet
// ---------------------------------------------------------------------------

export async function signUp(input: SignupInput): Promise<AuthActionResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || !input.fullName) {
    return { ok: false, error: "Name, email, and password are required." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters.", field: "password" };
  }

  const supabase = createServerSupabaseClient(cookies());

  const { error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      // New clients land on KYC right after confirming their email.
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/verification`,
      data: {
        full_name: input.fullName,
        phone: input.phone || null,
        role: input.role,
        source: "website",
        referral_code: input.referralCode || null,
        requested_plan: input.plan || null,
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    message: "Check your email to confirm your account.",
    redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`,
  };
}

// ---------------------------------------------------------------------------
// signIn — with lockout enforcement + login_history write
// ---------------------------------------------------------------------------

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = createServerSupabaseClient(cookies());
  const maxAttempts = getEnvInt("AUTH_MAX_FAILED_ATTEMPTS", 5);
  const windowMin = getEnvInt("AUTH_LOCKOUT_MINUTES", 15);
  const { ip, userAgent, country } = getRequestContext();

  // 1) lockout check (RPC)
  const { data: locked, error: lockErr } = await supabase.rpc("check_login_lockout", {
    p_email: email,
    p_max_attempts: maxAttempts,
    p_window_minutes: windowMin,
  });
  if (lockErr) {
    // fail open — don't lock the user out because of an RPC hiccup
    console.warn("check_login_lockout failed:", lockErr.message);
  } else if (locked) {
    await supabase.rpc("record_login_attempt", {
      p_email: email,
      p_success: false,
      p_failure_reason: "locked",
      p_ip: ip,
      p_user_agent: userAgent,
      p_country: country,
    });
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${windowMin} minutes or reset your password.`,
    };
  }

  // 2) sign in
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await supabase.rpc("record_login_attempt", {
      p_email: email,
      p_success: false,
      p_failure_reason: error.message,
      p_ip: ip,
      p_user_agent: userAgent,
      p_country: country,
    });
    return { ok: false, error: error.message };
  }

  // 3) success log + device session
  await supabase.rpc("record_login_attempt", {
    p_email: email,
    p_success: true,
    p_user_id: data.user?.id ?? null,
    p_ip: ip,
    p_user_agent: userAgent,
    p_country: country,
  });

  if (data.user?.id) {
    const deviceId =
      formData.get("device_id")?.toString() ||
      `${userAgent.slice(0, 32)}-${ip.slice(0, 16)}`;
    await supabase
      .from("device_sessions")
      .upsert(
        {
          user_id: data.user.id,
          device_id: deviceId,
          device_label: userAgent.slice(0, 80),
          ip_address: ip || null,
          user_agent: userAgent || null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/" };
}

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  const supabase = createServerSupabaseClient(cookies());
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

// ---------------------------------------------------------------------------
// password reset
// ---------------------------------------------------------------------------

export async function requestPasswordReset(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };

  const supabase = createServerSupabaseClient(cookies());
  // Route the PKCE recovery link through /auth/callback so the `code` is
  // exchanged for a session cookie BEFORE landing on the reset form. Without
  // this the reset page had no session and updateUser() failed with
  // "Auth session missing". The callback then forwards to /auth/reset-password.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset-password`,
  });

  // Don't leak whether the email exists — always say the same thing.
  return {
    ok: true,
    message: "If that email is registered, we just sent a reset link.",
    redirectTo: undefined,
  };
}

export async function setNewPassword(formData: FormData): Promise<AuthActionResult> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters.", field: "password" };
  }
  const supabase = createServerSupabaseClient(cookies());
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/", message: "Password updated." };
}

// ---------------------------------------------------------------------------
// OTP — magic link / email OTP login (passwordless)
// ---------------------------------------------------------------------------

export async function requestEmailOtp(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };

  const supabase = createServerSupabaseClient(cookies());
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/`,
      shouldCreateUser: false,
    },
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    message: "Check your email for a sign-in link or 6-digit code.",
    redirectTo: `/auth/verify-otp?email=${encodeURIComponent(email)}`,
  };
}

export async function verifyEmailOtp(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const token = String(formData.get("token") || "").trim();
  if (!email || !token) return { ok: false, error: "Email and code are required." };

  const supabase = createServerSupabaseClient(cookies());
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/" };
}

// ---------------------------------------------------------------------------
// resend verification
// ---------------------------------------------------------------------------

export async function resendVerification(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };
  const supabase = createServerSupabaseClient(cookies());
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Verification email sent." };
}
