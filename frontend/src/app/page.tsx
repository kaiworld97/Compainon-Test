"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { VideoAvatar } from "@/components/VideoAvatar";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const chat = useChat();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-zinc-100 font-sans text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-black dark:text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:flex-row lg:gap-8 lg:px-10">
        <div className="lg:w-2/5">
          <VideoAvatar emotion={chat.emotion} mode={chat.mode} />
        </div>
        <div className="lg:w-3/5">
          <ChatPanel
            messages={chat.messages}
            input={chat.input}
            setInput={chat.setInput}
            sendMessage={chat.sendMessage}
            readyToSend={chat.readyToSend}
            isLoading={chat.isLoading}
            error={chat.error}
            startRecording={chat.startRecording}
            stopRecording={chat.stopRecording}
            isRecording={chat.isRecording}
            canRecordVoice={chat.canRecordVoice}
          />
        </div>
      </main>
    </div>
  );
}
