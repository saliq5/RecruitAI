-- RecruitAI MVP - PostgreSQL Schema (DDL)
-- Postgres 15 compatible
-- Note: This file is intended to be mounted into /docker-entrypoint-initdb.d for automatic init in Docker Compose.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- =========================
-- Users & Auth
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CANDIDATE','RECRUITER','ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Jobs
-- =========================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  jd_doc_id TEXT, -- optional ES doc id if JD is indexed
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs (title);
CREATE INDEX IF NOT EXISTS idx_jobs_skills ON jobs USING GIN (skills);

-- =========================
-- Applications & Attempts
-- =========================
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_uri TEXT,
  resume_blob BYTEA,
  status TEXT NOT NULL CHECK (status IN (
    'SUBMITTED','R1_PASSED','R1_FAILED','R2_PASSED','R2_FAILED','R3_PASSED','R3_FAILED','SCHEDULED','REJECTED','SELECTED'
  )) DEFAULT 'SUBMITTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT applications_resume_present CHECK (resume_uri IS NOT NULL OR resume_blob IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications (user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications (job_id);

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  round TEXT NOT NULL CHECK (round IN ('R1','R2','R3')),
  attempt_no INT NOT NULL DEFAULT 1,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_attempt_per_round UNIQUE (application_id, round, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_attempts_app ON attempts (application_id);
CREATE INDEX IF NOT EXISTS idx_attempts_app_round ON attempts (application_id, round);

-- =========================
-- Round Scores
-- =========================
CREATE TABLE IF NOT EXISTS round_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  round TEXT NOT NULL CHECK (round IN ('R1','R2','R3')),
  kw_score DOUBLE PRECISION,
  resume_score DOUBLE PRECISION,
  final_score DOUBLE PRECISION NOT NULL,
  passed BOOLEAN NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_round_scores_app ON round_scores (application_id);
CREATE INDEX IF NOT EXISTS idx_round_scores_app_round ON round_scores (application_id, round);

-- =========================
-- Assessments (R2) & Answers
-- =========================
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  questions JSONB NOT NULL, -- array of 30 MCQs with choices and correct answers
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('GENERATED','COMPLETED')) DEFAULT 'GENERATED'
);

CREATE INDEX IF NOT EXISTS idx_assessments_app ON assessments (application_id);
CREATE INDEX IF NOT EXISTS idx_assessments_questions_gin ON assessments USING GIN (questions);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  selected TEXT NOT NULL, -- "A"/"B"/"C"/"D"
  correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_answer_per_question UNIQUE (assessment_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_assessment ON answers (assessment_id);

-- =========================
-- Interview (R3): Questions & Transcripts
-- =========================
CREATE TABLE IF NOT EXISTS interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  seq_no INT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TECH','HR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_interview_question_seq UNIQUE (application_id, seq_no)
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_app ON interview_questions (application_id);

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question_id UUID REFERENCES interview_questions(id) ON DELETE SET NULL,
  text TEXT,
  audio_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transcripts_content_present CHECK (text IS NOT NULL OR audio_uri IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_transcripts_app ON transcripts (application_id);

-- =========================
-- Interviewer Profiles & Scheduling
-- =========================
CREATE TABLE IF NOT EXISTS interviewer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  seniority TEXT,
  availability JSONB, -- optional structure for slots
  es_doc_id TEXT, -- ES index doc id reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interviewer_profiles_skills ON interviewer_profiles USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_interviewer_profiles_availability_gin ON interviewer_profiles USING GIN (availability);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES interviewer_profiles(id) ON DELETE CASCADE,
  slot_ts TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_interviewer_slot UNIQUE (interviewer_id, slot_ts)
);

CREATE INDEX IF NOT EXISTS idx_schedules_app ON schedules (application_id);
CREATE INDEX IF NOT EXISTS idx_schedules_interviewer ON schedules (interviewer_id);

-- =========================
-- Audit Logs
-- =========================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);

-- =========================
-- Helpful Views (Optional)
-- =========================
-- Example: latest round score per application/round
CREATE OR REPLACE VIEW v_latest_round_scores AS
SELECT DISTINCT ON (application_id, round)
  application_id, round, kw_score, resume_score, final_score, passed, threshold, created_at
FROM round_scores
ORDER BY application_id, round, created_at DESC;

-- =========================
-- Seed Roles (Optional)
-- =========================
-- -- Example seed (do not enable by default)
-- INSERT INTO users (username, email, password_hash, role)
-- VALUES ('admin', 'admin@example.com', '$2a$10$examplehash', 'ADMIN')
-- ON CONFLICT (username) DO NOTHING;

-- END OF SCHEMA
