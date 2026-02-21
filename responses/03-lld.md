3.3 LLD (Low-Level Design)

1) Java/Spring detailed module breakdown
- Package layout (com.recruitai.*)
  - auth
    - AuthController
      - POST /api/auth/login
      - POST /api/auth/refresh
    - JwtService (issue/verify/refresh)
    - UserService (CRUD, password hashing, roles)
    - SecurityConfig (JWT filter, CORS, RBAC)
    - JwtAuthenticationFilter (OncePerRequestFilter)
    - CurrentUser (helper to resolve principal)
  - jobs
    - JobsController (list, get, create/update for recruiters)
    - JobService (business rules, validation)
    - JobRepository (JpaRepository<Job, UUID>)
    - Job (entity), JobDTO (in/out)
  - applications
    - ApplicationsController (create app, get status)
    - ApplicationService (persist app, upload handling, ES indexing trigger)
    - ApplicationRepository, AttemptRepository
    - FileStorageService (local volume or object storage)
    - Application, Attempt (entities), DTOs
  - round1 (screening)
    - ScreeningController (run/get results)
    - KeywordService (JD vs resume term scoring)
    - ResumeEvaluationService (agent adapter; calls AgentOrchestrationService)
    - ScoringService (normalization + weighted score)
    - RoundScoreRepository
    - RoundScore (entity), DTOs
  - round2 (assessment)
    - AssessmentController (generate, submit answers, get)
    - SkillExtractorService (extract top skills from resume/JD text)
    - ProblemSetterAgentClient (calls AgentOrchestrationService tool: generate_questions)
    - AssessmentService (persist assessment, answers, compute score)
    - AssessmentRepository, AnswerRepository
    - Assessment, Answer (entities), DTOs
  - round3 (interview)
    - InterviewController (next-question, answer, finalize)
    - QuestionSetterAgentClient, CriticAgentClient, EvaluatorAgentClient
    - TranscriptionService (Whisper/local or cloud via interface)
    - TranscriptRepository, InterviewQuestionRepository
    - InterviewQuestion, Transcript (entities), DTOs
  - scheduling
    - SchedulingController (search interviewers, create schedule)
    - SemanticMatchService (ES hybrid retrieval + simple scoring)
    - ScheduleRepository, InterviewerProfileRepository
    - Schedule, InterviewerProfile (entities), DTOs
  - search
    - ElasticService (index, search, query builders)
    - Mappings (constants), Queries (builders for BM25, vector, hybrid)
  - agents
    - AgentOrchestrationService (Elastic Agent Builder integration; tool registry)
    - ToolContracts (POJOs for tool I/O)
  - audit
    - AuditService (append-only writes)
    - AuditLogRepository
    - AuditLog (entity)
  - common
    - ApiError, ExceptionHandlers (@ControllerAdvice)
    - Ids (UUID utils), Validation annotations
    - DTO mappers (MapStruct optional)

2) Selected entities (JPA) and DTOs (abridged)
- Users
  - User { id: UUID, username: String, email: String, passwordHash: String, role: Role, createdAt: Instant }
  - Role = CANDIDATE | RECRUITER | ADMIN
- Jobs
  - Job { id, title, description, skills: List<String>, location, jdDocId: String, createdBy: UUID, createdAt }
- Applications
  - Application { id, userId, jobId, resumeUri: String?, resumeBlob: byte[]?, status: ApplicationStatus, createdAt }
  - ApplicationStatus = SUBMITTED | R1_PASSED | R1_FAILED | R2_PASSED | R2_FAILED | R3_PASSED | R3_FAILED | SCHEDULED | REJECTED | SELECTED
  - Attempt { id, applicationId, round: Round, attemptNo: int, locked: boolean, createdAt }
  - Round = R1 | R2 | R3
- Round scores
  - RoundScore { id, applicationId, round, kwScore: Double?, resumeScore: Double?, finalScore: Double, passed: boolean, threshold: Double, createdAt }
- Assessments & answers
  - Assessment { id, applicationId, questions: JsonNode, generatedAt, status: AssessmentStatus }
  - AssessmentStatus = GENERATED | COMPLETED
  - Answer { id, assessmentId, questionId, selected, correct: boolean, createdAt }
- Interview
  - InterviewQuestion { id, applicationId, seqNo: int, text: String, type: QuestionType, createdAt }
  - QuestionType = TECH | HR
  - Transcript { id, applicationId, questionId: UUID?, text: String, audioUri: String?, createdAt }
- Scheduling
  - InterviewerProfile { id, name, skills: List<String>, seniority: String, availability: JsonNode, esDocId: String? }
  - Schedule { id, applicationId, interviewerId, slotTs: Instant, status: String, createdAt }
- Audit
  - AuditLog { id, actorUserId: UUID?, action: String, entity: String, entityId: String, details: JsonNode, createdAt }

3) Controllers and endpoints (auth and validation)
- Security
  - @PreAuthorize on controller methods, e.g. @PreAuthorize("hasRole('RECRUITER')") for job create
  - JWT filter reads Authorization: Bearer token, sets SecurityContext
  - Validation with @Valid and javax.validation annotations on DTOs
- Endpoints (with roles)
  - Auth
    - POST /api/auth/login (ANON) → 200 {accessToken, refreshToken, role}
    - POST /api/auth/refresh (ANON) → 200 {accessToken}
  - Jobs
    - GET /api/jobs (ANY AUTH) → 200 [JobSummaryDTO]
    - GET /api/jobs/{id} (ANY AUTH) → 200 JobDTO
    - POST /api/jobs (RECRUITER/ADMIN) {title, description, skills, location} → 201 JobDTO
  - Applications
    - POST /api/applications (CANDIDATE) multipart {jobId, resumeFile} → 201 {applicationId, status}
    - GET /api/applications/{id} (OWNER/RECRUITER/ADMIN) → 200 ApplicationDTO
  - Round 1
    - POST /api/screening/{applicationId}/run (OWNER/RECRUITER/ADMIN) → 200 {kwScore, resumeScore, finalScore, passed, threshold}
    - GET /api/screening/{applicationId} (OWNER/RECRUITER/ADMIN) → 200 RoundScoreDTO
  - Round 2
    - POST /api/assessments/{applicationId}/generate (OWNER/RECRUITER/ADMIN) → 201 {assessmentId, questions:[...30]}
    - GET /api/assessments/{assessmentId} (OWNER/RECRUITER/ADMIN) → 200 {questions, status}
    - POST /api/assessments/{assessmentId}/answers (OWNER) {answers:[{questionId,choice}]} → 200 {score, passed, threshold}
  - Round 3
    - GET /api/interview/{applicationId}/next-question (OWNER) → 200 {questionId, text, type}
    - POST /api/interview/{applicationId}/answer (OWNER) {questionId, text?|audioBlobId?} → 202 {ack:true}
    - POST /api/interview/{applicationId}/finalize (OWNER/RECRUITER) → 200 {interviewScore, decision}
  - Scheduling
    - GET /api/interviewers/search?q=... (RECRUITER/ADMIN) → 200 [InterviewerHitDTO]
    - POST /api/schedule (RECRUITER/ADMIN) {applicationId, interviewerId, slot} → 201 {scheduleId,status}
  - Audit
    - GET /api/audits?applicationId=... (ADMIN) → 200 [AuditLogDTO]

- Sample request/response JSON
  - POST /api/screening/{applicationId}/run
    - Response:
      {
        "kwScore": 0.72,
        "resumeScore": 0.85,
        "finalScore": 0.79,
        "passed": false,
        "threshold": 0.8
      }
  - POST /api/assessments/{assessmentId}/answers
    - Request: { "answers": [ { "questionId": "q1", "choice": "B" } ] }
    - Response: { "score": 0.9, "passed": true, "threshold": 0.85 }

4) Service-layer algorithms and pseudocode
- KeywordService (simplified)
  - tokenize JD and resume; compute overlap weighted by TF (optionally IDF from corpus)
  - kwScoreRaw = sum(weighted overlaps)
- ScoringService
  - normalize(x, min, max) = min(1, max(0, (x - min) / (max - min)))
  - finalR1 = 0.6 * normalize(resumeRaw, rMin, rMax) + 0.4 * normalize(kwRaw, kMin, kMax)
  - pass if finalR1 >= 0.80
- Attempts/no-retake enforcement
  - onRunRound(round):
      if Attempt.locked for (app, round): throw 409
      compute score; persist RoundScore; set Attempt.locked=true if policy enforces lock; audit
- Assessment scoring
  - correctCount = count(answer.selected == key[questionId])
  - score = correctCount / total
  - pass if score >= 0.85
- Interview evaluation
  - For each Q/A, EvaluatorAgent returns scoreRaw per competency; aggregate to interviewScore (0..1)
  - CriticAgent validates reasoning; if discrepancy > epsilon → request reevaluation

5) SQL schema proposal (DDL summary; full in sql-schema.sql)
- users(id UUID PK, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT, role TEXT, created_at TIMESTAMPTZ)
- jobs(id UUID PK, title TEXT, description TEXT, skills TEXT[], location TEXT, jd_doc_id TEXT, created_by UUID, created_at TIMESTAMPTZ)
- applications(id UUID PK, user_id UUID FK, job_id UUID FK, resume_uri TEXT NULL, resume_blob BYTEA NULL, status TEXT, created_at TIMESTAMPTZ)
- attempts(id UUID PK, application_id UUID FK, round TEXT, attempt_no INT, locked BOOLEAN, created_at TIMESTAMPTZ)
- round_scores(id UUID PK, application_id UUID FK, round TEXT, kw_score DOUBLE PRECISION NULL, resume_score DOUBLE PRECISION NULL, final_score DOUBLE PRECISION NOT NULL, passed BOOLEAN, threshold DOUBLE PRECISION, created_at TIMESTAMPTZ)
- assessments(id UUID PK, application_id UUID FK, questions JSONB, generated_at TIMESTAMPTZ, status TEXT)
- answers(id UUID PK, assessment_id UUID FK, question_id TEXT, selected TEXT, correct BOOLEAN, created_at TIMESTAMPTZ)
- interview_questions(id UUID PK, application_id UUID FK, seq_no INT, text TEXT, type TEXT, created_at TIMESTAMPTZ)
- transcripts(id UUID PK, application_id UUID FK, question_id UUID NULL, text TEXT, audio_uri TEXT NULL, created_at TIMESTAMPTZ)
- interviewer_profiles(id UUID PK, name TEXT, skills TEXT[], seniority TEXT, availability JSONB, es_doc_id TEXT NULL)
- schedules(id UUID PK, application_id UUID FK, interviewer_id UUID FK, slot_ts TIMESTAMPTZ, status TEXT, created_at TIMESTAMPTZ)
- audit_logs(id UUID PK, actor_user_id UUID NULL, action TEXT, entity TEXT, entity_id TEXT, details JSONB, created_at TIMESTAMPTZ)
- Indexes: users(username), users(email), applications(job_id), round_scores(application_id), GIN on (assessments.questions), (interviewer_profiles.availability)

6) Elasticsearch design
- Index names
  - kb_docs, job_descriptions, resumes, interviewer_profiles
- Common fields
  - id (keyword), embedding (dense_vector, dims: 768, index: true, similarity: cosine)
- Mappings (abridged examples)
  - kb_docs
    - title (text), source (keyword), content (text), tags (keyword), updated_at (date), embedding (dense_vector)
  - job_descriptions
    - job_id (keyword), title (text), description (text), skills (keyword), embedding (dense_vector)
  - resumes
    - application_id (keyword), text_content (text), sections (nested? simplified as object), skills (keyword), embedding (dense_vector)
  - interviewer_profiles
    - profile_id (keyword), name (text), skills (keyword), past_interviews (integer), embedding (dense_vector)
- Query examples (DSL)
  - BM25:
    {
      "query": { "multi_match": { "query": "kubernetes daemonset rollout", "fields": ["content^2", "title"] } }
    }
  - Vector (kNN):
    {
      "knn": {
        "field": "embedding",
        "query_vector": [ ...768... ],
        "k": 50,
        "num_candidates": 200
      }
    }
  - Hybrid:
    {
      "query": {
        "bool": {
          "must": [
            { "multi_match": { "query": "docker networking", "fields": ["content","title"] } }
          ]
        }
      },
      "knn": { "field": "embedding", "query_vector": [ ... ], "k": 50, "num_candidates": 200 }
    }

7) Agent/tool contracts (Elastic Agent Builder)
- Tool definitions (inputs/outputs)
  - search_kb
    - in: { query: string, topK?: number }
    - out: { results: [ { id, title, contentSnippet, score } ] }
  - index_resume
    - in: { applicationId: string, text: string, skills?: string[] }
    - out: { docId: string }
  - keyword_match
    - in: { resumeText: string, jdText: string }
    - out: { kwScoreRaw: number, keywordsUsed: string[] }
  - generate_questions
    - in: { skills: string[], count: number, difficulty?: "EASY"|"MEDIUM"|"HARD" }
    - out: { questions: [ { id, text, choices: string[4], answer: "A"|"B"|"C"|"D" } ] }
  - evaluate_assessment
    - in: { answers: [ { questionId, selected } ], key: [ { questionId, correct } ] }
    - out: { scoreRaw: number, correctByQ: Record<string,boolean> }
  - transcribe
    - in: { audioUri: string }
    - out: { text: string }
  - evaluate_interview
    - in: { qa: [ { q: string, a: string } ] }
    - out: { scoreRaw: number, rationales: string[] }
  - persist_score
    - in: { applicationId: string, round: "R1"|"R2"|"R3", scores: object }
    - out: { ok: true }
- Agents and allowed tools
  - Problem Setter Agent (R2): search_kb, generate_questions, persist_score
  - Question Setter Agent (R3): search_kb, generate_questions
  - Critic Agent (R3): search_kb (for grounding), persist_score (comments)
  - Evaluator Agent (R3): evaluate_interview, persist_score
  - Resume Evaluation Agent (R1): search_kb (optional), evaluate_interview-like rubric for resume, persist_score

8) React LLD
- Routes
  - /login, /jobs, /jobs/:id, /apply/:jobId, /assessment/:applicationId, /interview/:applicationId, /schedule/:applicationId, /status
- Components
  - ResumeUpload (props: jobId; emits FormData)
  - MCQList (props: questions[30], onSubmit)
  - QuestionCard (props: question, onAnswer)
  - AudioRecorder (records to blob; posts to /upload-audio; receives blobId)
  - ScoreBanner (props: score, passed, threshold)
  - ProtectedRoute (role checks)
- API client (React Query)
  - useLogin, useJobs, useApply, useScreeningRun, useAssessmentGenerate, useAssessmentSubmit, useInterviewNext, useInterviewAnswer, useInterviewFinalize, useScheduleCreate
- Types (TS)
  - Align with OpenAPI schemas (api-spec.yaml), e.g., AssessmentQuestion { id, text, choices: string[4] }

9) Error handling and auditing
- Global exception handler returns {message, code, details?} with appropriate HTTP status
- AuditService invoked on: application create, screening run, assessment generate/submit, interview steps, schedule create, admin overrides
- Store correlationId (request-id) in audit details when available

10) Deterministic scoring (formulas)
- resume_score_norm = clip((resume_score_raw - r_min)/(r_max - r_min), 0, 1)
- keyword_score_norm = clip((kw_score_raw - k_min)/(k_max - k_min), 0, 1)
- final_r1 = 0.6 * resume_score_norm + 0.4 * keyword_score_norm; pass if ≥ 0.80
- final_r2 = correct_count / total; pass if ≥ 0.85
- interviewScore normalized 0..1 (aggregate rubric); decision recorded with thresholds and rationales

11) Security notes (MVP)
- Validate file type/size; scan names; store outside web root; only reference via signed/authorized endpoints
- Sanitize text sent to LLM; strip instructions; set token/time budgets; post-validate structured outputs
- RBAC on all endpoints; minimum info exposure in responses; avoid leaking PII to logs
