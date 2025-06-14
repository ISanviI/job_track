import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "../(auth)/components/button-signout";
import { getMe } from "@/actions/user";

export default async function Home() {
  const me = await getMe();

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] items-start justify-items-center gap-4 p-4 font-[family-name:var(--font-geist-sans)]">
      <main className="w-full max-w-7xl">
        <nav className="flex w-full items-center justify-between border-b pb-4">
          <Link href="/" className="text-xl font-semibold">
            Track Job Postings
          </Link>
          <div>
            {me ? (
              <div className="flex w-full flex-col gap-5">
                <h2>Hi, {me.name}</h2>
                <p>{me.email}</p>
                <SignOutButton />
              </div>
            ) : (
              <Link
                href="/signin"
                className={cn(buttonVariants({ variant: "default" }), "ml-auto")}
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
}
