"use client";

import { useIsAdmin } from "../db";
import { Empty } from "@/ui/Surface";
import { ButtonLink } from "@/ui/Button";
import { AdminDashboard } from "./dashboard";
import { RoleManager } from "./roles";
import { ConfigEditor } from "./config-editor";
import { ConfigHistory } from "./config-history";
import { DevControls } from "./dev-controls";
import { PageHeader } from "../page-header";

/**
 * Decides whether to draw the admin screen at all.
 *
 * Client-side rather than in a server component, because the role lives in Convex and the
 * identity that resolves it is the Clerk JWT the browser holds. A server component would
 * have to re-authenticate to reach the same answer, and would still be no more secure —
 * the queries behind this page each call `requireAdmin` themselves, which is the check
 * that actually matters. This one only decides what to render.
 *
 * Three states, kept distinct on purpose: still asking, not allowed, allowed. Collapsing
 * the first two shows a "you can't be here" message to an admin for the length of a
 * round-trip, which is the one person it should never show.
 */
export function AdminGate() {
  const me = useIsAdmin();

  if (me === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <p className="text-body text-muted" role="status">
          Checking your access…
        </p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <Empty
          title="Not your screen"
          body="This page is for whoever runs the game. If that should be you, ask an existing admin to add you."
          action={
            <ButtonLink href="/" variant="secondary">
              Go home
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader parent={{ href: "/", label: "Home" }} title="Admin" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
        <RoleManager />
        {/* Dev features first: it is the switch most likely to be the reason someone
            opened this page, and it gates surfaces the rest of the screen describes. */}
        <DevControls />
        <ConfigEditor />
        <ConfigHistory />
        <AdminDashboard />
      </div>
    </>
  );
}
