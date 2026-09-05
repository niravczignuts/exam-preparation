import type { SubjectNode, TopicNode } from "./useSyllabusTree";

export interface FlatTopic {
  id: string;
  subjectId: string;
  label: string;
}

export function flattenTopics(subjects: SubjectNode[]): FlatTopic[] {
  const out: FlatTopic[] = [];
  function walk(topics: TopicNode[], subjectId: string, subjectName: string, prefix: string) {
    for (const topic of topics) {
      const label = `${subjectName} > ${prefix}${topic.name}`;
      out.push({ id: topic.id, subjectId, label });
      if (topic.subtopics.length) {
        walk(topic.subtopics, subjectId, subjectName, `${prefix}${topic.name} > `);
      }
    }
  }
  for (const subject of subjects) walk(subject.topics, subject.id, subject.name, "");
  return out;
}
