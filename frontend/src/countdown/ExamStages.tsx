import { useState, type FormEvent } from "react";
import { CountdownTile } from "./CountdownTile";
import { addExamStage, removeExamStage, useExamStages } from "./useExamStages";

export function ExamStages() {
  const { stages, error, refresh } = useExamStages();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !date) return;
    const { error } = await addExamStage(name.trim(), date, `${time}:00`);
    if (!error) {
      setName("");
      setDate("");
    }
    refresh();
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this exam stage?")) return;
    await removeExamStage(id);
    refresh();
  }

  return (
    <div>
      <h2>Exam countdown</h2>
      {error && <p role="alert">{error}</p>}
      {stages === "loading" ? (
        <p>Loading…</p>
      ) : (
        <div className="countdown-grid">
          {stages.length === 0 && <p>No exam stages configured yet — add one below.</p>}
          {stages.map((stage) => (
            <CountdownTile key={stage.id} stage={stage} onRemove={() => handleRemove(stage.id)} />
          ))}
        </div>
      )}
      <form onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Stage name (e.g. Prelims)"
          required
        />
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          required
        />
        <button type="submit">Add stage</button>
      </form>
    </div>
  );
}
