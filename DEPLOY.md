# Deploy Without VPS

## Stack

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

## 1. Neon PostgreSQL

Create a Neon PostgreSQL database and copy the JDBC connection details.

Use a JDBC URL with SSL enabled:

```text
jdbc:postgresql://<neon-host>/<db>?sslmode=require
```

The backend reads database credentials only from environment variables:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<db>?sslmode=require
SPRING_DATASOURCE_USERNAME=<neon-user>
SPRING_DATASOURCE_PASSWORD=<neon-password>
```

Flyway is enabled and Hibernate uses `ddl-auto=validate`, so a fresh Neon database should be initialized by:

- `V1__initial_schema.sql`
- `V2__add_task_dates.sql`
- `V3__add_subtasks.sql`
- `V4__add_projects.sql`
- `V5__add_labels.sql`

## 2. Render Backend

Create a Render Web Service from the repository.

Recommended settings:

```text
Runtime: Java
Root directory: project root
Build command: ./gradlew clean bootJar
Start command: java -jar build/libs/<jar-name>.jar
```

If using Render Docker runtime, use:

```text
Dockerfile: Dockerfile.backend
```

Set these environment variables in Render:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<db>?sslmode=require
SPRING_DATASOURCE_USERNAME=<neon-user>
SPRING_DATASOURCE_PASSWORD=<neon-password>
JWT_SECRET=<long-random-secret>
CORS_ALLOWED_ORIGINS=https://<vercel-app>.vercel.app,http://localhost:4200
```

Render provides `PORT`; the backend uses:

```properties
server.port=${PORT:8080}
```

After deploy, check Render logs for Flyway migration and Hibernate validation.

## 3. Vercel Frontend

Angular production config is in:

```text
src/environments/environment.prod.ts
```

Before deploy, replace:

```ts
apiUrl: 'https://<render-backend-url>/api'
```

with the real Render backend URL.

Vercel settings:

```text
Framework: Angular
Build command: npm run build
Output directory: dist/todo-list-frontend
```

`vercel.json` rewrites all routes to `index.html`, so refresh works for Angular routes such as `/tasks`, `/calendar`, and `/stats`.

## 4. Local Checks

Run:

```bash
npm run build
./gradlew test
```

Check that the production bundle does not contain hardcoded `localhost:8080`.

## 5. Deploy Checklist

- Open the Vercel URL.
- Register a new account.
- Login.
- Create, edit, complete, and delete tasks.
- Create a project.
- Create a label.
- Add, complete, rename, and delete subtasks.
- Check `/calendar`.
- Check `/stats`.
- Refresh `/tasks`, `/calendar`, and `/stats`.
- Confirm there are no CORS errors in the browser console.
- Confirm data is stored in Neon.
- Confirm Render logs show successful Flyway migration and Hibernate validation.

## Production Notes

- Do not commit real `.env` files or secrets.
- Use a long random `JWT_SECRET`.
- Keep `CORS_ALLOWED_ORIGINS` restricted to the Vercel domain and local dev origin.
- Render free services can sleep after inactivity, so the first request may be slow.
- Neon free tier limits storage and compute; monitor usage for larger demos.
