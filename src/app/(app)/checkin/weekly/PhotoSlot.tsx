"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_BUCKET, photoPath, type Pose } from "@/lib/checkins";
import { usePrefs } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { setWeeklyPhoto } from "../actions";

/** Shrinks a phone photo to at most 1600 px on its long side as a JPEG, so uploads stay small. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

export function PhotoSlot({ pose, week, url, label }: { pose: Pose; week: string; url: string | null; label: string }) {
  const { t, userId } = usePrefs();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "failed">("idle");

  const upload = async (file: File) => {
    setState("uploading");
    try {
      const blob = await shrink(file);
      const { error } = await createClient()
        .storage.from(PHOTO_BUCKET)
        .upload(photoPath(userId, week, pose), blob, { upsert: true, contentType: "image/jpeg", cacheControl: "0" });
      if (error) throw error;
      const result = await setWeeklyPhoto(week, pose, true);
      if (!result.ok) throw new Error("save failed");
      setState("idle");
      router.refresh();
    } catch {
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
      {state === "failed" && <p className="mt-1 text-xs text-danger">{t("c.uploadFailed")}</p>}
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
