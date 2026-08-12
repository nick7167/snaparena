"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useRef, useState } from "react";
import { reducers } from "@/module_bindings";
import { Avatar } from "@/game/ui";
import { Button } from "@/ui/Button";

/**
 * Avatar upload.
 *
 * Shared by onboarding and settings, which want the same thing in two different frames.
 *
 * The file never reaches the server as the user picked it. It is drawn into a 256×256
 * canvas first, which does three jobs at once: a 5MB phone photo becomes tens of
 * kilobytes, the ladder stops shipping a full-resolution picture for a mark drawn at
 * 28px, and re-encoding through a canvas discards EXIF and anything else riding along in
 * the original container.
 *
 * The size and type checks here are a courtesy — they fail fast and explain themselves.
 * The upload URL is reachable without going through this form, so the checks that
 * actually hold are in `users.setAvatarImage`.
 */

/** Rendered at 144px on the profile, so 256 covers a 2× display with room to spare. */
const TARGET_PX = 256;

/** Refused before we bother resizing. The server's own cap is what really binds. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

const ACCEPTED = "image/png,image/jpeg,image/webp";

/**
 * Draws the image square, cropped to its centre.
 *
 * Every avatar surface in this app is a square — the ladder row, the VS panel, the
 * profile plate — so the crop belongs here rather than in CSS on each of them.
 */
async function toSquareBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = TARGET_PX;
    canvas.height = TARGET_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not process that image");

    context.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_PX, TARGET_PX);

    return await new Promise<Blob>((resolve, reject) => {
      // webp first; the jpeg fallback covers any browser whose toBlob does not know it,
      // in which case the callback is handed null rather than throwing.
      canvas.toBlob(
        (blob) => {
          if (blob) return resolve(blob);
          canvas.toBlob(
            (jpeg) =>
              jpeg ? resolve(jpeg) : reject(new Error("Could not encode that image")),
            "image/jpeg",
            0.85,
          );
        },
        "image/webp",
        0.85,
      );
    });
  } finally {
    // Frees the decoded frame rather than waiting for GC — these are megabytes.
    bitmap.close();
  }
}

/** Reads the encoded blob as a data URL, which is the shape the reducer stores. */
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(blob);
  });
}

export function AvatarUpload({
  currentUrl,
  name,
  onUploaded,
  label = "Upload a picture",
}: {
  currentUrl?: string | null;
  /** For the initial shown while there is no picture. */
  name: string;
  onUploaded?: (url: string) => void;
  label?: string;
}) {
  
  const setAvatarImage = useStdbReducer(reducers.setAvatarImage);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.split(",").includes(file.type)) {
      setError("Pick a PNG, JPEG or WebP image");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("That image is too large — pick one under 12MB");
      return;
    }

    setBusy(true);
    try {
      const blob = await toSquareBlob(file);

      /**
       * NO UPLOAD STEP ANY MORE.
       *
       * Convex handed back a one-shot URL, the browser POSTed the file to it, and a
       * storage id came back to attach to the profile. SpacetimeDB has no blob storage,
       * and the alternative — bytes in a table — cannot work for an avatar: that table
       * has to be private or every client replicates every player's image, and a private
       * picture is one nobody else can see.
       *
       * So the encoded image goes into `avatarUrl` itself as a data URL. It is already
       * a public string that travels with the row the avatar belongs to, and a 256px
       * webp is small enough that it replicates where the name does and nowhere else.
       */
      const dataUrl = await toDataUrl(blob);
      await setAvatarImage({ dataUrl });
      onUploaded?.(dataUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload that image");
    } finally {
      setBusy(false);
      // Cleared so picking the same file twice still fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Avatar
          plate
          url={currentUrl}
          name={name}
          className="size-14 shrink-0 text-lg"
        />

        <div className="flex flex-col items-start gap-1">
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {label}
          </Button>
          <span className="text-label text-muted">PNG, JPEG or WebP · square crop</span>
        </div>

        {/* The real control, driven by the button above. A bare file input cannot be
            styled to match anything, and every other control in this app is a Button. */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
