import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "../actions";

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string;
    redirectTo?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine">
          Login
        </p>
        <h2 className="mt-3 font-display text-3xl text-ink">Welcome back</h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Sign in to continue to your fitness tracker.
        </p>
      </div>

      <AuthForm
        action={loginAction}
        mode="login"
        redirectTo={params.redirectTo}
        message={params.message}
      />

      <p className="mt-6 text-sm text-ink/65">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-pine underline-offset-4 hover:underline">
          Sign up
        </Link>
        .
      </p>
    </div>
  );
}
