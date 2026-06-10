package com.example.todolist.service;

import com.example.todolist.entity.Task;
import com.example.todolist.entity.User;
import com.example.todolist.repository.TaskRepository;
import com.example.todolist.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }
    public List<Task> getAllTasks(String username) {
        Long userId = getUser(username).getId();
        return taskRepository.findByUserId(userId);
    }
    public Task createTask(String username, String title, String description, String priority, LocalDate dueDate, boolean completed){
        User user = getUser(username);
        Task task = new Task();
        task.setTitle(title.trim());
        task.setDescription(description);
        task.setPriority(normalizePriority(priority, "medium"));
        task.setDueDate(dueDate);
        task.setCompleted(completed);
        task.setCompletedAt(completed ? LocalDateTime.now() : null);
        task.setUser(user);
        return taskRepository.save(task);
    }
    public Task updateTask(String username, Long id, String title, String description, boolean completed, String priority, LocalDate dueDate) {
        Task task = getOwnedTask(username, id);
        boolean wasCompleted = task.isCompleted();
        task.setTitle(title.trim());
        task.setDescription(description);
        task.setCompleted(completed);
        task.setPriority(normalizePriority(priority, task.getPriority()));
        task.setDueDate(dueDate);

        if (completed && !wasCompleted) {
            task.setCompletedAt(LocalDateTime.now());
        } else if (!completed) {
            task.setCompletedAt(null);
        }

        return taskRepository.save(task);
    }
    public void deleteTask(String username, Long id) {
        Task task = getOwnedTask(username, id);
        taskRepository.delete(task);
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
    }

    private Task getOwnedTask(String username, Long id) {
        return taskRepository.findByIdAndUserUsername(id, username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Задача не найдена"));
    }

    private String normalizePriority(String priority, String fallback) {
        if (priority == null || priority.isBlank()) {
            return fallback == null || fallback.isBlank() ? "medium" : fallback;
        }

        String normalizedPriority = priority.toLowerCase();

        if (normalizedPriority.equals("low") || normalizedPriority.equals("medium") || normalizedPriority.equals("high")) {
            return normalizedPriority;
        }

        return fallback == null || fallback.isBlank() ? "medium" : fallback;
    }
}
