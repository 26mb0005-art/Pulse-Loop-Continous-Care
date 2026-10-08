import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { PRODUCT } from "@/lib/product";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Link to="/" aria-label="PULSE LOOP home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-8 text-center text-xs text-muted-foreground">{PRODUCT.tagline}</p>
        </div>
      </main>
    </div>
  );
}
