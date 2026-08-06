"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { Card, SectionLabel, Skeleton } from "@/ui/Surface";
import { Avatar } from "@/game/ui";

/**
 * Grant and revoke the admin role.
 *
 * Follows the shape every section of /settings uses — SectionLabel, a Card, a Field, a
 * save button, an error line, an explainer underneath — because this is the same kind of
 * thing and inventing a second pattern for it would only make both harder to read.
 *
 * By handle rather than by a picker: the admin list is small and the person doing this
 * already knows who they mean. A searchable list of every player would be a much bigger
 * component that answers a question nobody asked.
 */
export function RoleManager() {
  const admins = useQuery(api.roles.listAdmins, {});
  const setRole = useMutation(api.roles.setRole);

  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const trimmed = handle.trim().replace(/^@/, "");

  async function submit(admin: boolean) {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const result = await setRole({ handle: trimmed, admin });
      setDone(
        admin ? `@${result.handle} is now an admin.` : `@${result.handle} is no longer an admin.`,
      );
      setHandle("");
    } catch (caught) {
      // Convex prefixes thrown messages with its own bracketed context; the part after it
      // is the sentence written for this screen. Same trim as settings/page.tsx.
      const message = caught instanceof Error ? caught.message : "That did not work";
      setError(message.replace(/^\[.*?\]\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Admins</SectionLabel>

      <Card className="flex flex-col gap-4 p-5">
        <Field
          label="Username"
          htmlFor="admin-role-handle"
          error={error}
          help="Who to grant or remove the admin role for."
        >
          <Input
            id="admin-role-handle"
            size="lg"
            prefix="@"
            value={handle}
            invalid={error !== null}
            placeholder="username"
            autoComplete="off"
            onChange={(event) => {
              setHandle(event.target.value.toLowerCase());
              setError(null);
              setDone(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit(true);
              }
            }}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit(true)} loading={busy} disabled={!trimmed}>
            Make admin
          </Button>
          <Button
            variant="secondary"
            onClick={() => void submit(false)}
            loading={busy}
            disabled={!trimmed}
          >
            Remove admin
          </Button>
          {done && (
            <span className="text-body-sm text-muted" role="status">
              {done}
            </span>
          )}
        </div>

        <div className="border-line flex flex-col gap-2 border-t pt-4">
          <span className="text-label text-muted font-semibold tracking-label uppercase">
            Currently admins
          </span>
          {admins === undefined ? (
            <Skeleton className="h-10" />
          ) : admins.length === 0 ? (
            // Only reachable by revoking down to nobody, which setRole forbids for the
            // caller — so in practice this means the list query outran a fresh grant.
            <p className="text-body-sm text-muted">Nobody yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {admins.map((admin) => (
                <li
                  key={admin.userId}
                  className="bg-ink-600 flex items-center gap-2 rounded-xs px-2 py-1"
                >
                  <Avatar name={admin.displayName} url={admin.avatarUrl} className="size-6" />
                  <span className="text-body-sm font-semibold">@{admin.handle}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <p className="text-body-sm text-muted">
        Admins can see the developer tools and this screen, and can grant the role to
        anyone else. You cannot remove your own role — if you could, the last admin could
        lock everyone out.
      </p>
    </section>
  );
}
