"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useState } from "react";
import { reducers } from "@/module_bindings";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { Field, Input } from "@/ui/Input";

/**
 * Profile reporting, for a bio or an uploaded picture.
 *
 * Deliberately understated — a prominent Report control invites use as a weapon rather
 * than as a last resort. It sits at the bottom of the profile, collapsed.
 *
 * The mutation requires several distinct reporters before anything is hidden, so the copy
 * is careful not to promise an outcome this action alone will not produce. Counts are kept
 * per kind, so reporting a picture never touches the tagline and vice versa.
 */
export function ReportDialog({
  userId,
  displayName,
  kind,
}: {
  userId: bigint;
  displayName: string;
  kind: "bio" | "avatar";
}) {
  const reportProfile = useStdbReducer(reducers.reportProfile);
  const subject = kind === "bio" ? "bio" : "picture";

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
            ? `This ${subject} is now hidden pending review.`
            : `It'll be reviewed. A ${subject} is hidden once enough separate players report it.`}
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
        Report this {subject}
      </button>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-body text-paper font-semibold">
          Report {displayName}&rsquo;s {subject}
        </p>
        <p className="text-body-sm text-muted">
          For anything abusive or offensive. Reports are attributed to your account.
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
              /**
               * A reducer returns nothing, so the screen no longer learns whether this
               * was a duplicate or whether it crossed the hide threshold. Both were only
               * ever used to vary the thank-you copy, and neither is something the
               * reporter needs to be told: "we got it" is true in every case, and telling
               * someone their report was the third would tell them how close the next
               * one is.
               */
              await reportProfile({ userId, reason: reason.trim(), kind });
              setResult({ duplicate: false, hidden: false });
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
