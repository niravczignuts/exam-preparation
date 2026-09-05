# Competitive Benchmarking Research — GPSC App & Similar Exam-Prep Apps

## Methodology

This research relies on public web search results — Google Play/App Store listings, product marketing pages, and third-party review/aggregator sites (CollegeDekho, GetMyUni, Testbook's own cutoff pages) — not hands-on use of any app. One direct page fetch (a GSET-specific prep site, henceprove.com) returned HTTP 403 and could not be assessed. Depth varies by app: the official GPSC app's feature list comes from its store listing description (shallow, since it's a government utility app, not an exam-prep app); Testbook, Adda247, and Unacademy have richer public documentation because they're commercial products with marketing pages describing features in detail. No claims below about specific screens, UI flows, or exact button placement are made — only features and patterns that are explicitly stated in public sources.

## Per-app findings

### GPSC (Official) app — Gujarat Public Service Commission
*Government utility app, not a study/prep app.*
- Features: recruitment/advertisement notifications and exam calendar, news & events, results/interview programme announcements, answer key/press release publishing, hall ticket and roll number retrieval, online application form download, application fee status check, photo/signature upload for applications.
- Notable UX pattern: it's an **application-lifecycle** app (find the exam → apply → track status → get the result), not a **study** app. No mock tests, no question bank, no current affairs, no cutoff display were found in its feature description.
- The official GPSC app is not a competitor on study features at all — it competes on "official source of truth for the exam process." Nothing here to benchmark against for study features; it does highlight one gap worth noting (see cross-app patterns).

### GPSC Master: Gujarati Exam Prep (third-party)
- Features: 500+ questions per GPSC subject in Gujarati, multiple study modes — Material Mode, One-liner Mode, Practice Mode, Exam Mode (with scoring).
- Notable UX pattern: **multiple distinct study modes** for the same question bank (read-only material vs. quick one-liners vs. scored practice vs. timed exam) — a deliberate difficulty/format ladder rather than one generic "quiz" mode.

### GPSCGuru — Gujarat GK (third-party)
- Features: 100% offline functionality, Gujarati-language content, explanation for every answer, hint system for fill-in-the-blank questions.
- Notable UX pattern: **offline-first** design and **answer explanations as a first-class feature**, not an afterthought.

### Testbook
- Features (via Testbook Pass membership): 1,50,000+ mock tests, 30,000+ previous year papers, unlimited practice questions and reattempts, live tests, study notes across exams, 24×7 AI doubt-support, "Rankers Test Series," an **Online Rank Predicting** feature with a detailed post-test scorecard, and a mentorship module connecting learners to mentors.
- Notable UX pattern: **rank prediction** benchmarked against other test-takers (not just a raw score), plus reattempts explicitly called out as a feature (implying most tests are otherwise single-attempt).

### Adda247
- Features: 2 lakh+ free mock tests across 500+ exams, daily current affairs (free) with quizzes, 4,000+ e-books/free PDF notes, previous year papers with **video solutions**, 50,000+ hours of recorded lecture content, 24/7 AI doubt-solving, multi-language support (8+ languages including Hindi, Tamil, Telugu, Bengali, etc.).
- Specific previous-year **cutoff** display wasn't found in Adda247's own app/feature marketing (their cutoff data lives on separate exam-specific blog pages, e.g. their GSET cutoff article, rather than being an in-app feature per se).
- Notable UX pattern: **daily current affairs as its own recurring quiz surface**, and pairing PYQ papers with video solutions rather than just text explanations.

### Unacademy
- Features: mock tests, sectional tests, full-length tests, PYQ-based practice, live "All India Rank" competition, leaderboards, streaks, polls, detailed topic-wise performance analysis mapping strengths/weaknesses, AI-assisted doubt clearing, premium recorded lectures.
- Notable UX pattern: **streaks + leaderboards + live rank competition** as a gamification/motivation layer layered on top of the same core mock-test mechanic everyone else has.

### GSET-specific cutoff/prep sources (not full apps, but relevant data sources)
Found via search but not deeply assessed: CollegeDekho, Testbook, IFAS Online, and HenceProve all publish GSET-specific (including Commerce) cutoff trend pages, and GSET 2025 Commerce cutoff is publicly reported around 58-60% expected for general category (40% aggregate qualifying minimum for General/EWS, 35% for SC/ST/OBC/PwD/third gender) — confirming that category-wise, subject-specific cutoff data for GSET Commerce does exist publicly and would be feasible content to source/display, even though no single app was found presenting it as a slick in-app widget.

## Cross-app patterns

Features appearing in 2+ of the apps reviewed above:

| Pattern | Seen in |
|---|---|
| Mock test series (full-length + sectional) | GPSC Master, Testbook, Adda247, Unacademy |
| Previous year question papers/bank | GPSC Master, Testbook, Adda247, Unacademy |
| Per-answer explanations | GPSCGuru, Adda247 (video), Testbook (implied via notes) |
| Current affairs / daily GK quiz | Adda247 (dedicated), GPSC-adjacent tools generally |
| Gamification (streaks/leaderboards/rank) | Testbook (rank predictor), Unacademy (streaks, leaderboard, live rank) |
| Offline mode | GPSCGuru only among those reviewed — not confirmed for the larger commercial apps |
| Multi-language / regional language content | GPSC Master, GPSCGuru (Gujarati-specific), Adda247 (8+ languages) |
| AI doubt-solving assistant | Testbook, Adda247 |
| Post-test analytics (topic-wise strengths/weak areas) | Testbook, Unacademy |

## GSET Commerce relevance mapping

| Feature | Present in | Relevant to GSET Commerce? | Rationale |
|---|---|---|---|
| Mock test series (timed, full-length) | GPSC Master, Testbook, Adda247, Unacademy | **Yes** | Directly maps to this project's existing Mock Test epic (KAN-6) — core mechanic, exam-agnostic. |
| PYQ bank w/ auto-generated Q&A | GPSC Master, Testbook, Adda247, Unacademy | **Yes** | Already the project's PYQ epic (KAN-5) — validated as standard practice across every reviewed app. |
| Per-answer explanations | GPSCGuru, Adda247, Testbook | **Yes** | Cheap to add to the existing PYQ/practice flow (KAN-27); consistently present, low-effort, high value. |
| Current affairs / daily GK section | Adda247 primarily; native to GPSC-adjacent civil-services prep generally | **No (or low)** | This is GPSC/UPSC-style civil-service current-affairs content — GSET Commerce is an academic eligibility test on a fixed Commerce syllabus, not a GK/current-events exam. Not worth building unless the PRD scope later expands beyond GSET Commerce. |
| Category-wise previous-year cutoff display | Third-party GSET data sources (CollegeDekho, Testbook, IFAS, HenceProve); not seen as a slick in-app feature in any reviewed app | **Partial** | Real GSET Commerce cutoff data exists publicly and is checkable, but no reviewed app treats it as a polished in-app widget — it's a "nice to have" data callout rather than a proven UX pattern to imitate. |
| Gamification (streaks, leaderboards, rank prediction vs. other test-takers) | Testbook, Unacademy | **Partial** | This project already plans daily-target streaks (KAN-8/KAN-41). Leaderboards/rank-vs-others require a live user base to be meaningful and add real-time infra cost — worth deferring, streaks alone are relevant now. |
| Offline mode | GPSCGuru | **Yes** | Directly reinforces the project's own PWA epic (KAN-15, offline caching) — validates that offline support is valued by this exact user segment (Gujarati-medium exam aspirants), not just a generic PWA nicety. |
| Multi-language (Gujarati) content | GPSC Master, GPSCGuru | **Yes** | Directly validates the project's existing Gujarati chatbot epic (KAN-9) and language-toggle setting (KAN-60) — this audience specifically expects Gujarati-first UX. |
| AI doubt-solving assistant | Testbook, Adda247 | **Partial** | Adjacent to, but distinct from, the project's motivational chatbot (KAN-9) — that bot is for check-ins/motivation, not academic doubt-clearing. Could be a future extension, not a Sprint-relevant gap today. |
| Video-solution PYQs | Adda247 | **No** | Out of scope — this project's Q&A generation is text/OCR-based (KAN-5); producing video content is a different production pipeline entirely. |
| Official application-lifecycle features (hall ticket, result notifications, fee status) | GPSC (official) app | **No** | This project is a personal study companion, not an official exam-authority app — replicating application/admin workflows is out of scope and would need official GSET-authority data access this project doesn't have. |

## Recommended "inspired-by" backlog seeds for KAN-67

- **Per-answer explanations in the practice/PYQ flow** — validated across 3 of 4 study apps reviewed; low lift on top of the existing PYQ epic (KAN-5/KAN-27).
- **Offline-first hardening beyond basic PWA caching** — GPSCGuru's "100% offline" is a direct signal that this exact audience (regional-language exam aspirants, likely on inconsistent connectivity) values full offline study, not just an installable shell; worth a dedicated look once KAN-15 lands.
- **A lightweight GSET Commerce cutoff reference screen** — sourced from public category-wise cutoff data (already confirmed to exist), shown as a simple "how did past years compare" reference next to mock-test scores; explicitly scoped as a data display, not a full analytics platform.
- **Streak-based motivation only (no leaderboard/rank-vs-others for now)** — reuse the project's existing daily-target streak plan (KAN-8/KAN-41); defer social/competitive features since they need a live user base to be meaningful and this is presently a single/few-user personal tool.
- **Difficulty-ladder practice modes** (skim/material mode → quick one-liner drill → scored practice → timed exam) inspired by GPSC Master's mode structure — could enrich the existing Practice Mode story (KAN-27) beyond a single quiz format.
- **Explicitly not recommended for this PRD's scope**: current-affairs/daily-GK modules, video-solution production, live rank-vs-other-users competition, AI general doubt-solving chat, and any official application-lifecycle features — all either mismatched to GSET Commerce's academic (not civil-service) nature, or a distinct production/infra investment out of proportion to this project's current scope.

## Sources

- [GPSC (Official) - Apps on Google Play](https://play.google.com/store/apps/details?id=gov.gujarat.gpscojas&hl=gu&gl=US)
- [GPSC Master: Gujarati ExamPrep – Apps on Google Play](https://play.google.com/store/apps/details?id=com.sit.knowledge_app&hl=en_NZ)
- [GPSCGuru - Gujarat GK – Apps on Google Play](https://play.google.com/store/apps/details?id=gujarati.gpsc.prep&hl=en_IN)
- [Testbook - App Store - Apple](https://apps.apple.com/in/app/testbook/id1666802218)
- [Testbook Pass: Access The Best Mock Tests & Test series for Govt. Exams](https://testbook.com/pass)
- [Adda247 Govt Job Exam Prep - Apps on Google Play](https://play.google.com/store/apps/details?id=com.adda247.app&hl=en_US)
- [Adda247 - India's Largest Vernacular Learning Platform](https://www.adda247.com/)
- [Unacademy: Learn & Crack Exams - Apps on Google Play](https://play.google.com/store/apps/details?id=com.unacademyapp)
- [GSET Cut Off Marks 2026 (Adda247)](https://www.adda247.com/teaching-jobs-exam/gset-cut-off/)
- [GSET 2025 Commerce Expected Cutoff Marks with Last 3 Years' Cutoff Trends (CollegeDekho)](https://www.collegedekho.com/news/gset-2025-commerce-expected-cutoff-marks-with-last-3-years-cutoff-trends-74135/)
- [Gujarat GSET Cut Off - Testbook](https://testbook.com/gset/cut-off)
- [GSET Commerce Cut Off | Previous Year Cut off Marks (IFAS Online)](https://ifasonline.com/g-set/commerce-cutoff/6433e7168fb2f655c0e63183/6433b1fb6f88433b504b420d/650f442ffaa58c162740421d)
