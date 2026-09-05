from __future__ import annotations

from app.anthropic_client import get_anthropic_client

_LANGUAGE_NAMES = {"gu": "Gujarati", "en": "English"}


def _tone_instruction(current_streak: int, recent_completion_rate: float) -> str:
    """KAN-44: at least 3 distinguishable performance-state tones, driven by streak +
    recent completion rate rather than a single flag, so the tone actually reflects
    "recent performance" as the ticket asks, not just today's one data point."""
    if current_streak >= 3:
        return (
            "The user is on a strong streak. Be warm and congratulatory — "
            "acknowledge the streak specifically and celebrate it."
        )
    if recent_completion_rate < 0.4:
        return (
            "The user has been struggling lately (low completion rate over the last "
            "week). Be encouraging but honestly firm — acknowledge it's tough without "
            "being harsh, and gently push them to get back on track. Don't be purely "
            "robotic/neutral here."
        )
    return "The user has been making steady, ordinary progress. Be neutral and informative."


def _goal_context(weak_topics: list[dict] | None, days_until_exam: int | None) -> str:
    """Folds the user's real history (accuracy by topic, time to exam) into the
    prompt so the check-in can actually guide them toward their goal instead of
    just logging today's status. Returns an empty string when there's nothing
    concrete to report yet (e.g. a brand-new user with no attempts/exam date) —
    never invent a nudge out of nothing."""
    lines = []
    if days_until_exam is not None:
        lines.append(f"Their exam is in {days_until_exam} day(s).")
    if weak_topics:
        topics_desc = ", ".join(
            f"{t['topic_name']} ({round(t['accuracy'] * 100)}% accuracy)" for t in weak_topics
        )
        lines.append(f"Their weakest topics recently (lowest practice accuracy) are: {topics_desc}.")
    if not lines:
        return ""
    return (
        " ".join(lines)
        + " Weave a brief, natural nudge toward one of these into the message if it fits — "
        "don't force it if today's target already covers them, and don't overwhelm the "
        "message with stats; one specific, encouraging mention is enough."
    )


def generate_checkin_opening(
    *,
    target_description: str,
    current_streak: int,
    recent_completion_rate: float,
    language: str,
    weak_topics: list[dict] | None = None,
    days_until_exam: int | None = None,
) -> str:
    """KAN-39/42/43/44: the opening message of the end-of-day check-in — greets the
    user, asks completion status + questions solved, and includes 1-2 recall
    questions grounded in what today's target actually was. Also references the
    user's real progress history (weak topics, days until exam) when available,
    so this genuinely guides them toward their goal rather than just checking a
    box."""
    lang_name = _LANGUAGE_NAMES.get(language, "English")
    tone = _tone_instruction(current_streak, recent_completion_rate)
    goal_context = _goal_context(weak_topics, days_until_exam)

    prompt = (
        f"You are a friendly study-mentor chatbot for a GSET Commerce exam aspirant. "
        f"Write ONLY the chat message itself (no preamble, no quotes around it) in {lang_name}, "
        f"3-5 short sentences.\n\n"
        f"Today's target was: \"{target_description}\"\n\n"
        f"{tone}\n\n"
        f"{goal_context}\n\n"
        "The message must:\n"
        "1. Greet them and ask whether they completed today's target (they'll answer via "
        "buttons in the UI, so just ask naturally — don't list options).\n"
        "2. Ask how many questions they solved today.\n"
        "3. Ask 1-2 short recall questions testing something specific from today's target "
        "(if the target has no specific topic, ask a general recall question about what "
        "they studied)."
    )
    response = get_anthropic_client().messages.create(
        model="claude-sonnet-5",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def generate_checkin_closing(
    *,
    status: str,
    questions_solved: int,
    recall_answers: str,
    current_streak: int,
    recent_completion_rate: float,
    language: str,
) -> str:
    """The closing message after the user answers (KAN-43): tone-adapted
    acknowledgment, distinguishably different across performance states."""
    lang_name = _LANGUAGE_NAMES.get(language, "English")
    tone = _tone_instruction(current_streak, recent_completion_rate)
    status_label = {
        "completed": "fully completed",
        "partially_completed": "partially completed",
        "missed": "missed",
    }.get(status, status)

    prompt = (
        f"You are the same friendly study-mentor chatbot, continuing the conversation. "
        f"Write ONLY the chat message itself (no preamble, no quotes) in {lang_name}, "
        f"2-4 short sentences.\n\n"
        f"The user said they {status_label} today's target, solved {questions_solved} "
        f'question(s), and answered your recall question(s) with: "{recall_answers or "(no answer given)"}"\n\n'
        f"{tone}\n\n"
        "Write a short closing message acknowledging their answer (loosely react to the "
        "recall answer if one was given) and sending them off for the day. Do not ask "
        "another question — this ends the check-in."
    )
    response = get_anthropic_client().messages.create(
        model="claude-sonnet-5",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
