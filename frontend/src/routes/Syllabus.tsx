import { useState } from "react";

import { SyllabusTree } from "@/syllabus/SyllabusTree";
import { SyllabusUpload } from "@/syllabus/SyllabusUpload";

export function Syllabus() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <SyllabusUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
      <SyllabusTree key={refreshKey} />
    </main>
  );
}
