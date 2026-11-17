"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_BUCKET, photoPath, type Pose } from "@/lib/checkins";
import { usePrefs } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { setWeeklyPhoto } from "../actions";

const MAX_INPUT_BYTES = 30 * 1024 * 1024; // what we accept from the phone before shrinking
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // the storage limit (see migration 0007)

class PhotoError extends Error {
  constructor(public reason: "notImage" | "tooBig" | "unreadable" | "upload") {
    super(reason);
  }
}

/**
 * Turns a phone photo into a fresh JPEG: upright (orientation applied), at most 1600 px on its long
 * side, under 5 MB. Redrawing it on a canvas also drops all camera metadata, including GPS location.
 */
async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // e.g. HEIC on a browser that can't decode it
    throw new PhotoError("unreadable");
  }
  const encode = (maxSide: number, quality: number) => {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError("unreadable"))), "image/jpeg", quality),
    );
  };
  try {
    for (const [side, quality] of [[1600, 0.85], [1600, 0.7], [1200, 0.7]] as const) {
      const blob = await encode(side, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    throw new PhotoError("tooBig");
  } finally {
    bitmap.close();
  }
}

export function PhotoSlot({ pose, week, url, label }: { pose: Pose; week: string; url: string | null; label: string }) {
  const { t, userId } = usePrefs();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "failed">("idle");
  const [reason, setReason] = useState<PhotoError["reason"]>("upload");

  const upload = async (file: File) => {
    setState("uploading");
    try {
      if (file.type && !file.type.startsWith("image/")) throw new PhotoError("notImage");
      if (file.size > MAX_INPUT_BYTES) throw new PhotoError("tooBig");
      const blob = await shrink(file);
      const { error } = await createClient()
        .storage.from(PHOTO_BUCKET)
        .upload(photoPath(userId, week, pose), blob, { upsert: true, contentType: "image/jpeg", cacheControl: "0" });
      if (error) throw error;
      const result = await setWeeklyPhoto(week, pose, true);
      if (!result.ok) throw new Error("save failed");
      setState("idle");
      router.refresh();
    } catch (e) {
      // the old photo (if any) is untouched; uploading again simply replaces it
      setReason(e instanceof PhotoError ? e.reason : "upload");
      setState("failed");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state === "uploading"}
        className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-bg text-xs text-muted"
      >
        {url ? (
          // signed, short-lived URL from private storage; next/image would need the storage host whitelisted
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span>+ {t("c.addPhoto")}</span>
        )}
        {state === "uploading" && <span className="absolute inset-0 flex items-center justify-center bg-bg/70">{t("c.uploading")}…</span>}
      </button>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        {url && state !== "uploading" && (
          <button
            type="button"
            className="text-muted hover:text-danger"
            onClick={async () => {
              if (!window.confirm(t("w.confirmDelete"))) return;
              const result = await setWeeklyPhoto(week, pose, false);
              if (result.ok) router.refresh();
            }}
          >
            {t("w.remove")}
          </button>
        )}
      </div>
      {state === "failed" && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {reason === "notImage" ? t("c.notImage") : reason === "tooBig" ? t("c.tooBig") : reason === "unreadable" ? t("c.unreadable") : t("c.uploadFailed")}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
