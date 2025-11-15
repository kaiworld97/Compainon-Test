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
  origin?: "text" | "voice";
};

type ChatApiResponse = {
  reply: string;
  emotion: string;
  ttsDurationMs?: number;
};

type VoiceApiResponse = ChatApiResponse & {
  transcript: string;
};

const createId = () => crypto.randomUUID();

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [emotion, setEmotion] = useState<Emotion>("base");
  const [mode, setMode] = useState<CompanionMode>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const talkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const readyToSend = useMemo(
    () => Boolean(input.trim()) && !isLoading,
    [input, isLoading],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const supported =
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices) &&
      "MediaRecorder" in window;
    setVoiceSupported(supported);
  }, []);

  const clearTalkTimeout = useCallback(() => {
    if (talkTimeoutRef.current) {
      clearTimeout(talkTimeoutRef.current);
      talkTimeoutRef.current = null;
    }
  }, []);

  const speakMessage = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    synth.cancel();
    synth.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      clearTalkTimeout();
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [clearTalkTimeout]);

  const handleAssistantResponse = useCallback(
    (data: ChatApiResponse) => {
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
      speakMessage(data.reply);

      const talkDuration = data.ttsDurationMs ?? DEFAULT_TTS_DURATION;
      clearTalkTimeout();
      talkTimeoutRef.current = window.setTimeout(() => {
        setMode("idle");
        talkTimeoutRef.current = null;
      }, talkDuration);
    },
    [clearTalkTimeout, speakMessage],
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
        origin: "text",
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
        handleAssistantResponse(data);
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
    [handleAssistantResponse, input, isLoading],
  );

  const sendVoiceBlob = useCallback(
    async (blob: Blob) => {
      if (!blob || blob.size === 0) {
        return;
      }

      setEmotion("base");
      setMode("thinking");
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("audio", blob, `voice-${Date.now()}.webm`);
        const response = await fetch(`${API_BASE}/api/voice`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("음성을 처리하지 못했어요.");
        }

        const data: VoiceApiResponse = await response.json();
        const transcript =
          data.transcript?.trim() || "음성 메시지를 전송했어요.";
        const userMessage: ChatMessage = {
          id: createId(),
          role: "user",
          content: transcript,
          origin: "voice",
        };
        setMessages((prev) => [...prev, userMessage]);
        handleAssistantResponse(data);
      } catch (voiceError) {
        const fallback =
          voiceError instanceof Error
            ? voiceError.message
            : "음성 전송 중 문제가 발생했어요.";
        setError(fallback);
        setMode("idle");
      } finally {
        setIsLoading(false);
      }
    },
    [handleAssistantResponse],
  );

  const startRecording = useCallback(async () => {
    if (isRecording || isLoading) {
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof window === "undefined" ||
      !("MediaRecorder" in window)
    ) {
      setError("브라우저가 음성 입력을 지원하지 않아요.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Recorder = window.MediaRecorder;
      const recorder = new Recorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);
        void sendVoiceBlob(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch (mediaError) {
      setError(
        mediaError instanceof Error
          ? mediaError.message
          : "마이크 권한이 필요해요.",
      );
    }
  }, [isLoading, isRecording, sendVoiceBlob]);

  const stopRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      setIsRecording(false);
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, [isRecording]);

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
    startRecording,
    stopRecording,
    isRecording,
    canRecordVoice: voiceSupported,
  };
};
