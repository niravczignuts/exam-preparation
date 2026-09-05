import { useState, type FormEvent } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TOPIC_STATUSES,
  addSubject,
  addTopic,
  deleteSubject,
  deleteTopic,
  renameSubject,
  renameTopic,
  reorderTopic,
  setTopicStatus,
  useSyllabusTree,
  type SubjectNode,
  type TopicNode,
  type TopicStatus,
} from "./useSyllabusTree";

const STATUS_LABELS: Record<TopicStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  revision_needed: "Revision needed",
};

const STATUS_BADGE_VARIANT: Record<TopicStatus, "outline" | "secondary" | "success" | "warning"> = {
  not_started: "outline",
  in_progress: "secondary",
  completed: "success",
  revision_needed: "warning",
};

function StatusSelect({
  status,
  onChange,
}: {
  status: TopicStatus;
  onChange: (status: TopicStatus) => void;
}) {
  return (
    <select
      value={status}
      onChange={(event) => onChange(event.target.value as TopicStatus)}
      className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
    >
      {TOPIC_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function TopicItem({
  topic,
  siblings,
  onChanged,
}: {
  topic: TopicNode;
  siblings: TopicNode[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");

  async function handleRename() {
    if (!name.trim()) return;
    await renameTopic(topic.id, name.trim());
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    const label = topic.subtopics.length
      ? `"${topic.name}" and its sub-topics`
      : `"${topic.name}"`;
    if (!confirm(`Delete ${label}?`)) return;
    await deleteTopic(topic.id);
    onChanged();
  }

  async function handleAddChild(event: FormEvent) {
    event.preventDefault();
    if (!childName.trim()) return;
    await addTopic(topic.subject_id, topic.id, childName.trim());
    setChildName("");
    setAddingChild(false);
    onChanged();
  }

  const completedSubtopics = topic.subtopics.filter((t) => t.status === "completed").length;

  return (
    <li className="border-border/70 border-l pl-3">
      <div className="group flex flex-wrap items-center gap-1.5 rounded-md py-1.5">
        <div className="flex flex-col">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground -mb-1"
            onClick={() => reorderTopic(siblings, topic.id, "up").then(onChanged)}
            aria-label="Move up"
          >
            <ChevronUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => reorderTopic(siblings, topic.id, "down").then(onChanged)}
            aria-label="Move down"
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
        </div>

        {editing ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-8"
              autoFocus
            />
            <Button size="sm" className="h-8" onClick={handleRename}>
              <CheckIcon />
            </Button>
          </div>
        ) : (
          <span className="flex-1 text-sm">{topic.name}</span>
        )}

        <Badge variant={STATUS_BADGE_VARIANT[topic.status]}>
          {topic.status === "revision_needed" && <TriangleAlertIcon />}
          {STATUS_LABELS[topic.status]}
        </Badge>
        <StatusSelect
          status={topic.status}
          onChange={(status) => setTopicStatus(topic.id, status).then(onChanged)}
        />

        {topic.subtopics.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {completedSubtopics}/{topic.subtopics.length} sub-topics
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setEditing((v) => !v)}
            aria-label="Rename"
          >
            <PencilIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setAddingChild((v) => !v)}
            aria-label="Add sub-topic"
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-7"
            onClick={handleDelete}
            aria-label="Delete"
          >
            <TrashIcon className="size-3.5" />
          </Button>
        </div>
      </div>
      {addingChild && (
        <form onSubmit={handleAddChild} className="mb-1.5 flex gap-1.5 pl-5">
          <Input
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            placeholder="Sub-topic name"
            required
            className="h-8"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-8">
            Add
          </Button>
        </form>
      )}
      {topic.subtopics.length > 0 && (
        <ul>
          {topic.subtopics.map((sub) => (
            <TopicItem key={sub.id} topic={sub} siblings={topic.subtopics} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SubjectItem({ subject, onChanged }: { subject: SubjectNode; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [addingTopic, setAddingTopic] = useState(false);
  const [topicName, setTopicName] = useState("");

  async function handleRename() {
    if (!name.trim()) return;
    await renameSubject(subject.id, name.trim());
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    if (!confirm(`Delete subject "${subject.name}" and all its topics?`)) return;
    await deleteSubject(subject.id);
    onChanged();
  }

  async function handleAddTopic(event: FormEvent) {
    event.preventDefault();
    if (!topicName.trim()) return;
    await addTopic(subject.id, null, topicName.trim());
    setTopicName("");
    setAddingTopic(false);
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <div className="flex flex-1 items-center gap-1.5">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-8"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleRename}>
                <CheckIcon />
              </Button>
            </div>
          ) : (
            <CardTitle className="flex-1 text-base">{subject.name}</CardTitle>
          )}
          {subject.revisionNeededTopics > 0 && (
            <Badge variant="warning">
              <TriangleAlertIcon />
              {subject.revisionNeededTopics} need revision
            </Badge>
          )}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing((v) => !v)}>
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setAddingTopic((v) => !v)}
            >
              <PlusIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-7"
              onClick={handleDelete}
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Progress value={subject.completionPercent} className="h-1.5" />
          <span className="text-muted-foreground w-24 shrink-0 text-right text-xs tabular-nums">
            {subject.completedTopics}/{subject.totalTopics} · {subject.completionPercent}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {addingTopic && (
          <form onSubmit={handleAddTopic} className="mb-3 flex gap-1.5">
            <Input
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="Topic name"
              required
              className="h-8"
              autoFocus
            />
            <Button type="submit" size="sm" className="h-8">
              Add
            </Button>
          </form>
        )}
        {subject.topics.length === 0 ? (
          <p className="text-muted-foreground text-sm">No topics yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {subject.topics.map((topic) => (
              <TopicItem key={topic.id} topic={topic} siblings={subject.topics} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function SyllabusTree() {
  const { subjects, error, overallPercent, refresh } = useSyllabusTree();
  const [newSubject, setNewSubject] = useState("");

  async function handleAddSubject(event: FormEvent) {
    event.preventDefault();
    if (!newSubject.trim()) return;
    const { error: addError } = await addSubject(newSubject.trim());
    if (addError) {
      toast.error(addError);
      return;
    }
    setNewSubject("");
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Syllabus</h2>
          {subjects !== "loading" && subjects.length > 0 && (
            <p className="text-muted-foreground text-sm">{overallPercent}% complete overall</p>
          )}
        </div>
        <form onSubmit={handleAddSubject} className="flex gap-1.5">
          <Input
            value={newSubject}
            onChange={(event) => setNewSubject(event.target.value)}
            placeholder="New subject name"
            required
            className="h-9 w-48"
          />
          <Button type="submit" size="sm">
            <PlusIcon /> Add subject
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {subjects === "loading" ? (
        <div className={cn("flex flex-col gap-3")}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : subjects.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No subjects yet — add one above or upload a syllabus file.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
