import { useMemo, useState } from "react";
import { PencilIcon, SearchIcon, TrashIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { useAiFeaturesEnabled } from "@/lib/aiFeatures";
import type { SubjectNode } from "@/syllabus/useSyllabusTree";
import { flattenTopics } from "@/syllabus/flattenTopics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { deleteQuestion, searchQuestions, updateQuestion, useQuestions, type Question } from "./usePyqQuestions";

function EditQuestionDialog({
  question,
  topicOptions,
  onClose,
  onSaved,
}: {
  question: Question;
  topicOptions: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [questionText, setQuestionText] = useState(question.question_text);
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer ?? "");
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [topicId, setTopicId] = useState(question.topic_id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await updateQuestion(question.id, {
      question_text: questionText,
      correct_answer: correctAnswer || null,
      explanation: explanation || null,
      topic_id: topicId || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Question</Label>
            <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Correct answer</Label>
            <Textarea value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Explanation</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tag to topic</Label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="">Untagged</option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuestionBank({
  subjects,
  initialTopicId = "",
}: {
  subjects: SubjectNode[];
  initialTopicId?: string;
}) {
  const { questions, error, refresh } = useQuestions();
  const [editing, setEditing] = useState<Question | null>(null);
  const [filterTopicId, setFilterTopicId] = useState(initialTopicId);
  const aiFeaturesEnabled = useAiFeaturesEnabled();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchedIds, setSearchedIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(false);

  const topicOptions = useMemo(() => flattenTopics(subjects), [subjects]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await deleteQuestion(id);
    if (error) toast.error(error);
    refresh();
  }

  async function handleSearch() {
    const query = searchTerm.trim();
    if (!query) {
      setSearchedIds(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchQuestions(query, filterTopicId || undefined);
      setSearchedIds(results.map((r) => r.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  if (questions === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  let filtered: Question[];
  if (searchedIds !== null) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    filtered = searchedIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
  } else {
    filtered = filterTopicId ? questions.filter((q) => q.topic_id === filterTopicId) : questions;
  }
  if (hideDuplicates) {
    filtered = filtered.filter((q) => !q.duplicate_of);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Q&amp;A bank <span className="text-muted-foreground font-normal">({questions.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={hideDuplicates}
              onChange={(e) => setHideDuplicates(e.target.checked)}
            />
            Hide duplicates
          </label>
          {topicOptions.length > 0 && (
            <select
              value={filterTopicId}
              onChange={(e) => setFilterTopicId(e.target.value)}
              className="border-input bg-background h-8 rounded-md border px-2 text-xs shadow-xs outline-none"
            >
              <option value="">All topics</option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {aiFeaturesEnabled && (
        <div className="flex gap-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by meaning (e.g. 'depreciation methods')…"
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching}>
            <SearchIcon className="size-3.5" /> {searching ? "Searching…" : "Search"}
          </Button>
          {searchedIds !== null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchTerm("");
                setSearchedIds(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No questions yet — upload a PYQ paper above to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((question) => (
            <Card key={question.id} className="gap-2 py-4">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{question.question_text}</p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEditing(question)}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      onClick={() => handleDelete(question.id)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {question.topics ? (
                    <Badge variant="secondary">
                      {question.topics.subjects?.name} · {question.topics.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Untagged</Badge>
                  )}
                  {question.exam_year && <Badge variant="outline">{question.exam_year}</Badge>}
                  {question.language && <Badge variant="outline">{question.language.toUpperCase()}</Badge>}
                  {question.options.length > 0 && (
                    <Badge variant="outline">{question.options.length} options</Badge>
                  )}
                  {question.duplicate_of && (
                    <Badge variant="outline" className="text-warning border-warning/50 gap-1">
                      <TriangleAlertIcon className="size-3" /> Possible duplicate
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditQuestionDialog
          question={editing}
          topicOptions={topicOptions}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
