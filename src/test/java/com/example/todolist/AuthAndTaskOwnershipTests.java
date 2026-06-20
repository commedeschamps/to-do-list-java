package com.example.todolist;

import com.example.todolist.dto.ApiErrorResponse;
import com.example.todolist.dto.AiStatusResponse;
import com.example.todolist.dto.AuthResponse;
import com.example.todolist.dto.CurrentUserResponse;
import com.example.todolist.entity.Task;
import com.example.todolist.repository.LabelRepository;
import com.example.todolist.repository.ProjectRepository;
import com.example.todolist.repository.SubtaskRepository;
import com.example.todolist.repository.TaskRepository;
import com.example.todolist.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthAndTaskOwnershipTests {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final LabelRepository labelRepository;
    private final SubtaskRepository subtaskRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Autowired
    AuthAndTaskOwnershipTests(
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectRepository projectRepository,
            LabelRepository labelRepository,
            SubtaskRepository subtaskRepository,
            ObjectMapper objectMapper
    ) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.labelRepository = labelRepository;
        this.subtaskRepository = subtaskRepository;
        this.objectMapper = objectMapper;
    }

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp() {
        subtaskRepository.deleteAll();
        taskRepository.deleteAll();
        labelRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void registerUniqueUserReturnsTokenAndCurrentUser() throws Exception {
        TestResponse<AuthResponse> response = post(
                "/api/auth/register",
                authPayload("alice123", "password1"),
                AuthResponse.class
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        assertThat(response.body().token()).isNotBlank();
        assertThat(response.body().user().id()).isNotNull();
        assertThat(response.body().user().username()).isEqualTo("alice123");
        assertThat(response.body().user().displayName()).isEqualTo("alice123");
        assertThat(userRepository.findByUsername("alice123").orElseThrow().getDisplayName()).isEqualTo("alice123");
    }

    @Test
    void registerDuplicateUsernameReturnsConflict() throws Exception {
        register("alice123", "password1");

        TestResponse<ApiErrorResponse> response = post(
                "/api/auth/register",
                authPayload("alice123", "password2"),
                ApiErrorResponse.class
        );

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).isNotNull();
        assertThat(response.body().message()).isEqualTo("Имя пользователя уже занято");
    }

    @Test
    void loginValidReturnsTokenAndInvalidLoginReturnsUnauthorized() throws Exception {
        register("alice123", "password1");

        TestResponse<AuthResponse> validResponse = post(
                "/api/auth/login",
                authPayload("alice123", "password1"),
                AuthResponse.class
        );

        assertThat(validResponse.is2xxSuccessful()).isTrue();
        assertThat(validResponse.body()).isNotNull();
        assertThat(validResponse.body().token()).isNotBlank();
        assertThat(validResponse.body().user().username()).isEqualTo("alice123");
        assertThat(validResponse.body().user().displayName()).isEqualTo("alice123");

        TestResponse<ApiErrorResponse> invalidResponse = post(
                "/api/auth/login",
                authPayload("alice123", "wrong-password"),
                ApiErrorResponse.class
        );

        assertThat(invalidResponse.statusCode()).isEqualTo(401);
        assertThat(invalidResponse.body()).isNotNull();
        assertThat(invalidResponse.body().message()).isEqualTo("Неверное имя пользователя или пароль");
    }

    @Test
    void meRequiresTokenAndReturnsCurrentUser() throws Exception {
        TestResponse<String> anonymousResponse = get("/api/auth/me", null, String.class);
        assertThat(anonymousResponse.statusCode()).isIn(401, 403);

        AuthSession alice = register("alice123", "password1");

        TestResponse<CurrentUserResponse> response = exchange(
                "/api/auth/me",
                HttpMethod.GET,
                alice.token(),
                null,
                CurrentUserResponse.class,
                new Object[0]
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        assertThat(response.body().id()).isEqualTo(alice.userId());
        assertThat(response.body().username()).isEqualTo("alice123");
        assertThat(response.body().displayName()).isEqualTo("alice123");
    }

    @Test
    void authenticatedUserCanUpdateOnlyOwnDisplayNameWithoutChangingLoginOrOwnership() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");
        long aliceTaskId = createTask(alice.token(), "Owned before profile update");

        Map<String, Object> profilePayload = new LinkedHashMap<>();
        profilePayload.put("displayName", "  Adam  ");
        profilePayload.put("username", "changed-login");
        profilePayload.put("userId", bob.userId());

        TestResponse<CurrentUserResponse> updateResponse = exchange(
                "/api/auth/me/profile",
                HttpMethod.PUT,
                alice.token(),
                profilePayload,
                CurrentUserResponse.class,
                new Object[0]
        );

        assertThat(updateResponse.is2xxSuccessful()).isTrue();
        assertThat(updateResponse.body()).isNotNull();
        assertThat(updateResponse.body().id()).isEqualTo(alice.userId());
        assertThat(updateResponse.body().username()).isEqualTo("alice123");
        assertThat(updateResponse.body().displayName()).isEqualTo("Adam");
        assertThat(userRepository.findByUsername("changed-login")).isEmpty();
        assertThat(userRepository.findByUsername("bob123").orElseThrow().getDisplayName()).isEqualTo("bob123");

        TestResponse<CurrentUserResponse> meResponse = exchange(
                "/api/auth/me",
                HttpMethod.GET,
                alice.token(),
                null,
                CurrentUserResponse.class,
                new Object[0]
        );
        assertThat(meResponse.body()).isNotNull();
        assertThat(meResponse.body().displayName()).isEqualTo("Adam");

        Task[] tasks = getTasks(alice.token());
        assertThat(tasks).extracting(Task::getId).containsExactly(aliceTaskId);

        TestResponse<AuthResponse> loginResponse = post(
                "/api/auth/login",
                authPayload("alice123", "password1"),
                AuthResponse.class
        );
        assertThat(loginResponse.is2xxSuccessful()).isTrue();
        assertThat(loginResponse.body().user().displayName()).isEqualTo("Adam");
    }

    @Test
    void profileUpdateRequiresTokenAndValidatesDisplayNameLength() throws Exception {
        TestResponse<String> anonymousResponse = exchange(
                "/api/auth/me/profile",
                HttpMethod.PUT,
                null,
                Map.of("displayName", "Adam"),
                String.class,
                new Object[0]
        );
        assertThat(anonymousResponse.statusCode()).isIn(401, 403);

        AuthSession alice = register("alice123", "password1");
        TestResponse<ApiErrorResponse> tooLongResponse = exchange(
                "/api/auth/me/profile",
                HttpMethod.PUT,
                alice.token(),
                Map.of("displayName", "a".repeat(81)),
                ApiErrorResponse.class,
                new Object[0]
        );
        assertThat(tooLongResponse.statusCode()).isEqualTo(400);
    }

    @Test
    void aiEndpointsRequireTokenAndReturnControlledUnavailableWhenDisabled() throws Exception {
        TestResponse<String> anonymousResponse = exchange(
                "/api/ai/today-plan",
                HttpMethod.POST,
                null,
                Map.of(),
                String.class,
                new Object[0]
        );
        assertThat(anonymousResponse.statusCode()).isIn(401, 403);

        AuthSession alice = register("alice123", "password1");

        TestResponse<AiStatusResponse> statusResponse = exchange(
                "/api/ai/status",
                HttpMethod.GET,
                alice.token(),
                null,
                AiStatusResponse.class,
                new Object[0]
        );
        assertThat(statusResponse.is2xxSuccessful()).isTrue();
        assertThat(statusResponse.body()).isNotNull();
        assertThat(statusResponse.body().enabled()).isFalse();

        TestResponse<ApiErrorResponse> disabledResponse = exchange(
                "/api/ai/today-plan",
                HttpMethod.POST,
                alice.token(),
                Map.of(),
                ApiErrorResponse.class,
                new Object[0]
        );
        assertThat(disabledResponse.statusCode()).isEqualTo(503);
        assertThat(disabledResponse.body()).isNotNull();
        assertThat(disabledResponse.body().message()).isEqualTo("AI-помощник временно недоступен. Попробуйте позже.");
    }

    @Test
    void tasksAreIsolatedByCurrentUser() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");

        long aliceTaskId = createTask(alice.token(), "Alice task");
        long bobTaskId = createTask(bob.token(), "Bob task");

        Task[] aliceTasks = getTasks(alice.token());
        assertThat(aliceTasks).hasSize(1);
        assertThat(aliceTasks[0].getId()).isEqualTo(aliceTaskId);
        assertThat(aliceTasks[0].getTitle()).isEqualTo("Alice task");

        Task[] bobTasks = getTasks(bob.token());
        assertThat(bobTasks).hasSize(1);
        assertThat(bobTasks[0].getId()).isEqualTo(bobTaskId);
        assertThat(bobTasks[0].getTitle()).isEqualTo("Bob task");
    }

    @Test
    void usersCannotUpdateOrDeleteOtherUsersTasks() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");
        long aliceTaskId = createTask(alice.token(), "Alice task");

        TestResponse<ApiErrorResponse> updateResponse = exchange(
                "/api/tasks/{id}",
                HttpMethod.PUT,
                bob.token(),
                taskPayload("Bob edit", "high", false),
                ApiErrorResponse.class,
                aliceTaskId
        );
        assertThat(updateResponse.statusCode()).isEqualTo(404);
        assertThat(updateResponse.body()).isNotNull();
        assertThat(updateResponse.body().message()).isEqualTo("Задача не найдена");

        TestResponse<ApiErrorResponse> deleteResponse = exchange(
                "/api/tasks/{id}",
                HttpMethod.DELETE,
                bob.token(),
                null,
                ApiErrorResponse.class,
                aliceTaskId
        );
        assertThat(deleteResponse.statusCode()).isEqualTo(404);
        assertThat(deleteResponse.body()).isNotNull();
        assertThat(deleteResponse.body().message()).isEqualTo("Задача не найдена");

        Task[] aliceTasks = getTasks(alice.token());
        assertThat(aliceTasks).hasSize(1);
        assertThat(aliceTasks[0].getId()).isEqualTo(aliceTaskId);
        assertThat(aliceTasks[0].getTitle()).isEqualTo("Alice task");
    }

    @Test
    void userCanReadOwnTaskByIdAndCannotReadAnotherUsersTask() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");
        long aliceTaskId = createTask(alice.token(), "Alice task");

        TestResponse<TaskApiResponse> aliceReadResponse = exchange(
                "/api/tasks/{id}",
                HttpMethod.GET,
                alice.token(),
                null,
                TaskApiResponse.class,
                aliceTaskId
        );
        assertThat(aliceReadResponse.is2xxSuccessful()).isTrue();
        assertThat(aliceReadResponse.body()).isNotNull();
        assertThat(aliceReadResponse.body().id()).isEqualTo(aliceTaskId);
        assertThat(aliceReadResponse.body().title()).isEqualTo("Alice task");
        assertThat(aliceReadResponse.body().description()).isEqualTo("Description for Alice task");

        TestResponse<ApiErrorResponse> bobReadResponse = exchange(
                "/api/tasks/{id}",
                HttpMethod.GET,
                bob.token(),
                null,
                ApiErrorResponse.class,
                aliceTaskId
        );
        assertThat(bobReadResponse.statusCode()).isEqualTo(404);
        assertThat(bobReadResponse.body()).isNotNull();
        assertThat(bobReadResponse.body().message()).isEqualTo("Задача не найдена");
    }

    @Test
    void taskDueDateIsSavedReturnedAndCanBeCleared() throws Exception {
        AuthSession alice = register("alice123", "password1");
        LocalDate dueDate = LocalDate.of(2026, 6, 11);

        TestResponse<Task> createResponse = exchange(
                "/api/tasks",
                HttpMethod.POST,
                alice.token(),
                taskPayload("Calendar task", "high", false, dueDate.toString()),
                Task.class,
                new Object[0]
        );

        assertThat(createResponse.is2xxSuccessful()).isTrue();
        assertThat(createResponse.body()).isNotNull();
        assertThat(createResponse.body().getDueDate()).isEqualTo(dueDate);
        assertThat(createResponse.body().getCreatedAt()).isNotNull();
        assertThat(createResponse.body().getUpdatedAt()).isNotNull();
        assertThat(createResponse.body().getCompletedAt()).isNull();

        Task[] tasks = getTasks(alice.token());
        assertThat(tasks).hasSize(1);
        assertThat(tasks[0].getDueDate()).isEqualTo(dueDate);

        TestResponse<Task> updateResponse = exchange(
                "/api/tasks/{id}",
                HttpMethod.PUT,
                alice.token(),
                taskPayload("Calendar task", "high", false, null),
                Task.class,
                createResponse.body().getId()
        );

        assertThat(updateResponse.is2xxSuccessful()).isTrue();
        assertThat(updateResponse.body()).isNotNull();
        assertThat(updateResponse.body().getDueDate()).isNull();

        Task[] updatedTasks = getTasks(alice.token());
        assertThat(updatedTasks).hasSize(1);
        assertThat(updatedTasks[0].getDueDate()).isNull();
    }

    @Test
    void taskCanBeCreatedWithoutDescription() throws Exception {
        AuthSession alice = register("alice123", "password1");

        TestResponse<Task> response = exchange(
                "/api/tasks",
                HttpMethod.POST,
                alice.token(),
                taskPayloadWithoutDescription("Task without description"),
                Task.class,
                new Object[0]
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        assertThat(response.body().getTitle()).isEqualTo("Task without description");
        assertThat(response.body().getDescription()).isNull();
    }

    @Test
    void subtasksAreScopedThroughParentTask() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");
        long aliceTaskId = createTask(alice.token(), "Alice task");

        SubtaskApiResponse subtask = createSubtask(alice.token(), aliceTaskId, "First step");
        assertThat(subtask.title()).isEqualTo("First step");
        assertThat(subtask.completed()).isFalse();

        TestResponse<SubtaskApiResponse> toggleResponse = exchange(
                "/api/tasks/{taskId}/subtasks/{subtaskId}",
                HttpMethod.PATCH,
                alice.token(),
                subtaskPayload(null, true),
                SubtaskApiResponse.class,
                aliceTaskId,
                subtask.id()
        );
        assertThat(toggleResponse.is2xxSuccessful()).isTrue();
        assertThat(toggleResponse.body()).isNotNull();
        assertThat(toggleResponse.body().completed()).isTrue();

        TestResponse<SubtaskApiResponse[]> listResponse = exchange(
                "/api/tasks/{taskId}/subtasks",
                HttpMethod.GET,
                alice.token(),
                null,
                SubtaskApiResponse[].class,
                aliceTaskId
        );
        assertThat(listResponse.is2xxSuccessful()).isTrue();
        assertThat(listResponse.body()).hasSize(1);

        TestResponse<ApiErrorResponse> bobReadResponse = exchange(
                "/api/tasks/{taskId}/subtasks",
                HttpMethod.GET,
                bob.token(),
                null,
                ApiErrorResponse.class,
                aliceTaskId
        );
        assertThat(bobReadResponse.statusCode()).isEqualTo(404);

        TestResponse<ApiErrorResponse> bobUpdateResponse = exchange(
                "/api/tasks/{taskId}/subtasks/{subtaskId}",
                HttpMethod.PATCH,
                bob.token(),
                subtaskPayload("Bob edit", true),
                ApiErrorResponse.class,
                aliceTaskId,
                subtask.id()
        );
        assertThat(bobUpdateResponse.statusCode()).isEqualTo(404);

        TestResponse<ApiErrorResponse> bobDeleteResponse = exchange(
                "/api/tasks/{taskId}/subtasks/{subtaskId}",
                HttpMethod.DELETE,
                bob.token(),
                null,
                ApiErrorResponse.class,
                aliceTaskId,
                subtask.id()
        );
        assertThat(bobDeleteResponse.statusCode()).isEqualTo(404);

        TestResponse<String> deleteResponse = exchange(
                "/api/tasks/{taskId}/subtasks/{subtaskId}",
                HttpMethod.DELETE,
                alice.token(),
                null,
                String.class,
                aliceTaskId,
                subtask.id()
        );
        assertThat(deleteResponse.is2xxSuccessful()).isTrue();

        TestResponse<SubtaskApiResponse[]> emptyListResponse = exchange(
                "/api/tasks/{taskId}/subtasks",
                HttpMethod.GET,
                alice.token(),
                null,
                SubtaskApiResponse[].class,
                aliceTaskId
        );
        assertThat(emptyListResponse.body()).isEmpty();
    }

    @Test
    void projectsAreUserScopedAndDeletingProjectKeepsTasks() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");

        ProjectApiResponse project = createProject(alice.token(), "Учёба", "#3B82F6");
        assertThat(project.name()).isEqualTo("Учёба");

        TestResponse<ProjectApiResponse[]> bobProjects = exchange(
                "/api/projects",
                HttpMethod.GET,
                bob.token(),
                null,
                ProjectApiResponse[].class,
                new Object[0]
        );
        assertThat(bobProjects.is2xxSuccessful()).isTrue();
        assertThat(bobProjects.body()).isEmpty();

        TestResponse<TaskApiResponse> aliceTaskResponse = exchange(
                "/api/tasks",
                HttpMethod.POST,
                alice.token(),
                taskPayload("Task in project", "medium", false, null, project.id(), null),
                TaskApiResponse.class,
                new Object[0]
        );
        assertThat(aliceTaskResponse.is2xxSuccessful()).isTrue();
        assertThat(aliceTaskResponse.body()).isNotNull();
        assertThat(aliceTaskResponse.body().project().id()).isEqualTo(project.id());

        TestResponse<ApiErrorResponse> bobAssignResponse = exchange(
                "/api/tasks",
                HttpMethod.POST,
                bob.token(),
                taskPayload("Bob task", "medium", false, null, project.id(), null),
                ApiErrorResponse.class,
                new Object[0]
        );
        assertThat(bobAssignResponse.statusCode()).isEqualTo(404);

        TestResponse<String> deleteResponse = exchange(
                "/api/projects/{id}",
                HttpMethod.DELETE,
                alice.token(),
                null,
                String.class,
                project.id()
        );
        assertThat(deleteResponse.is2xxSuccessful()).isTrue();

        TestResponse<TaskApiResponse[]> tasksAfterDelete = exchange(
                "/api/tasks",
                HttpMethod.GET,
                alice.token(),
                null,
                TaskApiResponse[].class,
                new Object[0]
        );
        assertThat(tasksAfterDelete.body()).hasSize(1);
        assertThat(tasksAfterDelete.body()[0].project()).isNull();
    }

    @Test
    void labelsAreUserScopedAndDeletingLabelKeepsTasks() throws Exception {
        AuthSession alice = register("alice123", "password1");
        AuthSession bob = register("bob123", "password1");

        LabelApiResponse label = createLabel(alice.token(), "важно", "#FF6B6B");
        assertThat(label.name()).isEqualTo("важно");

        TestResponse<LabelApiResponse[]> bobLabels = exchange(
                "/api/labels",
                HttpMethod.GET,
                bob.token(),
                null,
                LabelApiResponse[].class,
                new Object[0]
        );
        assertThat(bobLabels.is2xxSuccessful()).isTrue();
        assertThat(bobLabels.body()).isEmpty();

        TestResponse<TaskApiResponse> aliceTaskResponse = exchange(
                "/api/tasks",
                HttpMethod.POST,
                alice.token(),
                taskPayload("Task with label", "high", false, null, null, new Long[]{label.id()}),
                TaskApiResponse.class,
                new Object[0]
        );
        assertThat(aliceTaskResponse.is2xxSuccessful()).isTrue();
        assertThat(aliceTaskResponse.body()).isNotNull();
        assertThat(aliceTaskResponse.body().labels()).hasSize(1);
        assertThat(aliceTaskResponse.body().labels()[0].id()).isEqualTo(label.id());

        TestResponse<ApiErrorResponse> bobAssignResponse = exchange(
                "/api/tasks",
                HttpMethod.POST,
                bob.token(),
                taskPayload("Bob task", "medium", false, null, null, new Long[]{label.id()}),
                ApiErrorResponse.class,
                new Object[0]
        );
        assertThat(bobAssignResponse.statusCode()).isEqualTo(404);

        TestResponse<String> deleteResponse = exchange(
                "/api/labels/{id}",
                HttpMethod.DELETE,
                alice.token(),
                null,
                String.class,
                label.id()
        );
        assertThat(deleteResponse.is2xxSuccessful()).isTrue();

        TestResponse<TaskApiResponse[]> tasksAfterDelete = exchange(
                "/api/tasks",
                HttpMethod.GET,
                alice.token(),
                null,
                TaskApiResponse[].class,
                new Object[0]
        );
        assertThat(tasksAfterDelete.body()).hasSize(1);
        assertThat(tasksAfterDelete.body()[0].labels()).isEmpty();
    }

    private AuthSession register(String username, String password) throws Exception {
        TestResponse<AuthResponse> response = post(
                "/api/auth/register",
                authPayload(username, password),
                AuthResponse.class
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        return new AuthSession(response.body().token(), response.body().user().id());
    }

    private long createTask(String token, String title) throws Exception {
        TestResponse<Task> response = exchange(
                "/api/tasks",
                HttpMethod.POST,
                token,
                taskPayload(title, "medium", false),
                Task.class,
                new Object[0]
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        return response.body().getId();
    }

    private Task[] getTasks(String token) throws Exception {
        TestResponse<Task[]> response = exchange(
                "/api/tasks",
                HttpMethod.GET,
                token,
                null,
                Task[].class,
                new Object[0]
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        return response.body();
    }

    private Map<String, String> authPayload(String username, String password) {
        return Map.of("username", username, "password", password);
    }

    private Map<String, Object> taskPayload(String title, String priority, boolean completed) {
        return taskPayload(title, priority, completed, null);
    }

    private Map<String, Object> taskPayload(String title, String priority, boolean completed, String dueDate) {
        return taskPayload(title, priority, completed, dueDate, null, null);
    }

    private Map<String, Object> taskPayload(
            String title,
            String priority,
            boolean completed,
            String dueDate,
            Long projectId,
            Long[] labelIds
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("description", "Description for " + title);
        payload.put("completed", completed);
        payload.put("priority", priority);
        payload.put("dueDate", dueDate);
        payload.put("projectId", projectId);
        payload.put("labelIds", labelIds);
        return payload;
    }

    private Map<String, Object> taskPayloadWithoutDescription(String title) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("completed", false);
        payload.put("priority", "medium");
        payload.put("dueDate", null);
        return payload;
    }

    private ProjectApiResponse createProject(String token, String name, String color) throws Exception {
        TestResponse<ProjectApiResponse> response = exchange(
                "/api/projects",
                HttpMethod.POST,
                token,
                Map.of("name", name, "color", color),
                ProjectApiResponse.class,
                new Object[0]
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        return response.body();
    }

    private LabelApiResponse createLabel(String token, String name, String color) throws Exception {
        TestResponse<LabelApiResponse> response = exchange(
                "/api/labels",
                HttpMethod.POST,
                token,
                Map.of("name", name, "color", color),
                LabelApiResponse.class,
                new Object[0]
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        return response.body();
    }

    private SubtaskApiResponse createSubtask(String token, long taskId, String title) throws Exception {
        TestResponse<SubtaskApiResponse> response = exchange(
                "/api/tasks/{taskId}/subtasks",
                HttpMethod.POST,
                token,
                subtaskPayload(title, false),
                SubtaskApiResponse.class,
                taskId
        );

        assertThat(response.is2xxSuccessful()).isTrue();
        assertThat(response.body()).isNotNull();
        return response.body();
    }

    private Map<String, Object> subtaskPayload(String title, Boolean completed) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("completed", completed);
        return payload;
    }

    private <T> TestResponse<T> post(String path, Object body, Class<T> responseType) throws Exception {
        return exchange(path, HttpMethod.POST, null, body, responseType, new Object[0]);
    }

    private <T> TestResponse<T> get(String path, String token, Class<T> responseType) throws Exception {
        return exchange(path, HttpMethod.GET, token, null, responseType, new Object[0]);
    }

    private <T> TestResponse<T> exchange(
            String path,
            HttpMethod method,
            String token,
            Object body,
            Class<T> responseType,
            Object... uriVariables
    ) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path, uriVariables))
                .header("Accept", "application/json")
                .method(method.name(), requestBody(body));

        if (body != null) {
            builder.header("Content-Type", "application/json");
        }

        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return new TestResponse<>(response.statusCode(), parseBody(response.body(), responseType));
    }

    private HttpRequest.BodyPublisher requestBody(Object body) throws Exception {
        if (body == null) {
            return HttpRequest.BodyPublishers.noBody();
        }

        return HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body));
    }

    private URI uri(String path, Object... uriVariables) {
        String resolvedPath = path;
        for (Object uriVariable : uriVariables) {
            resolvedPath = resolvedPath.replaceFirst("\\{[^/]+}", uriVariable.toString());
        }
        return URI.create("http://localhost:" + port + resolvedPath);
    }

    private <T> T parseBody(String body, Class<T> responseType) throws Exception {
        if (responseType == String.class) {
            return responseType.cast(body);
        }
        if (body == null || body.isBlank()) {
            return null;
        }
        return objectMapper.readValue(body, responseType);
    }

    private record TestResponse<T>(int statusCode, T body) {
        private boolean is2xxSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }
    }

    private record AuthSession(String token, long userId) {
    }

    private record ProjectApiResponse(Long id, String name, String color) {
    }

    private record LabelApiResponse(Long id, String name, String color) {
    }

    private record SubtaskApiResponse(Long id, String title, boolean completed) {
    }

    private record TaskApiResponse(
            Long id,
            String title,
            String description,
            boolean completed,
            String priority,
            String dueDate,
            ProjectApiResponse project,
            LabelApiResponse[] labels,
            int subtaskTotal,
            int subtaskCompleted
    ) {
    }
}
