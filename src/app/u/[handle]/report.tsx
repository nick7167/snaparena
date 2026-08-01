"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { Field, Input } from "@/ui/Input";

/**
 * Bio reporting.
 *
 * Deliberately understated — a prominent Report control invites use as a weapon rather
 * than as a last resort. It sits at the bottom of the profile, collapsed.
 *
 * The mutation now requires several distinct reporters before anything is hidden, so
 * the copy is careful not to promise an outcome this action alone will not produce.
 */
export function ReportDialog({
  userId,
  displayName,
}: {
  userId: Id<"users">;
  displayName: string;
}) {
  const reportBio = useMutation(api.users.reportBio);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ duplicate: boolean; hidden: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  if (result) {
    return (
      <Card className="flex flex-col gap-1 p-4">
        <p className="text-body text-paper font-semibold">
          {result.duplicate ? "You've already reported this" : "Report received"}
        </p>
        <p className="text-body-sm text-muted">
          {result.hidden
            ? "This bio is now hidden pending review."
            : "It'll be reviewed. Bios are hidden once enough separate players report them."}
        </p>
      </Card>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-body-sm text-muted hover:text-paper self-start rounded-xs px-2 py-1 transition-colors"
      >
        Report this bio
      </button>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-body text-paper font-semibold">
          Report {displayName}&rsquo;s bio
        </p>
        <p className="text-body-sm text-muted">
          For bios that are abusive or offensive. Reports are attributed to your account.
        </p>
      </div>

      <Field
        label="What's wrong with it?"
        htmlFor="report-reason"
        error={error}
        count={`${reason.length}/200`}
      >
        <Input
          id="report-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 200))}
          placeholder="Briefly, so a human can act on it"
          maxLength={200}
          invalid={error !== null}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          loading={sending}
          disabled={reason.trim().length < 3}
          onClick={async () => {
            setSending(true);
            setError(null);
            try {
              const outcome = await reportBio({ userId, reason: reason.trim() });
              setResult({ duplicate: outcome.duplicate, hidden: outcome.hidden });
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not send that");
              setSending(false);
            }
          }}
        >
          Send report
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
