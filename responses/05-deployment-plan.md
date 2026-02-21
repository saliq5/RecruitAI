3.5 Deployment plan (free/low-cost friendly)

Overview
- Goal: Spin up a complete MVP locally via Docker Compose with minimal dependencies and provide a realistic free-tier cloud path.
- Scope: Postgres (SQL DB), Elasticsearch + Kibana, Spring Boot backend, React frontend, optional Elastic Agent/log shipping.
- Principles: No hardcoded secrets; use env vars; minimal logging/monitoring; simple, reproducible setup.

Local/dev setup using Docker Compose
- Prereqs:
  - Docker Desktop or Docker Engine + docker-compose plugin
  - Node 18+ and Java 21+ (only if running frontend/backend locally instead of containers)
- Services (compose details provided in docker-compose.yml):
  - postgres:
    - Image: postgres:15-alpine
    - Env: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD (from .env)
    - Volumes: postgres-data:/var/lib/postgresql/data
    - Init: mounts sql-schema.sql to /docker-entrypoint-initdb.d for DDL on first run
    - Healthcheck: pg_isready
  - elasticsearch:
    - Image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    - Single-node dev mode: discovery.type=single-node
    - Security (local): xpack.security.enabled=false (for simplicity)
    - JVM heap: ES_JAVA_OPTS: -Xms1g -Xmx1g (tune down if needed)
    - Volumes: es-data:/usr/share/elasticsearch/data
    - Ports: 9200
  - kibana:
    - Image: docker.elastic.co/kibana/kibana:8.13.0
    - Env: ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    - Depends_on: elasticsearch
    - Ports: 5601
  - backend:
    - Image: ghcr.io/example/recruitai-backend:dev or build locally
    - Env: DB_URL, DB_USER, DB_PASSWORD, ELASTIC_URL, JWT_SECRET, LLM_PROVIDER, WHISPER_PATH
    - Depends_on: postgres, elasticsearch
    - Ports: 8080
    - Healthcheck: GET /actuator/health
  - frontend:
    - Image: ghcr.io/example/recruitai-frontend:dev or run npm dev locally
    - Env: VITE_API_BASE=http://localhost:8080/api
    - Ports: 3000
    - Depends_on: backend
- Bring-up commands:
  - cp RecruitAI/responses/.env.example RecruitAI/responses/.env (edit values)
  - docker compose -f RecruitAI/responses/docker-compose.yml up -d
  - Verify:
    - Postgres: psql or docker logs postgres
    - ES: curl http://localhost:9200
    - Kibana: http://localhost:5601
    - Backend: http://localhost:8080/actuator/health
    - Frontend: http://localhost:3000
- Local data management:
  - Volumes: postgres-data, es-data
  - Reset: docker compose down -v (removes data volumes)
- Seeding (optional):
  - Use sql-schema.sql for DDL and minimal seed.
  - Seed ES indices/mappings using elasticsearch-mappings.json via curl:
    - curl -X PUT "localhost:9200/kb_docs" -H 'Content-Type: application/json' --data-binary @elasticsearch-mappings.json (use the kb_docs sub-object)
    - Or leverage Kibana Dev Tools console to paste mappings.

Free-tier-friendly cloud option (MVP realistic)
- Backend:
  - Render (free web service with sleep) or Fly.io (low-cost) for a single containerized Spring Boot app.
  - Build image via GitHub Actions; push to GHCR; deploy by reference.
- Database:
  - Neon.tech (Postgres serverless free tier) or ElephantSQL free plan.
  - Set DB_URL to driver URL; enforce SSL (require).
- Elasticsearch:
  - Elastic Cloud (14-day trial) for testing or Bonsai (free starter tier with limits).
  - Update ELASTIC_URL and credentials (keep security enabled in cloud).
- Frontend:
  - Vercel or Netlify for React static hosting; configure VITE_API_BASE to backend URL.
- Object storage (for resumes/audio):
  - Cloud provider bucket (S3/OCI/Backblaze) free tier; store URIs in DB.

CI basics (build + test)
- GitHub Actions (example jobs)
  - Backend (Maven):
    - on: push PR
    - steps:
      - actions/checkout@v4
      - setup-java (temurin 21)
      - mvn -B -DskipITs=false verify
      - if main: build image and push to GHCR
  - Frontend (Node):
    - on: push PR
    - steps:
      - actions/checkout@v4
      - setup-node 18.x
      - npm ci
      - npm test -- --ci
      - npm run build
      - upload build artifact or deploy to Vercel
  - Example minimal workflow snippet:
    - .github/workflows/ci.yml:
      - name: CI
      - jobs:
        - backend:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v4
              - uses: actions/setup-java@v4
                with:
                  distribution: temurin
                  java-version: '21'
              - run: mvn -B verify
        - frontend:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v4
              - uses: actions/setup-node@v4
                with:
                  node-version: '18'
              - run: npm ci
              - run: npm test -- --ci
              - run: npm run build
- Testcontainers (optional):
  - For integration tests, spin ephemeral Postgres/Elasticsearch in CI (ensure CI runners support Docker).

Secrets handling approach
- Never hardcode secrets; use environment variables:
  - DB_USER, DB_PASSWORD, JWT_SECRET, ELASTIC_API_KEY or ES_USER/ES_PASS, LLM_API_KEY, STORAGE credentials
- Local dev:
  - .env.example → .env (gitignored). Document any required edits.
- CI:
  - GitHub Actions Secrets (masked); pass as env to build or as deployment secrets.
- Cloud:
  - Platform secret stores (Render/Fly/Netlify/Vercel secrets); rotate regularly.
- Key management:
  - JWT_SECRET rotation procedure documented; tokens short-lived; refresh tokens with revocation table (MVP optional).

Minimal logging/monitoring approach
- Logs:
  - Structured JSON to stdout; include correlation/request ID.
  - Do not log PII (resume text, transcripts). Mask emails/phones if logged for debugging.
- Health/metrics:
  - Spring Boot Actuator /actuator/health, /actuator/metrics (authenticated in cloud).
  - Uptime checks (platform pings or external).
- Optional (local only):
  - Elastic Agent/Filebeat sidecar to ship backend logs into Elasticsearch for Kibana dashboards.
- Alerts (MVP):
  - Simple email/webhook on CI failures; optional error rate thresholds using platform add-ons.

Operational safeguards (MVP)
- Resource caps:
  - Set JVM/Xms/Xmx for backend; limit ES heap locally; set compose resource constraints if needed.
- Backups:
  - Rely on managed DB snapshots (Neon/ElephantSQL); export DB periodically for free-tier.
- Availability:
  - Single instance per service (no LB/HA per prompt). Keep readiness checks; enable quick restart policies.
- Security:
  - Enforce HTTPS in cloud frontends/backends; secure cookies if using cookies; CORS set to known frontend origins.
  - Validate and scan uploaded files; restrict mime types; size limits; virus scanning optional for MVP.

Rollout strategy
- Local dev:
  - Feature branches → CI → manual compose up locally for verification.
- Cloud:
  - Auto-deploy from main with manual approval; maintain a staging environment if budget permits (optional).
- Data migrations:
  - Simple DDL managed via Flyway or Liquibase in backend; run on startup with guards.

Cost notes
- Keep ES on trial or the smallest plan; prefer local ES for day-to-day dev.
- Use local/edge LLMs to avoid token costs; hosted endpoints limited to small batch ops with caps.
- Avoid storing large blobs in DB; prefer object storage to control DB size on free tiers.
