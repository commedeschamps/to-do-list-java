package com.example.todolist;

import com.example.todolist.dto.ApiErrorResponse;
import com.example.todolist.dto.AuthResponse;
import com.example.todolist.dto.CurrentUserResponse;
import com.example.todolist.entity.Task;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthAndTaskOwnershipTests {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Autowired
    AuthAndTaskOwnershipTests(
            TaskRepository taskRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper
    ) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
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
        return Map.of(
                "title", title,
                "description", "Description for " + title,
                "completed", completed,
                "priority", priority
        );
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
}
