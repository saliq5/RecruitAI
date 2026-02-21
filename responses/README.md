RecruitAI Responses Package

Overview
This folder contains the complete, implementation-oriented deliverables for the End-to-End Recruiting AI (MVP) per the architect prompt. It includes a consolidated master document and modular artifacts ready for local spin-up and reference.

Contents
- deliverable.md — Consolidated Sections 0–6 (assumptions, flowchart, HLD, LLD, tech mapping, deployment, LLM plan)
- 01-flowchart.mmd — Mermaid flowchart only (same as in deliverable.md)
- 02-hld.md — High-Level Design (Section 3.2)
- 03-lld.md — Low-Level Design (Section 3.3)
- 04-tech-stack-mapping.md — Tech stack mapping (Section 3.4)
- 05-deployment-plan.md — Deployment plan (Section 3.5)
- 06-llm-multi-agent-plan.md — Plan for free/small LLMs (Section 3.6)
- api-spec.yaml — OpenAPI 3.0 spec for backend API
- sql-schema.sql — PostgreSQL DDL for all required tables and a helper view
- elasticsearch-mappings.json — Per-index settings/mappings and example queries (kb_docs, job_descriptions, resumes, interviewer_profiles)
- docker-compose.yml — Local/dev stack (Postgres, Elasticsearch, Kibana, backend stub, frontend stub)
- .env.example — Example environment variables for local/dev
- README.md — This document

Quick start (local/dev via Docker Compose)
1) Prerequisites
- Docker Desktop (or Docker Engine + docker compose plugin)
- Optional: Java 21+ and Node 18+ if you run backend/frontend locally instead of containers

2) Configure environment
- Copy env file and (optionally) edit values:
  cp RecruitAI/responses/.env.example RecruitAI/responses/.env

3) Start the stack
- From the project root (or this folder), run:
  docker compose -f RecruitAI/responses/docker-compose.yml up -d

4) Verify services
- PostgreSQL: port 5432 (compose healthcheck will wait)
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601
- Backend (stub image reference): http://localhost:8080/actuator/health
- Frontend (stub image reference): http://localhost:3000

5) Initialize database
- The sql-schema.sql is automatically mounted and applied on first Postgres start via /docker-entrypoint-initdb.d.
- To reinitialize, bring the stack down and remove volumes:
  docker compose -f RecruitAI/responses/docker-compose.yml down -v
  docker compose -f RecruitAI/responses/docker-compose.yml up -d

6) Create Elasticsearch indices and mappings
- Use Kibana Dev Tools (http://localhost:5601 → Dev Tools) or curl. Examples:

- kb_docs (apply mapping)
  PUT kb_docs
  { "settings": { "number_of_shards": 1, "number_of_replicas": 0 }, "mappings": { "dynamic": "strict", "properties": { "id": { "type": "keyword" }, "title": { "type": "text" }, "source": { "type": "keyword" }, "content": { "type": "text" }, "tags": { "type": "keyword" }, "updated_at": { "type": "date" }, "embedding": { "type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine" } } } }

- job_descriptions
  PUT job_descriptions
  { "settings": { "number_of_shards": 1, "number_of_replicas": 0 }, "mappings": { "dynamic": "strict", "properties": { "id": { "type": "keyword" }, "job_id": { "type": "keyword" }, "title": { "type": "text" }, "description": { "type": "text" }, "skills": { "type": "keyword" }, "embedding": { "type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine" } } } }

- resumes
  PUT resumes
  { "settings": { "number_of_shards": 1, "number_of_replicas": 0 }, "mappings": { "dynamic": "strict", "properties": { "id": { "type": "keyword" }, "application_id": { "type": "keyword" }, "text_content": { "type": "text" }, "sections": { "type": "object", "properties": { "summary": { "type": "text" }, "experience": { "type": "text" }, "education": { "type": "text" }, "skills": { "type": "text" } } }, "skills": { "type": "keyword" }, "embedding": { "type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine" } } } }

- interviewer_profiles
  PUT interviewer_profiles
  { "settings": { "number_of_shards": 1, "number_of_replicas": 0 }, "mappings": { "dynamic": "strict", "properties": { "id": { "type": "keyword" }, "profile_id": { "type": "keyword" }, "name": { "type": "text" }, "skills": { "type": "keyword" }, "past_interviews": { "type": "integer" }, "embedding": { "type": "dense_vector", "dims": 768, "index": true, "similarity": "cosine" } } } }

- See elasticsearch-mappings.json for formatted payloads and example queries (BM25, vector, hybrid).

API usage
- Import api-spec.yaml into your API client (Insomnia/Postman, Redocly, Swagger UI) to explore endpoints:
  - Auth: /auth/login, /auth/refresh
  - Jobs: /jobs, /jobs/{id}
  - Applications: /applications (multipart), /applications/{id}
  - Screening (R1): /screening/{applicationId}/run, /screening/{applicationId}
  - Assessment (R2): /assessments/{applicationId}/generate, /assessments/{assessmentId}, /assessments/{assessmentId}/answers
  - Interview (R3): /interview/{applicationId}/next-question, /answer, /finalize
  - Scheduling: /interviewers/search, /schedule
  - Audit: /audits

Security and environment notes (MVP)
- Local ES security is disabled in compose for simplicity; keep it enabled in cloud (set ELASTIC_API_KEY or ES_USER/ES_PASS).
- JWT secret in .env.example is for dev only; change and rotate regularly.
- Do not commit real secrets; use .env locally and platform secret stores in cloud.

Deterministic scoring thresholds
- Round 1: final_r1 = 0.6 * resume_score_norm + 0.4 * keyword_score_norm; pass if ≥ 0.80
- Round 2: score = correct / total; pass if ≥ 0.85
- Round 3: evaluator rubric (0..1), with critic checks; decision recorded with threshold and rationale

Next steps for implementation
- Backend (Spring Boot): Implement controllers/services per api-spec.yaml and 03-lld.md, add JUnit tests.
- Frontend (React): Implement pages/components per 03-lld.md, add Jest/RTL tests.
- Agents: Wire Elastic Agent Builder with tool contracts; use ES hybrid retrieval for grounding as described in 06-llm-multi-agent-plan.md.
- DevOps: Use docker-compose for local; consider CI from 05-deployment-plan.md (Maven + Node jobs).

Troubleshooting
- Low memory: Lower ES_JAVA_OPTS in .env, or stop Kibana.
- Port conflicts: Change published ports in docker-compose.yml.
- ES index errors: Ensure you created indices before indexing docs; verify mappings match payloads.
