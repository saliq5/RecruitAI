3.2 HLD (High-Level Design)

Architecture style (MVP)
- Pattern: Modular monolith (single Spring Boot service) with clear internal module boundaries and REST controllers per domain. React SPA frontend.
- Rationale: Minimizes DevOps surface area and cognitive load while enabling clean separation for future extraction into services.
- Modules (packages):
  - auth, jobs, applications, round1 (screening), round2 (assessment), round3 (interview), scheduling, search (Elastic), agents (Elastic Agent Builder integration), transcription, audit, common (shared DTOs/config).

Main components and responsibilities
- React Frontend (SPA):
  - Pages: Login, Jobs listing/detail, Apply (resume upload), Assessment (30 MCQs), Interview (voice Q/A), Schedule, Status, Admin.
  - State: JWT (AuthContext), React Query for API calls, local form state for answers before submit.
- Spring Boot Backend (single app):
  - Controllers: Expose REST endpoints, validate inputs, enforce RBAC via annotations.
  - Services: Encapsulate business rules (screening, assessment generation/scoring, interview loop, scheduling).
  - Repositories: JPA repositories for PostgreSQL entities.
  - Integrations:
    - ElasticService: Index/query job descriptions, resumes, interviewer profiles, KB docs (BM25 + vector).
    - AgentOrchestrationService: Runs multi-agent workflows using Elastic Agent Builder tools/contracts.
    - TranscriptionService: Pluggable adapter (local Whisper or hosted STT).
  - Cross-cutting: AuditService (immutably log actions), ScoringService (deterministic thresholds), KeywordService (R1 keyword matching), Security (JWT).
- Datastores:
  - PostgreSQL: Authoritative system of record (users, jobs, applications, attempts, scores, assessments, answers, questions, transcripts, interviewer profiles, schedules, audit logs).
  - Elasticsearch: Search/semantic retrieval corpora (kb_docs, job_descriptions, resumes, interviewer_profiles) and semantic matching.
- LLM/Agents:
  - Elastic Agent Builder orchestrates Problem Setter (R2), Question Setter (R3), Critic (R3), Evaluator (R3) using whitelisted tools: search_kb, generate_questions, evaluate_assessment, evaluate_interview, transcribe, persist_score, index_resume.
  - Models: Local small models by default; optional free-tier hosted endpoints with strict token budgets and rate limits.

End-to-end data flow
1) Login + Application + Resume Upload
   - UI → /api/auth/login → JWT.
   - UI fetches jobs → /api/jobs.
   - UI posts application (multipart) → /api/applications (stores metadata, resume URI/blob, attempts[audit]).
   - Backend indexes resume text/skills into ES (resumes index) via ElasticService (asynchronous or synchronous per config).

2) Round 1: Resume Screening
   - UI triggers screening → /api/screening/{applicationId}/run.
   - Backend:
     - KeywordService computes kwScore (JD vs resume keywords).
     - AgentOrchestrationService invokes resume evaluation agent → resumeScore.
     - ScoringService computes final_r1 = 0.6*resume_norm + 0.4*kw_norm; gate @ 0.80.
     - Persist round_scores and attempts (lock if passed/failed per policy), audit the event.

3) Round 2: Online Assessment
   - UI requests generation → /api/assessments/{applicationId}/generate.
   - Backend:
     - Extract top 5 skills from resume/JD (Elastic retrieval + simple NER/regex skills list).
     - Problem Setter agent: uses KB retrieval (kb_docs) → generates 30 MCQs (with keys) → persist assessments.
   - Candidate answers → /api/assessments/{assessmentId}/answers → compute score (correct/total) → gate @ 0.85 → persist scores/attempts, audit.

4) Round 3: AI Virtual Interview
   - UI iterates GET next question → /api/interview/{applicationId}/next-question.
   - Candidate answers (text/audio). If audio uploaded → TranscriptionService (Whisper) → transcripts persisted.
   - Question Setter agent generates deep technical + HR Qs; Critic agent reviews; iteration continues until depth criteria met.
   - Evaluator agent scores responses; Critic reviews evaluator reasoning; final interview score persisted; audit all steps.

5) Final Decision + Human Interview Scheduling
   - Semantic search: JD + resume vector vs interviewer_profiles in ES to suggest best interviewer(s).
   - UI posts schedule → /api/schedule → persisted in schedules; audit entry.
   - Admin can override decisions with justification (audited).

Identity/auth approach (MVP)
- AuthN: Username/password with bcrypt hashes stored in users table. JWT access (15–30m) and refresh tokens (7–30d).
- AuthZ: Role-based (CANDIDATE, RECRUITER, ADMIN). Method-level @PreAuthorize checks. Protected routes on frontend via ProtectedRoute.
- File safety: Validate mime/size; store to local volume or object storage; reference path/URI in DB. Sanitize extracted text.

Logging/monitoring approach (MVP)
- Logging: Structured JSON logs (logback config) with correlation IDs (MDC). Include userId/actor where available.
- Metrics/Health: Spring Boot Actuator (health, metrics, info). Readiness/liveness endpoints for future k8s.
- Local Observability: Optional Elastic Agent (or Filebeat) to ship logs into Elasticsearch; visualize in Kibana.
- Auditing: AuditService writes immutable audit_logs (who, what, when, entity, payload summary).

Key non-functional requirements
- Privacy/Security:
  - TLS in transit in cloud; local dev can be HTTP.
  - Encryption at rest via managed services or encrypted volumes.
  - PII minimization (store minimal required fields), redact before LLM calls.
  - Principle of least privilege DB accounts; parameterized queries via JPA; input validation.
- Fairness/Compliance:
  - Exclude protected attributes from any scoring or decision signals.
  - Document scoring thresholds and rationale; store reason codes.
  - Human-in-the-loop override path; all overrides audited.
- Reliability (MVP):
  - Idempotent endpoints for screening/assessments submission to avoid duplicates.
  - Basic retry/backoff for Elastic requests; graceful fallbacks (e.g., if ES down, disable semantic features temporarily).
  - Constraints and indexes prevent duplicates; health checks for all dependencies.
- Performance/Scalability (MVP realistic):
  - Single-node ES and Postgres with Docker Compose for dev; vertical scaling on free-tier cloud.
  - Caching embeddings and LLM responses by hash; batch ES queries where possible.
  - Token budgets to bound LLM latency; timeouts on agent calls.

Primary interfaces and boundaries
- REST contracts between React and Spring define the seam; documented in api-spec.yaml.
- Persistence boundary encapsulated by repositories and DTO mappers.
- Elastic boundary via ElasticService and request builders.
- Agent boundary via AgentOrchestrationService with explicit tool I/O schemas and guardrails.
- Transcription boundary via TranscriptionService with interchangeable providers.

Security model (summarized)
- JWT in Authorization: Bearer header; CORS configured for frontend origin.
- Input sanitation (text, files), strict content-types, size limits.
- Prompt injection mitigations: fixed system prompts, delimited retrieved context, post-generation validation, no direct tool execution from model output without validation.
- Secrets via environment variables; never committed. Refresh key rotation documented in deployment plan.

Deployment view (brief)
- Local: docker-compose spins up Postgres, Elasticsearch, Kibana, backend, and frontend.
- Cloud (free-tier): Backend (Render/Fly/OCI), DB (Neon/ElephantSQL), ES (Elastic Cloud/Bonsai), Frontend (Vercel/Netlify). CI runs tests/build and pushes artifacts/images.

Traceability to requirements
- R1-3 workflows, scoring gates, audit logging, and scheduling map directly to the prompt’s mandatory steps with MVP-appropriate tech stack and safeguards.
