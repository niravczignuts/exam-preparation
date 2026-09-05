import { useState } from "react";
import { SyllabusTree } from "../syllabus/SyllabusTree";
import { SyllabusUpload } from "../syllabus/SyllabusUpload";

export function Syllabus() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main>
      <h1>Syllabus</h1>
      <SyllabusUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
      <SyllabusTree key={refreshKey} />
    </main>
  );
}
