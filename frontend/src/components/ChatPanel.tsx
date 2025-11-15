"use client";

import { Dispatch, FormEvent, SetStateAction } from "react";
import { ChatMessage } from "@/hooks/useChat";
import { getEmotionLabel } from "@/lib/emotionMapping";

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  sendMessage: () => Promise<void> | void;
  readyToSend: boolean;
  isLoading: boolean;
  error: string | null;
  startRecording: () => Promise<void> | void;
  stopRecording: () => void;
  isRecording: boolean;
  canRecordVoice: boolean;
};

const roleLabel: Record<ChatMessage["role"], string> = {
  user: "나",
  assistant: "Companion",
};

export const ChatPanel = ({
  messages,
  input,
  setInput,
  sendMessage,
  readyToSend,
  isLoading,
  error,
  startRecording,
  stopRecording,
  isRecording,
  canRecordVoice,
}: ChatPanelProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  return (
    <section className="flex w-full flex-1 flex-col gap-4 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 max-h-[80vh]">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl bg-zinc-50/90 p-4 text-sm dark:bg-zinc-900/60 max-h-[60vh]">
        {messages.length === 0 && (
          <p className="text-center text-zinc-500">
            Companion에게 먼저 말을 걸어보세요.
          </p>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`flex flex-col gap-1 rounded-xl p-3 ${
              message.role === "user"
                ? "items-end bg-indigo-50 text-indigo-900 dark:bg-indigo-500/30 dark:text-indigo-100"
                : "items-start bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          >
            <header className="flex w-full items-center justify-between text-xs uppercase tracking-wide opacity-70">
              <span className="flex items-center gap-2">
                <span>{roleLabel[message.role]}</span>
                {message.origin === "voice" && (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
                    음성
                  </span>
                )}
              </span>
              <span className="font-medium">
                {message.emotion ? getEmotionLabel(message.emotion) : ""}
              </span>
            </header>
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </article>
        ))}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="여기에 메시지를 입력하세요."
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm leading-relaxed text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-indigo-500"
          disabled={isLoading}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-col gap-1">
            {!canRecordVoice && (
              <span>브라우저가 음성 입력을 지원하지 않아요.</span>
            )}
            {isRecording && <span className="text-rose-500">녹음 중...</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  void startRecording();
                }
              }}
              disabled={!canRecordVoice || isLoading}
              className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                isRecording
                  ? "border-rose-500 bg-rose-500 text-white"
                  : "border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:border-zinc-300 disabled:text-zinc-400 dark:border-indigo-500 dark:text-indigo-200 dark:hover:bg-indigo-500/20 dark:disabled:border-zinc-600 dark:disabled:text-zinc-500"
              }`}
            >
              {isRecording ? "말 끝내기" : "음성 입력"}
            </button>
            <button
              type="submit"
              disabled={!readyToSend}
              className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:bg-zinc-700"
            >
              {isLoading ? "응답 생성 중..." : "보내기"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
