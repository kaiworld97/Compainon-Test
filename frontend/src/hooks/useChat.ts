"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CompanionMode,
  Emotion,
  resolveEmotion,
} from "@/lib/emotionMapping";

const DEFAULT_TTS_DURATION = 1800;

const API_BASE = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  emotion?: Emotion;
};

type ChatApiResponse = {
  reply: string;
  emotion: string;
  ttsDurationMs?: number;
};

const createId = () => crypto.randomUUID();

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [emotion, setEmotion] = useState<Emotion>("base");
  const [mode, setMode] = useState<CompanionMode>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const talkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readyToSend = useMemo(
    () => Boolean(input.trim()) && !isLoading,
    [input, isLoading],
  );

  const clearTalkTimeout = useCallback(() => {
    if (talkTimeoutRef.current) {
      clearTimeout(talkTimeoutRef.current);
      talkTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTalkTimeout();
    },
    [clearTalkTimeout],
  );

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isLoading) {
        return;
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setError(null);
      setEmotion("base");
      setMode("thinking");
      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: text }),
        });

        if (!response.ok) {
          throw new Error("동행 에이전트가 응답하지 않았어요.");
        }

        const data: ChatApiResponse = await response.json();
        const nextEmotion = resolveEmotion(data.emotion);
        const assistantMessage: ChatMessage = {
          id: createId(),
          role: "assistant",
          content: data.reply,
          emotion: nextEmotion,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setEmotion(nextEmotion);
        setMode("talking");

        const talkDuration = data.ttsDurationMs ?? DEFAULT_TTS_DURATION;
        clearTalkTimeout();
        talkTimeoutRef.current = window.setTimeout(() => {
          setMode("idle");
          talkTimeoutRef.current = null;
        }, talkDuration);
      } catch (chatError) {
        const fallback =
          chatError instanceof Error
            ? chatError.message
            : "알 수 없는 오류가 발생했어요.";
        setError(fallback);
        setMode("idle");
      } finally {
        setIsLoading(false);
      }
    },
    [clearTalkTimeout, input, isLoading],
  );

  return {
    messages,
    input,
    setInput,
    sendMessage,
    readyToSend,
    isLoading,
    error,
    emotion,
    mode,
  };
};
