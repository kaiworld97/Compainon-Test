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
}: ChatPanelProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  return (
    <section className="flex w-full flex-1 flex-col gap-4 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl bg-zinc-50/90 p-4 text-sm dark:bg-zinc-900/60">
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
              <span>{roleLabel[message.role]}</span>
              {message.emotion && (
                <span className="font-medium">
                  {getEmotionLabel(message.emotion)}
                </span>
              )}
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
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={!readyToSend}
            className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:disabled:bg-zinc-700"
          >
            {isLoading ? "응답 생성 중..." : "보내기"}
          </button>
        </div>
      </form>
    </section>
  );
};
