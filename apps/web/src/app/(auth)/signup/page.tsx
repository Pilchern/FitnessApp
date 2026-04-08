import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signupAction } from "../actions";

type SignupPageProps = {
  searchParams?: Promise<{
    redirectTo?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine">
          Sign up
        </p>
        <h2 className="mt-3 font-display text-3xl text-ink">
          Create your account
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Create your account to start tracking your fitness.
        </p>
      </div>

      <AuthForm
        action={signupAction}
        mode="signup"
        redirectTo={params.redirectTo}
      />

      <p className="mt-6 text-sm text-ink/65">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-pine underline-offset-4 hover:underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
