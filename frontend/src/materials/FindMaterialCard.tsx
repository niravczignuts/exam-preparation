import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { useAiFeaturesEnabled } from "@/lib/aiFeatures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchAndIngest, type SearchAndIngestResult } from "./useMaterialSearch";

/** Web-search-driven material ingestion (finds real syllabus/PYQ material,
 * downloads it, feeds it through the same parsing pipeline as a manual
 * upload) — fully automatic, no review step. Hidden entirely unless
 * OPENAI_API_KEY is configured on the backend (useAiFeaturesEnabled). */
export function FindMaterialCard({
  kind,
  onIngested,
}: {
  kind: "syllabus" | "pyq";
  onIngested?: () => void;
}) {
  const aiFeaturesEnabled = useAiFeaturesEnabled();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchAndIngestResult | null>(null);

  if (!aiFeaturesEnabled) return null;

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResult(null);
    try {
      const res = await searchAndIngest({ query: q, kind });
      setResult(res);
      if (res.sources_ingested === 0) {
        toast.error("Couldn't find or ingest any usable material for that search.");
      } else {
        toast.success(`Added material from ${res.sources_ingested} source(s).`);
        onIngested?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          Find {kind === "syllabus" ? "syllabus" : "previous-year papers"} on the web
        </p>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={
              kind === "syllabus"
                ? "e.g. GSET Commerce syllabus 2024"
                : "e.g. GSET Commerce previous year papers"
            }
          />
          <Button onClick={handleSearch} disabled={searching || !query.trim()}>
            <SearchIcon /> {searching ? "Searching…" : "Search & Add"}
          </Button>
        </div>
        {result && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{result.sources_tried} source(s) found</Badge>
            <Badge variant="outline">{result.sources_ingested} ingested</Badge>
            {result.sources_failed > 0 && <Badge variant="outline">{result.sources_failed} failed</Badge>}
            {kind === "syllabus" ? (
              <>
                <Badge variant="secondary">{result.subjects_added} subjects added</Badge>
                <Badge variant="secondary">{result.topics_added} topics added</Badge>
                {result.exam_stage_created && <Badge variant="secondary">Exam date added</Badge>}
              </>
            ) : (
              <>
                <Badge variant="secondary">{result.questions_added} questions added</Badge>
                {result.duplicates_flagged > 0 && (
                  <Badge variant="secondary">{result.duplicates_flagged} possible duplicates</Badge>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
