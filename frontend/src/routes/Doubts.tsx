import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { useAiFeaturesEnabled } from "@/lib/aiFeatures";
import { useLanguage } from "@/lib/i18n";
import { askDoubt, useDoubtMessages, useDoubtThreads } from "@/doubts/useDoubts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function Doubts() {
  const { language } = useLanguage();
  const aiFeaturesEnabled = useAiFeaturesEnabled();
  const location = useLocation();
  const prefill = (location.state as { prefill?: string } | null)?.prefill ?? "";

  const { threads, refresh: refreshThreads } = useDoubtThreads();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { messages, refresh: refreshMessages } = useDoubtMessages(activeThreadId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // A "Ask a doubt" button elsewhere in the app (e.g. Revision) can navigate
  // here with a question pre-filled — re-applies whenever a fresh navigation
  // brings a new one, since this route doesn't remount on its own.
  useEffect(() => {
    if (prefill) setDraft(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setDraft("");
    try {
      const { threadId } = await askDoubt({ threadId: activeThreadId, message: text, language });
      if (!activeThreadId) {
        setActiveThreadId(threadId);
        refreshThreads();
      } else {
        refreshMessages();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get a reply");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  if (!aiFeaturesEnabled) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Ask a Doubt</h1>
        <p className="text-muted-foreground text-sm">
          This feature needs an OpenAI API key configured on the backend — ask whoever runs this
          app to add one (see docs/SETUP.md).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ask a Doubt</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ask any study question and get an explanation.
        </p>
      </div>

      {threads !== "loading" && threads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeThreadId === null ? "default" : "outline"}
            onClick={() => setActiveThreadId(null)}
          >
            New doubt
          </Button>
          {threads.map((thread) => (
            <Button
              key={thread.id}
              size="sm"
              variant={activeThreadId === thread.id ? "default" : "outline"}
              onClick={() => setActiveThreadId(thread.id)}
              className="max-w-40 truncate"
            >
              {thread.title}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex min-h-32 flex-col gap-2">
            {messages === "loading" ? (
              <Skeleton className="h-16 w-full" />
            ) : messages.length > 0 ? (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                    m.role === "assistant"
                      ? "bg-muted self-start"
                      : "bg-primary text-primary-foreground self-end"
                  }`}
                >
                  {m.content}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Ask anything you're stuck on — e.g. "Explain the difference between FIFO and
                LIFO."
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your question…"
              className="min-h-16"
            />
            <Button onClick={handleSend} disabled={sending || !draft.trim()} className="sm:w-fit">
              <SendIcon /> {sending ? "Asking…" : "Ask"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
