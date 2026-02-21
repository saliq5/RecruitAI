End-to-End Recruiting AI (MVP) — Deliverable

0) Assumptions
- Tenant model: Single-tenant MVP (one company instance). Multi-tenant considerations documented but deferred.
- SQL DB: PostgreSQL 15 for relational data, transactions, constraints.
- ElasticSearch: Elasticsearch 8.x single-node for dev; Kibana enabled. BM25 + dense_vector for hybrid retrieval.
- Elastic Agent Builder: Used to define and run agent workflows (problem setter, question setter, critic, evaluator) and tool contracts.
- AuthN/AuthZ: JWT-based auth (Spring Security). Roles: CANDIDATE, RECRUITER, ADMIN.
- Identity provider: In-app user store for MVP with password hashing (bcrypt). Optional SSO (OIDC) noted for future.
- Transcription: Local Whisper.cpp/whisper-small/en for dev; optional cloud STT noted (e.g., Deepgram, AssemblyAI) via pluggable interface.
- LLMs: Local via Ollama/LM Studio (3B–8B models) for cost control; optional free-tier hosted endpoints (Together, Groq Mixtral/Llama Guard, HF Inference) with rate limiting.
- Containerization: Docker for all services; Docker Compose for local dev.
- Frontend: React + Vite (or CRA) with JWT auth and React Query for data fetching.
- Backend: Java 21 + Spring Boot 3.x; Spring Web, Security, Data JPA, Validation, Actuator, Test (JUnit 5).
- Testing: JUnit + Mockito (backend), Jest + React Testing Library (frontend).
- File storage: Resumes stored as binary in object storage is preferred; for MVP we store in DB bytea or local volume with DB pointer.
- PII and compliance: Minimal retention (configurable); audit logs persisted; access restricted by roles. No protected attributes used for decisioning.
- Deployment target: Local via Docker Compose; cloud via low-cost options (Render/Fly/OCI Free Tier/Elastic Cloud trial/Neon/ Railway).
- Observability: Console logs JSON format; Actuator health; optional Filebeat/Elastic Agent for local shipping to ES.

1) Context (System Overview)
We implement an end-to-end recruiting workflow:
- Login → Job application selection → Resume upload; all metadata written to SQL (applications, attempts, audit).
- Round 1 (Resume Screening): Agent-based resume analysis + keyword matching; weighted normalized final score; threshold gate 80.
- Round 2 (Online Assessment): Top-5 skill extraction, knowledge grounding from ES KB, 30 MCQs by Problem Setter agent; scoring and threshold gate 85.
- Round 3 (AI Virtual Interview): Question Setter + Critic loop to produce deep technical + HR questions; candidate voice answers transcribed; Evaluator + Critic judges final fit.
- Final decision and human interview scheduling: Semantic match JD/resume with interviewer profiles; schedule meeting.

2) Mandatory Tech Stack (confirmation)
- ElasticSearch (mandatory) for KB, resumes/JDs indexing, interviewer profiles, semantic search, hybrid retrieval.
- Elastic Agent Builder (mandatory) for multi-agent orchestration and tool contracts.
- SQL DB (PostgreSQL) for core transactional data and auditing.
- React for frontend UI.
- Java + Spring for backend services (single app with clear module boundaries for MVP).
- Docker/containerization for all runtime services.
- JUnit for backend testing.
- Jest for frontend testing.

3.1 End-to-end workflow flowchart
```mermaid
flowchart LR
  subgraph UI[React Frontend]
    ULogin[Login/Register]
    UJobs[View Jobs]
    UApply[Apply & Upload Resume]
    UAssess[Online Assessment (30 MCQs)]
    UInterview[AI Virtual Interview (Voice/Text)]
    USchedule[Scheduling View]
    UStatus[Application Status]
  end

  subgraph BE[Spring Boot Backend]
    A[AuthController]
    J[JobsController]
    AP[ApplicationsController]
    R1[ScreeningController (Round 1)]
    R2[AssessmentController (Round 2)]
    R3[InterviewController (Round 3)]
    S[SchedulingController]
    AU[AuditService]
    KV[KeywordService]
    SC[ScoringService]
    ESVC[ElasticService]
    AS[AgentOrchestrationService (Elastic Agent Builder)]
    STT[TranscriptionService]
  end

  subgraph DB[(PostgreSQL)]
    TUsers[(users)]
    TJobs[(jobs)]
    TApps[(applications)]
    TAttempts[(attempts)]
    TScores[(round_scores)]
    TAssess[(assessments)]
    TAns[(answers)]
    TQ[(interview_questions)]
    TTx[(transcripts)]
    TProf[(interviewer_profiles)]
    TSch[(schedules)]
    TAudit[(audit_logs)]
  end

  subgraph EStack[Elasticsearch + Kibana]
    KB[kb_docs index]
    JD[job_descriptions index]
    RS[resumes index]
    IP[interviewer_profiles index]
  end

  subgraph Agents[Elastic Agent Builder Orchestration]
    PS[Problem Setter Agent]
    QS[Question Setter Agent]
    CR[Critic Agent]
    EV[Evaluator Agent]
  end

  subgraph LLMs[LLMs/Tools]
    L1[Local/Hosted LLM]
    W[Whisper STT]
  end

  ULogin --> A
  UJobs --> J
  UApply --> AP
  UAssess --> R2
  UInterview --> R3
  USchedule --> S
  UStatus --> AP

  A --> TUsers
  J --> TJobs
  AP --> TApps
  AP -->|store attempt| TAttempts
  AP -->|resume meta| TApps
  AP -->|audit| TAudit

  R1 -->|keyword match| KV
  R1 -->|agent resume eval| AS
  KV -->|store kw score| TScores
  AS -->|resume eval score| TScores
  R1 -->|final weighted score| SC
  SC -->|gate >=80| R2

  R2 -->|extract top skills| AS
  AS -->|retrieve KB| ESVC
  ESVC --> KB
  AS -->|generate 30 MCQs| PS
  PS --> R2
  R2 -->|store assessment & questions| TAssess
  UAssess -->|submit answers| R2
  R2 -->|score| SC
  SC -->|gate >=85| R3
  R2 -->|audit| TAudit

  R3 -->|question loop| QS --> CR --> QS
  R3 -->|serve next question| UInterview
  UInterview -->|audio/text| R3
  R3 --> STT --> W
  STT -->|transcript| TTx
  R3 -->|evaluate answers| EV
  EV --> CR --> EV
  EV -->|final interview score| TScores
  R3 -->|audit| TAudit

  S -->|semantic search| ESVC
  ESVC --> JD & RS & IP
  S -->|create schedule| TSch
  S -->|audit| TAudit
```

3.2 HLD (High-Level Design)
- Architecture style
  - MVP: Modular monolith (single Spring Boot app) with clear modules: auth, jobs, applications, screening (R1), assessment (R2), interview (R3), scheduling, search, orchestration (agents), transcription, auditing.
  - Rationale: Faster to deliver, simpler ops; can split into microservices later along module boundaries (APIs and data already well-defined).
- Main components and responsibilities
  - Auth: JWT issuance/refresh, RBAC.
  - Jobs: CRUD jobs (RECRUITER/ADMIN), list/browse (CANDIDATE).
  - Applications: Create application, upload resume, track attempts, status.
  - Screening (R1): Keyword match + agent-based resume evaluation; compute weighted score and persist.
  - Assessment (R2): Extract skills, retrieve KB from ES, generate 30 MCQs, collect answers, compute score.
  - Interview (R3): Question setter/critic loop, capture voice answers, transcribe, evaluate + critic, produce final interview score.
  - Scheduling: Semantic match to interviewer profiles and create schedule.
  - Search: ElasticService for indexing and querying resumes/JDs/KB/profiles.
  - Agent Orchestration: Elastic Agent Builder workflows, tool contracts bridging to Elastic and DB.
  - Transcription: Adapter for local Whisper and pluggable cloud STT.
  - Audit: Create immutable audit entries and event logs for key actions.
- End-to-end data flow
  - UI ⇄ Backend over REST (JWT).
  - Backend ⇄ SQL via JPA repositories for transactional records.
  - Backend ⇄ Elasticsearch for retrieval (KB, semantic search) and indexing (resumes/JDs/profiles).
  - Backend ⇄ Agents via Elastic Agent Builder to run declarative workflows utilizing tools (search, generate, evaluate).
- Identity/auth approach (MVP)
  - Username/password with bcrypt hashes; JWT access tokens (15–30m), refresh tokens (7–30d). Roles enforced at controller method level.
  - File uploads scanned for type/size; stored and referenced by application record.
- Logging/monitoring (MVP)
  - JSON logs to stdout, include correlation/request IDs.
  - Spring Boot Actuator for liveness/readiness and metrics (basic).
  - Optional: Filebeat/Elastic Agent to send logs to ES locally for Kibana dashboards.
- Key non-functional requirements
  - Privacy/Security: TLS in cloud; encryption at rest (managed DB/ES or encrypted volumes). PII minimization; role-based access; audit logs.
  - Fairness: No protected attributes; document criteria; human override workflow. Record reason codes for decisions.
  - Reliability: Idempotent APIs for attempts; basic retries for ES calls; constraints to prevent duplicates; health checks.

3.3 LLD (Low-Level Design)
- Java/Spring modules (packages)
  - com.recruitai.auth: AuthController, JwtService, UserService, UserRepository, PasswordEncoder config.
  - com.recruitai.jobs: JobsController, JobService, JobRepository, Job entity/DTO.
  - com.recruitai.applications: ApplicationsController, ApplicationService, ApplicationRepository, FileStorageService, AttemptRepository.
  - com.recruitai.round1: ScreeningController, KeywordService, ResumeEvaluationService (agent adapter), ScoringService, RoundScoreRepository.
  - com.recruitai.round2: AssessmentController, SkillExtractorService, ProblemSetterAgentClient, AssessmentService, AssessmentRepository, AnswerRepository.
  - com.recruitai.round3: InterviewController, QuestionSetterAgentClient, CriticAgentClient, EvaluatorAgentClient, TranscriptionService, TranscriptRepository, InterviewQuestionRepository.
  - com.recruitai.scheduling: SchedulingController, SemanticMatchService, ScheduleRepository, InterviewerProfileRepository.
  - com.recruitai.search: ElasticService (index, search), Mappings and QueryBuilders.
  - com.recruitai.agents: AgentOrchestrationService (Elastic Agent Builder integration), tool contracts.
  - com.recruitai.audit: AuditService, AuditLogRepository, MDC/correlation handling.
  - com.recruitai.common: DTOs, exceptions, validators, config.
- React components/pages
  - Pages: LoginPage, JobsPage, JobDetailPage, ApplyPage (resume upload), AssessmentPage (questions UI), InterviewPage (mic controls, Q/A), SchedulePage, StatusPage, AdminDashboard.
  - Components: ResumeUpload, MCQList, QuestionCard, AudioRecorder, ScoreBanner, ProtectedRoute, Navbar.
  - State: AuthContext (JWT), React Query for API calls; local state for answers before submit.
- Key REST APIs (examples)
  - Auth
    - POST /api/auth/login {username, password} → {accessToken, refreshToken, role}
    - POST /api/auth/refresh {refreshToken} → {accessToken}
  - Jobs
    - GET /api/jobs → [{id, title, location, skills, jd_id}]
    - GET /api/jobs/{id} → {id, title, description, skills, jd_id}
    - POST /api/jobs (RECRUITER) → create/update
  - Applications
    - POST /api/applications multipart/form-data {jobId, resumeFile} → {applicationId, status: "SUBMITTED"}
    - GET /api/applications/{id} → {id, jobId, userId, status, createdAt}
  - Round 1: Screening
    - POST /api/screening/{applicationId}/run → {kwScore, resumeScore, finalScore, passed: boolean, threshold: 0.8}
    - GET /api/screening/{applicationId} → latest scores
  - Round 2: Assessment
    - POST /api/assessments/{applicationId}/generate → {assessmentId, questions: [ ...30 ]}
    - POST /api/assessments/{assessmentId}/answers → {score, passed: boolean, threshold: 0.85}
    - GET /api/assessments/{assessmentId} → {questions, status}
  - Round 3: Interview
    - GET /api/interview/{applicationId}/next-question → {questionId, text, type}
    - POST /api/interview/{applicationId}/answer {questionId, text|audioBlobId} → {ack}
    - POST /api/interview/{applicationId}/finalize → {interviewScore, decision}
  - Scheduling
    - GET /api/interviewers/search?q=devops+k8s → [{id, name, skills, score}]
    - POST /api/schedule {applicationId, interviewerId, slot} → {scheduleId, status}
  - Audit (ADMIN)
    - GET /api/audits?applicationId=... → [{...}]
- Request/Response JSON examples
  - POST /api/applications (multipart)
    - Response: {"applicationId":"uuid","status":"SUBMITTED"}
  - POST /api/screening/{applicationId}/run
    - Response: {"kwScore":0.72,"resumeScore":0.85,"finalScore":0.79,"passed":false,"threshold":0.8}
  - POST /api/assessments/{id}/answers
    - Request: {"answers":[{"questionId":"q1","choice":"B"}, ...]}
    - Response: {"score":0.9,"passed":true,"threshold":0.85}
- SQL schema proposal (tables + key columns)
  - users(id PK, username UNIQUE, email, password_hash, role, created_at)
  - jobs(id PK, title, description, skills TEXT[], location, jd_doc_id, created_by, created_at)
  - applications(id PK, user_id FK, job_id FK, resume_uri or resume_blob, status ENUM, created_at)
  - attempts(id PK, application_id FK, round ENUM(R1,R2,R3), attempt_no, locked BOOLEAN, created_at)
  - round_scores(id PK, application_id FK, round ENUM, kw_score, resume_score, final_score, passed BOOLEAN, created_at)
  - assessments(id PK, application_id FK, questions JSONB, generated_at, status)
  - answers(id PK, assessment_id FK, question_id, selected, correct BOOLEAN, created_at)
  - interview_questions(id PK, application_id FK, seq_no, text, type ENUM(TECH,HR), created_at)
  - transcripts(id PK, application_id FK, question_id FK NULLABLE, text, audio_uri, created_at)
  - interviewer_profiles(id PK, name, skills TEXT[], seniority, availability JSONB, es_doc_id)
  - schedules(id PK, application_id FK, interviewer_id FK, slot_ts, status, created_at)
  - audit_logs(id PK, actor_user_id, action, entity, entity_id, details JSONB, created_at)
  - Indexes on (user.username), (applications.job_id), (round_scores.application_id), GIN on JSONB fields where needed.
- Elasticsearch design
  - Indices
    - kb_docs: Documentation chunks, fields: id, title, source, content (text), embedding (dense_vector 768), tags, updated_at
    - job_descriptions: id, job_id, title, description (text), embedding
    - resumes: id, application_id, text_content, sections, skills, embedding
    - interviewer_profiles: id, profile_id, name, skills, past_interviews, embedding
  - Example mappings (abridged)
    - text fields with standard analyzer; keyword for IDs/tags; dense_vector for embeddings with cosine similarity.
  - Query examples
    - BM25: match/multi_match on content/description/skills
    - Vector: knn search on embedding for query embedding
    - Hybrid: bool must on BM25 + script_score or rank with vector similarity
- Agent/tool contracts (Elastic Agent Builder)
  - Tools (HTTP/Java adapters exposed to agents)
    - search_kb: input {query:string, topK:int} → {results:[{id, title, content, score}]}
    - index_resume: {applicationId, text, skills} → {docId}
    - keyword_match: {resumeText, jdText} → {kwScoreRaw:number, keywordsUsed:[string]}
    - generate_questions: {skills:[string], count:int, difficulty:string} → {questions:[{id,text,choices,answer}]}
    - evaluate_assessment: {answers:[...], key:[...]} → {scoreRaw:number}
    - transcribe: {audioUri} → {text}
    - evaluate_interview: {qa:[{q,a}] } → {scoreRaw:number, rationales:[string]}
    - persist_score: {applicationId, round, scores:{...}} → {ok:true}
  - Agents
    - Problem Setter Agent (R2): uses search_kb, generate_questions, persist assessment.
    - Question Setter Agent (R3): generates deep questions; Critic Agent reviews; loop until depth OK.
    - Evaluator Agent (R3): evaluates responses; Critic Agent checks evaluator’s reasoning; final score persisted.
- Deterministic scoring approach
  - Normalization
    - resume_score_norm = clip((resume_score_raw - r_min)/(r_max - r_min), 0, 1)
    - keyword_score_norm = clip((kw_score_raw - k_min)/(k_max - k_min), 0, 1)
  - Round 1 final weighted score
    - final_r1 = 0.6 * resume_score_norm + 0.4 * keyword_score_norm
    - pass if final_r1 ≥ 0.80; store pass/fail and threshold
  - Round 2 score
    - final_r2 = correct_count / total (or weighted by difficulty), normalized 0..1
    - pass if final_r2 ≥ 0.85; single attempt unless recruiter unlocks
  - No-retake enforcement
    - attempts table has locked flags by round; once passed/finalized, lock to prevent further attempts; admin override allowed with audit.

3.4 Tech stack mapping
- Elasticsearch vs SQL
  - SQL: authoritative transactional data (users, apps, attempts, scores, schedules, audit).
  - ES: search/retrieval/semantic similarity for KB, resumes/JDs, interviewer profiles; supports hybrid ranking grounding LLMs.
- Elastic Agent Builder
  - Defines agent graphs and tools; orchestrates Problem Setter, Question Setter, Critic, Evaluator; ensures reproducible runs and auditability.
- Spring boundaries
  - Controllers expose REST; Services encapsulate business rules; Repositories encapsulate persistence; Integrations (ES, STT, LLM) behind adapters; Orchestration service calls Agent Builder.
- React structure
  - Pages mapped to rounds; reusable components for upload, MCQs, mic capture; React Query for API; ProtectedRoute by role.
- Docker usage
  - docker-compose for local dev: postgres, elasticsearch+kibana, backend, frontend. Env vars via .env; volumes for data; healthchecks; depends_on.

3.5 Deployment plan (free/low-cost)
- Local/dev with Docker Compose
  - Services: postgres, elasticsearch (single-node, security disabled locally), kibana, backend, frontend.
  - Seed scripts: sql-schema.sql applied automatically; sample data optional.
- Free-tier-friendly cloud
  - Backend: Render/Fly.io/OCI Always Free (1–2 small instances).
  - DB: Neon/ElephantSQL Free tier or OCI Free Autonomous Postgres-compatible option.
  - ES: Elastic Cloud trial or Bonsai free tier (limited).
  - Frontend: Vercel/Netlify (static build).
  - Object storage: Cloud bucket free tier (S3/OCI).
- CI basics (GitHub Actions)
  - Jobs: backend (mvn -B verify), frontend (npm ci && npm test && npm run build), docker build (optional), integration tests matrix.
- Secrets handling
  - Never hardcode; GitHub Envs/Secrets, .env in CI with masked; runtime env vars injected. For local, .env.example copied to .env (ignored).
- Minimal logging/monitoring
  - Structured logs + Actuator; uptime checks; optional Elastic Agent shipping logs to ES; Kibana dashboards for errors and API rates.

3.6 Plan to use free/small LLM APIs (multi-agent friendly)
- Options
  - Local: Ollama (e.g., llama3.1:8b, mistral:7b), LM Studio; embeddings via all-MiniLM or E5-small.
  - Hosted free/low-cost: Together/Groq (free tiers vary), HuggingFace Inference, OpenRouter with rate caps.
- Cost/latency controls
  - Cache prompts/responses by hash; reuse embeddings; batch queries; aggressive token limits (system+few-shot minimal); rate limiting (token bucket).
- Safety controls
  - PII: redact emails, phones before sending to LLM where not strictly needed; truncate resumes/JDs to relevant chunks via ES retrieval.
  - Data minimization: only send question+needed snippet to model; store minimal outputs.
  - Retention: configurable TTL for transcripts; anonymize for analytics.
- Prompt injection mitigations
  - Treat resume/JD as untrusted; canonical system prompts with explicit tool whitelist; strip instructions from user docs before inclusion; use retrieval-augmented templates with delimiters; output schemas validated server-side.
- Grounding via Elastic retrieval
  - Use hybrid search (BM25 + vector) to fetch top-k docs/sections and feed as context; citations added to questions/explanations to reduce hallucinations.

4) Non-functional constraints (compliance summary)
- Sensitive data: TLS in transit; encrypted volumes/managed encryption at rest; least-privilege DB users; role-based UI; audit logs for actions.
- Fairness/compliance: exclude protected attributes; document decision thresholds/weights; provide human override; store rationales.
- Security: validate/scan file uploads; size/type limits; sanitize text; prepared statements/ORM; dependency scanning; content filtering for LLM I/O; timeouts and budgets; SSRF-safe HTTP clients.

5) Output formatting rules adherence
- Sections 3.1–3.6 included with headings exactly as specified; Mermaid flowchart in fenced code block; concrete endpoints, tables, index names, mappings overview, and formulas provided.

6) Generate the deliverable
- This file is the consolidated deliverable. Separate artifacts (.mmd, .md per section, OpenAPI, SQL DDL, ES mappings, Compose, .env.example, README) will be generated as files alongside this document for immediate use in development.
