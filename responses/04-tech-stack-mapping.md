3.4 Tech Stack Mapping

Elasticsearch vs SQL (division of responsibilities)
- PostgreSQL (SQL DB)
  - Source of truth for transactional entities: users, jobs, applications, attempts, round_scores, assessments, answers, interview_questions, transcripts, interviewer_profiles (relational view), schedules, audit_logs.
  - Enforces relational integrity (PK/FK), unique constraints (usernames/emails), and “no-retake” logic via attempts/locks.
  - Supports reporting queries on applications over time (counts, thresholds, outcomes).
- Elasticsearch
  - Search/semantic retrieval corpora:
    - kb_docs (Kubernetes, Docker, etc. documentation chunks) used to ground question generation and evaluation.
    - job_descriptions (rich text + embeddings) for retrieval and interviewer matching.
    - resumes (extracted text + embeddings) for retrieval and semantic matching.
    - interviewer_profiles (skills + embeddings) for scheduling.
  - Combines BM25 (lexical) and dense_vector (semantic) for hybrid ranking to reduce hallucinations and improve relevance.
  - Stores only derived/searchable representations, not the transactional source of truth.

Elastic Agent Builder (orchestration role)
- Defines agent graphs and tool I/O contracts for:
  - Problem Setter Agent (R2): generate 30 MCQs grounded on kb_docs.
  - Question Setter Agent (R3) + Critic Agent: iterative deepening for interview questions.
  - Evaluator Agent (R3): rates transcripted answers against rubrics; Critic validates evaluator’s reasoning.
  - Resume Evaluation Agent (R1): optional rubric evaluation for resume quality.
- Ensures reproducibility, isolation, and auditability of agent runs through:
  - Tool whitelisting (search_kb, generate_questions, evaluate_interview, transcribe, persist_score, index_resume).
  - Deterministic parameters (counts/thresholds), token/time budgets, and structured outputs validated by backend.
- Bridges backend services via a thin adapter (AgentOrchestrationService) so agents never talk directly to DB/ES except through approved tools.

Spring service boundaries (backend)
- Controllers (REST): Input validation, RBAC checks, mapping to DTOs.
- Domain services: Encapsulate business logic (e.g., ScreeningService computes final R1 score from KeywordService + agent outputs).
- Integration services/adapters:
  - ElasticService (index/query abstractions; ensures consistent mappings and queries).
  - TranscriptionService (local Whisper or hosted STT behind a common interface).
  - AgentOrchestrationService (Elastic Agent Builder client).
- Persistence: JPA repositories that return domain entities/DTOs; only domain services call repositories. SQL remains authoritative.

React frontend structure
- Pages aligned to the recruiting flow:
  - Login → Jobs → Apply (resume upload) → Assessment (30 MCQs) → Interview (voice Q/A) → Schedule → Status → Admin Dashboard.
- State & data fetching:
  - AuthContext holds JWT and role; React Query handles cache/in-flight state and retries.
- Components are small and composable (ResumeUpload, MCQList, AudioRecorder, QuestionCard, ScoreBanner).
- Security:
  - ProtectedRoute to gate routes by role (CANDIDATE/RECRUITER/ADMIN).
  - Minimal PII in client state; never log resume text or transcripts in browser console.

Docker/containerization (hosting)
- Local dev via Docker Compose:
  - Services: postgres, elasticsearch (single-node), kibana; optional backend/frontend containers or run locally via dev servers.
  - Shared network and volumes for data persistence; healthchecks with sensible waits.
  - Configuration via .env, no secrets in code.
- Images kept small and pinned to explicit tags. Compose ready for future addition of Elastic Agent container if desired.

Testing approach (where each tech is tested)
- Backend (JUnit + Mockito):
  - Unit tests for ScoringService, KeywordService, controller validations, RBAC checks.
  - Integration tests with Testcontainers (Postgres, Elasticsearch) for repository and ElasticService validation.
- Frontend (Jest + React Testing Library):
  - Component tests (MCQList, ResumeUpload).
  - Hooks/integration tests with MSW (mock API).
- Agent flows (contract tests):
  - Validate tool input/output schemas (JSON) and error paths (timeouts, malformed responses).

Security & compliance alignment per tech
- SQL: Enforce RBAC and ownership in queries; encrypt connections in cloud; minimize PII fields.
- Elasticsearch: Index only necessary fields; redact/normalize content; avoid storing raw PII beyond what’s needed for search; API keys or basic auth in cloud.
- Agent Builder: Strict tool contracts; sanitize untrusted text (resume/JD); token/time budgets; deterministic prompts; log rationales without sensitive raw text.
- React: Avoid storing secrets; guard routes; sanitize file uploads; limit client-side logging.

Why this mapping for MVP
- Maximizes practicality: SQL for correctness and auditing; ES for relevance and grounding.
- Keeps orchestration explicit and reviewable: agents operate via well-defined tools.
- Minimizes ops burden with a single Spring Boot backend and a React SPA, both containerized.
- Aligns with the prompt’s thresholds and gates using deterministic scoring and auditable decisions.
