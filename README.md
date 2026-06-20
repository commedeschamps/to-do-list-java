# Todo List

A production-grade, full-stack Todo List application featuring an Angular frontend and a Spring Boot backend. The application features a clean dark navy workspace with user-scoped tasks, priority boards, subtasks, projects, calendar and statistics views, and JWT-based authentication.

Live Demo: https://to-do-list-java.vercel.app

## Overview

Managing personal productivity requires a centralized, secure, and intuitive workspace. This Todo List application provides users with a comprehensive dashboard to organize their daily workflows. Users can categorize tasks by project, assign custom labels, break down activities into subtasks, schedule due dates, and track their progress through interactive visual charts. With drag-and-drop task prioritization and calendar views, it solves the challenge of scattered task management by offering a single, clean workspace tailored to the user's focus.

## Features

- JWT registration, login and persisted session.
- User-scoped task CRUD with `GET /api/tasks`, `GET /api/tasks/{id}`, create, update and delete.
- Optional task description, priority, due date, completion state, color, project and labels.
- Projects and labels are private to the authenticated user.
- Subtasks are scoped through the parent task.
- Calendar, priority board, search, filters, sorting and stats dashboard.
- AI Productivity Assistant: Today Planner, Risk Radar, Ask My Tasks, Auto Cleanup and Weekly Summary.
- AI providers are called only from the backend, with Gemini as primary, Groq as fallback and OpenRouter as backup.
- Flyway-managed PostgreSQL schema with Hibernate validation.

## Architecture

```text
Browser
  -> Angular SPA on Vercel
  -> Spring Boot REST API on Render
  -> PostgreSQL on Neon
```

- Frontend: Angular SPA, Angular Router, SCSS, FullCalendar, Chart.js/ng2-charts, Fuse.js.
- Backend: Spring Boot, Spring Security, JWT, DTO responses, Spring Data JPA.
- Database: PostgreSQL with Flyway migrations in `src/main/resources/db/migration`.
- Deployment: Vercel serves the frontend, Render runs the backend Docker service, Neon stores production data.

## Assignment Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| Angular frontend | Done | `src/app`, `angular.json` |
| Spring Boot backend | Done | `src/main/java/com/example/todolist` |
| PostgreSQL | Done | PostgreSQL driver and Flyway migrations |
| JWT auth | Done | `/api/auth/register`, `/api/auth/login`, `/api/auth/me` |
| Task CRUD | Done | `GET/POST/PUT/DELETE /api/tasks` |
| `GET /api/tasks/{id}` | Done | `TaskController#getById` |
| Task has `id`, `title`, `description`, `completed`, `createdAt` | Done | `TaskResponse` |
| Description optional | Done | blank or missing description is stored as `null` |
| Validation and errors | Done | Bean Validation and `ApiExceptionHandler` |
| DTO responses | Done | `TaskResponse`, `ProjectResponse`, `LabelResponse`, `SubtaskResponse` |
| Ownership checks | Done | repository methods filter by authenticated username |
| Flyway migrations | Done | `V1` through `V5` migration scripts |
| `ddl-auto=validate` | Done | `src/main/resources/application.properties` |
| Production deployment | Done | Vercel + Render + Neon |
| Optional AI assistant | Done | `/api/ai/*` backend endpoints and AI blocks on `/today`, `/tasks`, `/stats` |

## API Overview

Protected endpoints require:

```text
Authorization: Bearer <jwt>
```

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/tasks
GET    /api/tasks/{id}
POST   /api/tasks
PUT    /api/tasks/{id}
DELETE /api/tasks/{id}

GET    /api/projects
POST   /api/projects
PUT    /api/projects/{id}
DELETE /api/projects/{id}

GET    /api/labels
POST   /api/labels
PUT    /api/labels/{id}
DELETE /api/labels/{id}

GET    /api/tasks/{taskId}/subtasks
POST   /api/tasks/{taskId}/subtasks
PATCH  /api/tasks/{taskId}/subtasks/{subtaskId}
DELETE /api/tasks/{taskId}/subtasks/{subtaskId}

GET    /api/ai/status
POST   /api/ai/today-plan
POST   /api/ai/risk-radar
POST   /api/ai/ask-tasks
POST   /api/ai/auto-cleanup
POST   /api/ai/weekly-summary
```

## Local Run

Prerequisites:

- Java 17+
- Node.js 20+
- npm
- PostgreSQL

Create a local database and copy the safe example file:

```bash
cp .env.example .env
```

Export the variables from `.env` in your shell or configure them in your IDE. The backend reads environment variables directly.

Run backend:

```bash
./gradlew bootRun
```

Run frontend:

```bash
npm install
npm start
```

Local URLs:

```text
Frontend: http://localhost:4200
Backend:  http://localhost:8080
```

Validation commands:

```bash
npm run build
./gradlew test
```

## Deployment

### Frontend: Vercel

- Build command: `npm run build`
- Output directory: `dist/todo-list-frontend`
- SPA refresh support is configured in `vercel.json`.
- Production API URL is configured in `src/environments/environment.prod.ts`.

### Backend: Render

- Runtime: Docker
- Dockerfile: `Dockerfile.backend`
- Required environment variables:

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<database>?sslmode=require
SPRING_DATASOURCE_USERNAME=<database-user>
SPRING_DATASOURCE_PASSWORD=<database-password>
JWT_SECRET=<long-random-secret>
CORS_ALLOWED_ORIGINS=http://localhost:4200,https://to-do-list-java.vercel.app,https://todo.commedeschamps.dev

AI_ENABLED=false

AI_PRIMARY_PROVIDER=gemini
AI_PRIMARY_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_PRIMARY_MODEL=gemini-2.5-flash
AI_PRIMARY_API_KEY=<gemini-provider-token>

AI_FALLBACK_ENABLED=true
AI_FALLBACK_PROVIDER=groq
AI_FALLBACK_BASE_URL=https://api.groq.com/openai/v1
AI_FALLBACK_MODEL=llama-3.1-8b-instant
AI_FALLBACK_API_KEY=<groq-provider-token>

AI_BACKUP_ENABLED=true
AI_BACKUP_PROVIDER=openrouter
AI_BACKUP_BASE_URL=https://openrouter.ai/api/v1
AI_BACKUP_MODEL=openrouter/free
AI_BACKUP_API_KEY=<openrouter-provider-token>
```

AI features are optional and require backend environment variables. If AI is disabled or no provider key is configured, the core task manager continues to work normally and AI blocks show a disabled state.

Provider order:

```text
Primary: Gemini
Fallback: Groq
Backup: OpenRouter
```

### Database: Neon

- PostgreSQL database.
- Flyway applies schema migrations on backend startup.
- Hibernate uses `spring.jpa.hibernate.ddl-auto=validate`.

## Security Notes

- `.env` and `.env.*` are ignored by Git.
- `.env.example` contains placeholders only.
- JWT secret is read from `JWT_SECRET`.
- AI provider keys are read only by the backend from `AI_PRIMARY_API_KEY`, `AI_FALLBACK_API_KEY` and `AI_BACKUP_API_KEY`; they are never stored in the Angular bundle.
- Allowed CORS origins for submission:

```text
http://localhost:4200
https://to-do-list-java.vercel.app
https://todo.commedeschamps.dev
```

- Tokens are sent in the `Authorization` header by the Angular HTTP interceptor, not in URLs.
- AI endpoints require JWT and build task context only from the authenticated user's tasks. The frontend never sends `userId`.
