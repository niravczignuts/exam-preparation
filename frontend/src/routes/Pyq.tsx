import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlayIcon } from "lucide-react";

import { useSyllabusTree } from "@/syllabus/useSyllabusTree";
import { PyqUpload } from "@/pyq/PyqUpload";
import { QuestionBank } from "@/pyq/QuestionBank";
import { Button } from "@/components/ui/button";

export function Pyq() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { subjects } = useSyllabusTree();
  const [searchParams] = useSearchParams();
  const initialTopicId = searchParams.get("topic") ?? "";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Q&amp;A Bank</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload previous-year papers to auto-build a practice question bank.
          </p>
        </div>
        <Button asChild>
          <Link to="/practice">
            <PlayIcon /> Start practice
          </Link>
        </Button>
      </div>

      <PyqUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
      <QuestionBank
        key={refreshKey}
        subjects={subjects === "loading" ? [] : subjects}
        initialTopicId={initialTopicId}
      />
    </main>
  );
}
