# Todo List

A production-grade, full-stack Todo List application featuring an Angular frontend and a Spring Boot backend. The application features a clean dark navy workspace with user-scoped tasks, priority boards, subtasks, projects, calendar and statistics views, and JWT-based authentication.

Live Demo: [todo.commedeschamps.dev](https://todo.commedeschamps.dev/)

## Overview

Managing personal productivity requires a centralized, secure, and intuitive workspace. This Todo List application provides users with a comprehensive dashboard to organize their daily workflows. Users can categorize tasks by project, assign custom labels, break down activities into subtasks, schedule due dates, and track their progress through interactive visual charts. With drag-and-drop task prioritization and calendar views, it solves the challenge of scattered task management by offering a single, clean workspace tailored to the user's focus.

## Features

- **JWT Authentication**: Secure user registration, login, and session persistence.
- **User-Scoped Tasks**: Completely isolated data workspaces where users can only view and manage their own resources.
- **Task CRUD**: Intuitive modals and inline editing for quick task modifications, with confirm dialogs for deletions.
- **Optional Descriptions**: Enrich tasks with detailed descriptions and notes.
- **Due Dates**: Organize tasks by deadlines to ensure timely completion.
- **Calendar View**: Interactive FullCalendar integration to visualize task timelines monthly or weekly.
- **Priority Board**: Drag-and-drop priority board using Angular CDK to easily organize tasks by urgency.
- **Subtasks & Checklists**: Deconstruct larger tasks into smaller, manageable subtasks with completion tracking.
- **Projects & Folders**: Group related tasks into distinct projects for organized categorization.
- **Labels & Tags**: Assign customizable labels to quickly filter and organize tasks.
- **Task Colors**: Highlight tasks with specific color codes to differentiate priorities or categories.
- **Search, Filters, and Sorting**: Real-time fuzzy search powered by Fuse.js alongside sorting and filtering by status, priority, and date.
- **Statistics Dashboard**: Visual overview of task distribution, completion rates, and progress bars using Chart.js/ng2-charts.
- **User Settings**: Customization settings for user profiles.

## Tech Stack

### Frontend
- **Angular**: Framework for building the modern Single Page Application (SPA).
- **TypeScript**: Typed programming language for frontend logic.
- **SCSS**: Modular, structured styling defining custom dark navy design tokens and UI components.
- **FullCalendar**: Dynamic interactive calendar to schedule and visualize tasks.
- **Chart.js & ng2-charts**: Visual reports, metrics, and task completion statistics.
- **Fuse.js**: Client-side fuzzy search for fast task queries.
- **Angular CDK DragDrop**: Smooth drag-and-drop interaction for reordering task priorities.

### Backend
- **Java**: Core programming language for the backend.
- **Spring Boot**: RESTful microservice framework.
- **Spring Security**: Robust authentication and route protection.
- **JWT (JSON Web Token)**: Stateless authentication mechanism.
- **Spring Data JPA & Hibernate**: Object-relational mapping (ORM) and data access.
- **Flyway**: Database schema migration management.

### Database
- **PostgreSQL**: Robust open-source relational database.
- **Neon PostgreSQL**: Serverless PostgreSQL database utilized in production.

### Deployment
- **Frontend**: Vercel (SPA routing configured via `vercel.json` to handle Angular path matching).
- **Backend**: Render (deployed as a Docker container service via `Dockerfile.backend`).
- **Database**: Neon (managed cloud PostgreSQL database).

## Architecture

The application utilizes a decoupled client-server architecture deployed entirely on cloud-native platforms:

- **Vercel** serves the Angular Single Page Application (SPA), ensuring low-latency delivery. All client-side routes are rewritten to `index.html` via `vercel.json` to support direct deep linking.
- **Render** runs the Spring Boot backend inside a lightweight Eclipse Temurin JVM Docker container, handling business logic, authentication, and database access.
- **Neon** hosts the serverless PostgreSQL database instance.
- **Flyway** executes automated migration scripts on backend startup to ensure database schemas match the codebase state.

```text
User
  ↓
Vercel Angular Frontend
  ↓ REST API (JWT Authenticated)
Render Spring Boot Backend (Docker Container)
  ↓ JDBC (SSL Required)
Neon PostgreSQL
```

## Authentication and Security

- Users register and log in to obtain a JSON Web Token (JWT).
- All protected API routes require the client to include the token in the `Authorization: Bearer <token>` request header.
- Tasks, subtasks, projects, and labels are mapped to the authenticated user ID at the database and application levels, preventing unauthorized cross-user access.
- Sensitive credentials, database connection strings, and the JWT secret key are managed via environment variables and never committed to source control.
- CORS (Cross-Origin Resource Sharing) is configured explicitly, permitting access only from the local frontend environment (`http://localhost:4200`) and the specific production Vercel domain.

## Database and Migrations

- **PostgreSQL** serves as the primary relational database.
- **Flyway** manages database version control and migration tracking. Migration scripts are applied sequentially on backend startup. The migration history includes:
  - `V1__initial_schema.sql` - Core database tables (users, tasks).
  - `V2__add_task_dates.sql` - Adding start date and due date fields to tasks.
  - `V3__add_subtasks.sql` - Introducing checklists and nested subtasks.
  - `V4__add_projects.sql` - Adding support for task grouping into projects.
  - `V5__add_labels.sql` - Support for tagging tasks with custom labels.
- **Hibernate** operates in `validate` mode (`ddl-auto=validate`), ensuring that the Java entities perfectly match the database schema defined by Flyway.

## Local Development

### Prerequisites

Ensure you have the following installed:
- Java 17 or higher
- Node.js 20 or higher
- PostgreSQL
- Gradle wrapper (included in the project)

### Environment Variables

Configure your environment variables. You can create a `.env` file in the project root folder:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/tododb
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
JWT_SECRET=change_me_to_a_long_random_secret
CORS_ALLOWED_ORIGINS=http://localhost:4200
```

### Backend Setup

To run the Spring Boot backend locally:

```bash
./gradlew bootRun
```

The backend service will be available at:

```text
http://localhost:8080
```

### Frontend Setup

To install dependencies and start the Angular frontend application:

```bash
npm install
npm start
```

The frontend application will run locally at:

```text
http://localhost:4200
```

## Production Deployment

### Frontend - Vercel

- **Build Command**: `npm run build`
- **Output Directory**: `dist/todo-list-frontend`
- The production environment config (`src/environments/environment.prod.ts`) points the `apiUrl` to the production backend on Render.
- Routing is managed via `vercel.json` to direct all path requests back to `/index.html` for client-side routing resolution.

### Backend - Render

- Deployed as a web service using Docker runtime.
- **Dockerfile**: `Dockerfile.backend`
- The following environment variables must be defined on Render:
  - `SPRING_DATASOURCE_URL` (PostgreSQL JDBC connection URL with `sslmode=require`)
  - `SPRING_DATASOURCE_USERNAME`
  - `SPRING_DATASOURCE_PASSWORD`
  - `JWT_SECRET`
  - `CORS_ALLOWED_ORIGINS` (containing the Vercel app domain)

### Database - Neon

- A cloud PostgreSQL instance hosted on Neon.
- The database connection JDBC URL must specify SSL requirement:
  ```text
  jdbc:postgresql://<host>/<database>?sslmode=require
  ```

## API Overview

Protected endpoints require a valid JWT header (`Authorization: Bearer <token>`).

### Authentication

```text
POST   /api/auth/register     - Register a new user account
POST   /api/auth/login        - Authenticate credentials and receive JWT
GET    /api/auth/me           - Retrieve current authenticated user profile
```

### Tasks

```text
GET    /api/tasks             - Retrieve all tasks for the current user
POST   /api/tasks             - Create a new task
PUT    /api/tasks/{id}        - Update an existing task
DELETE /api/tasks/{id}        - Delete a task
```

### Subtasks

```text
GET    /api/tasks/{taskId}/subtasks             - Get all subtasks of a task
POST   /api/tasks/{taskId}/subtasks            - Add a new subtask to a task
PATCH  /api/tasks/{taskId}/subtasks/{subtaskId} - Update subtask status or content
DELETE /api/tasks/{taskId}/subtasks/{subtaskId} - Delete a subtask
```

### Projects

```text
GET    /api/projects          - Get all projects for the current user
POST   /api/projects          - Create a new project
PUT    /api/projects/{id}     - Update project name/details
DELETE /api/projects/{id}     - Delete a project and dissociate its tasks
```

### Labels

```text
GET    /api/labels            - Get all labels for the current user
POST   /api/labels            - Create a new label
PUT    /api/labels/{id}       - Update label name/color
DELETE /api/labels/{id}       - Delete a label
```
## Project Status

The project is deployed and functional. Further improvements may include UI polish, bundle optimization and additional dashboard insights.

## License

No license specified.
