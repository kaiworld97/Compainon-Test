"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CompanionMode,
  Emotion,
  getEmotionLabel,
  getVideoForState,
} from "@/lib/emotionMapping";

type VideoAvatarProps = {
  emotion: Emotion;
  mode: CompanionMode;
};

const MODE_LABELS: Record<CompanionMode, string> = {
  idle: "대기 중",
  talking: "대화 중",
  thinking: "생각 중",
};

export const VideoAvatar = ({ emotion, mode }: VideoAvatarProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = useMemo(() => getVideoForState(emotion, mode), [emotion, mode]);
  const statusLabel = MODE_LABELS[mode];
  const emotionLabel = getEmotionLabel(emotion);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.pause();
    video.load();
    const playPromise = video.play();
    if (playPromise instanceof Promise) {
      void playPromise.catch(() => {
        /* autoplay is best-effort; ignore failures */
      });
    }
  }, [src]);

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="w-full overflow-hidden rounded-2xl bg-black">
        <video
          key={src}
          ref={videoRef}
          className="h-64 w-full object-cover"
          src={src}
          autoPlay
          playsInline
          muted
          loop
        />
      </div>
      <div className="flex w-full items-center justify-between text-sm font-medium text-zinc-600 dark:text-zinc-300">
        <span>{emotionLabel}</span>
        <span>{statusLabel}</span>
      </div>
    </div>
  );
};
