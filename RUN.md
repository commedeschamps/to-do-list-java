# Запуск проекта

## Требования

- Java 17+
- Node.js 18+
- npm
- Gradle wrapper уже включен в проект

## 1. Остановить старые процессы

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:4200 -sTCP:LISTEN
kill <PID>
```

## 2. Запуск backend

```bash
./gradlew bootRun
```

Backend будет доступен:

```text
http://localhost:8080
```

## 3. Запуск frontend

Во втором терминале:

```bash
npm install
npm start
```

Frontend будет доступен:

```text
http://localhost:4200
```

## 4. Проверка

Открыть:

```text
http://localhost:4200
```

Проверить регистрацию, вход и страницу задач.

## Частые проблемы

### Port 8080 already in use

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
kill <PID>
```

### Port 4200 already in use

```bash
lsof -nP -iTCP:4200 -sTCP:LISTEN
kill <PID>
```

### CORS error

Убедиться, что frontend открыт с:

```text
http://localhost:4200
```

а backend слушает:

```text
http://localhost:8080
```

### Angular compiled with problems

Очистить cache:

```bash
rm -rf .angular/cache
npm run build
```
