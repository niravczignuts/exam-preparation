import { useState, type FormEvent } from "react";
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
    <li>
      <div className="topic-row">
        <button type="button" onClick={() => reorderTopic(siblings, topic.id, "up").then(onChanged)}>
          ↑
        </button>
        <button type="button" onClick={() => reorderTopic(siblings, topic.id, "down").then(onChanged)}>
          ↓
        </button>
        {editing ? (
          <>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
            <button type="button" onClick={handleRename}>
              Save
            </button>
          </>
        ) : (
          <span className={topic.status === "revision_needed" ? "revision-needed" : undefined}>
            {topic.name}
            {topic.status === "revision_needed" && " ⚠"}
            {topic.status === "completed" && " ✓"}
          </span>
        )}
        <select
          value={topic.status}
          onChange={(event) =>
            setTopicStatus(topic.id, event.target.value as TopicStatus).then(onChanged)
          }
        >
          {TOPIC_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        {topic.subtopics.length > 0 && (
          <span>
            ({completedSubtopics}/{topic.subtopics.length} sub-topics completed)
          </span>
        )}
        <button type="button" onClick={() => setEditing((v) => !v)}>
          Edit
        </button>
        <button type="button" onClick={() => setAddingChild((v) => !v)}>
          + Sub-topic
        </button>
        <button type="button" onClick={handleDelete}>
          Delete
        </button>
      </div>
      {addingChild && (
        <form onSubmit={handleAddChild}>
          <input
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            placeholder="Sub-topic name"
            required
          />
          <button type="submit">Add</button>
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
    <section className="subject">
      <div className="subject-row">
        {editing ? (
          <>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
            <button type="button" onClick={handleRename}>
              Save
            </button>
          </>
        ) : (
          <h3>{subject.name}</h3>
        )}
        <span>
          {subject.completionPercent}% complete ({subject.completedTopics}/{subject.totalTopics})
        </span>
        {subject.revisionNeededTopics > 0 && (
          <span className="revision-needed">{subject.revisionNeededTopics} need revision</span>
        )}
        <button type="button" onClick={() => setEditing((v) => !v)}>
          Edit
        </button>
        <button type="button" onClick={() => setAddingTopic((v) => !v)}>
          + Topic
        </button>
        <button type="button" onClick={handleDelete}>
          Delete subject
        </button>
      </div>
      {addingTopic && (
        <form onSubmit={handleAddTopic}>
          <input
            value={topicName}
            onChange={(event) => setTopicName(event.target.value)}
            placeholder="Topic name"
            required
          />
          <button type="submit">Add</button>
        </form>
      )}
      <ul>
        {subject.topics.map((topic) => (
          <TopicItem key={topic.id} topic={topic} siblings={subject.topics} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

export function SyllabusTree() {
  const { subjects, error, overallPercent, refresh } = useSyllabusTree();
  const [newSubject, setNewSubject] = useState("");

  async function handleAddSubject(event: FormEvent) {
    event.preventDefault();
    if (!newSubject.trim()) return;
    const { error } = await addSubject(newSubject.trim());
    if (!error) setNewSubject("");
    refresh();
  }

  if (subjects === "loading") return <p>Loading syllabus…</p>;

  return (
    <div>
      <h2>Syllabus — {overallPercent}% complete overall</h2>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleAddSubject}>
        <input
          value={newSubject}
          onChange={(event) => setNewSubject(event.target.value)}
          placeholder="New subject name"
          required
        />
        <button type="submit">Add subject</button>
      </form>
      {subjects.length === 0 && <p>No subjects yet — add one above or upload a syllabus file.</p>}
      {subjects.map((subject) => (
        <SubjectItem key={subject.id} subject={subject} onChanged={refresh} />
      ))}
    </div>
  );
}
