# End-to-End Recruiting AI (MVP) — Master Prompt

You are a **principal enterprise solution architect** designing an **MVP end-to-end Recruiting AI** system.  
Your output must be **practical, implementation-oriented, and structured**. Keep infrastructure simple (MVP). Avoid load balancers / complex HA unless explicitly necessary.

---

## 0) Assumptions (must list explicitly)
Before you start, list any assumptions you need (e.g., single-tenant vs multi-tenant, auth choice, deployment target, transcript provider, etc.).

---

## 1) Context (System Overview)
We are building an end-to-end recruiting workflow:

1. **Login + Application + Resume Upload**
   - User logs in from the UI, sees a couple of job applications with job descriptions.
   - User chooses one, uploads a resume.
   - Resume + application metadata are logged in a **SQL DB** for tracking counts over time (thresholds), multiple applications, attempts, etc.

2. **Round 1: Resume Screening**
   - An agent analyzes resume quality against the job description.
   - A keyword matching algorithm also runs.
   - Final score = **weighted normalized average** of both scores.
   - If score > **80**, candidate is a fit and proceeds to Round 2.
   - Store score + attempt metadata in SQL DB.

3. **Round 2: Online Assessment**
   - Analyze resume to identify **top 5 skills** relevant to the job description.
   - Use a knowledge base of documentation across multiple skills stored in **ElasticSearch** (e.g., k8s, docker docs).
   - A **Problem Setter agent** generates a set of **30 multiple choice questions** shown to the user.
   - Candidate answers; score computed.
   - If score > **85**, proceed to next round.
   - Store evaluation data in SQL DB to prevent multiple attempts.

4. **Round 3: AI Virtual Interview**
   - A set of technical questions (deep domain understanding) + HR questions.
   - A **question setter agent** and **critic agent** iterate: critic reviews question depth; setter revises.
   - Questions shown one-by-one.
   - Candidate answers captured via voice, transcribed into text.
   - At end: feed transcription to an **evaluator agent**; a **critic** judges evaluator’s judgment.

5. **Final Decision + Human Interview Scheduling**
   - Select or reject.
   - If selected: use semantic search (job description + resume + interviewer profiles) to pick best interviewer.
   - Schedule meeting at a later time.

---

## 2) Mandatory Tech Stack (must be used)
- ElasticSearch (**mandatory**)
- Elastic Agent Builder (**mandatory**)
- SQL DB
- React (frontend)
- Java + Spring (backend)
- Docker/containerization (hosting)
- JUnit (backend unit testing)
- Jest (frontend testing)

---

## 3) What you must produce (in this exact order)

### 3.1 End-to-end workflow flowchart
- Produce a full workflow diagram as a **Mermaid flowchart**.
- Must include: UI, backend services, SQL DB, ElasticSearch, agent interactions, scoring gates, and audit/event logging points.

### 3.2 HLD (High-Level Design)
Include:
- Architecture style (services/modules)
- Main components and responsibilities
- End-to-end data flow: UI ⇄ backend ⇄ Elastic ⇄ SQL ⇄ LLM/agents
- Identity/auth approach for MVP
- Logging/monitoring approach for MVP
- Key non-functional requirements: privacy, security, fairness, reliability (MVP-appropriate)

### 3.3 LLD (Low-Level Design)
Include:
- Detailed module breakdown for **Java/Spring** and **React** (packages/components/classes at a “good LLD” level)
- Key REST APIs: endpoints, auth, request/response JSON examples
- SQL schema proposal: tables + key columns for:
  - users
  - jobs
  - applications
  - attempts
  - round scores
  - assessments & answers
  - interview questions
  - transcripts
  - interviewer profiles
  - scheduling records
  - audit logs
- ElasticSearch design:
  - Index names
  - Mappings (text + vector)
  - Fields for KB docs, job descriptions, resumes (or resume-derived chunks), interviewer profiles
  - Query examples (BM25 + vector + hybrid)
- Agent/tool contracts:
  - For each agent, list allowed tools and tool I/O contracts (e.g., search, persistence, scoring, question generation, evaluation, transcription interface)
- Deterministic scoring approach:
  - How the weighted normalized score is computed
  - Threshold handling and “no retake” enforcement logic

### 3.4 Tech stack mapping
For each tech, explain where it is used and why:
- ElasticSearch vs SQL division of responsibilities
- Elastic Agent Builder role in orchestration
- Spring service boundaries
- React page/component structure
- Docker usage (compose, env vars, local dev)

### 3.5 Deployment plan (preferably free/low-cost)
Must include:
- Local/dev setup using **Docker Compose**
- A free-tier-friendly cloud option (keep it realistic for MVP)
- CI basics (build + test)
- Secrets handling approach (don’t hardcode; use env vars/secret store)
- Minimal logging/monitoring approach

### 3.6 Plan to use free/small LLM APIs (multi-agent friendly)
Include:
- Options: local small models vs free hosted endpoints
- Cost/latency controls: caching, rate limiting, batching, prompt/token limits
- Safety controls: PII handling, data minimization, redaction strategies, retention limits
- Prompt injection mitigations (resume/JD content is untrusted)
- Grounding approach using Elastic retrieval to reduce hallucinations

---

## 4) Non-functional constraints (must respect)
- Recruiting system handles sensitive personal data (resumes + transcripts).
- Include MVP-appropriate controls:
  - encryption in transit and at rest
  - role-based access control
  - audit logging
  - minimal retention
- Fairness/compliance:
  - Avoid using protected attributes (directly or indirectly)
  - Document decision criteria and ensure a path for human review/override
- Security:
  - Treat resume/JD as **untrusted input**
  - Include mitigations against prompt injection and data exfiltration via LLM

---

## 5) Output formatting rules
- Use headings and numbered sections matching **Section 3** exactly.
- Mermaid flowchart must be in a fenced code block.
- Be concrete: provide tables, endpoint paths, example JSON, index names, etc.
- Keep it MVP-focused; avoid overengineering.
- If you need to make assumptions, list them in Section 0 and proceed.

---

## 6) Generate the deliverable
Now generate the full deliverable.