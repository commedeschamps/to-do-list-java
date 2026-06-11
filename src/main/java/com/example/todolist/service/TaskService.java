package com.example.todolist.service;

import com.example.todolist.entity.Label;
import com.example.todolist.entity.Project;
import com.example.todolist.entity.Task;
import com.example.todolist.entity.User;
import com.example.todolist.repository.LabelRepository;
import com.example.todolist.repository.ProjectRepository;
import com.example.todolist.repository.TaskRepository;
import com.example.todolist.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TaskService {
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final LabelRepository labelRepository;

    public TaskService(
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectRepository projectRepository,
            LabelRepository labelRepository
    ) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.labelRepository = labelRepository;
    }

    @Transactional(readOnly = true)
    public List<Task> getAllTasks(String username) {
        Long userId = getUser(username).getId();
        return taskRepository.findByUserId(userId);
    }

    @Transactional
    public Task createTask(
            String username,
            String title,
            String description,
            String priority,
            LocalDate dueDate,
            boolean completed,
            Long projectId,
            Set<Long> labelIds,
            String color
    ) {
        User user = getUser(username);
        Task task = new Task();
        task.setTitle(title.trim());
        task.setDescription(normalizeOptionalText(description));
        task.setPriority(normalizePriority(priority, "medium"));
        task.setDueDate(dueDate);
        task.setCompleted(completed);
        task.setCompletedAt(completed ? LocalDateTime.now() : null);
        task.setProject(resolveProject(username, projectId));
        task.setLabels(resolveLabels(username, labelIds));
        task.setColor(normalizeColor(color));
        task.setUser(user);
        return taskRepository.save(task);
    }

    @Transactional
    public Task updateTask(
            String username,
            Long id,
            String title,
            String description,
            boolean completed,
            String priority,
            LocalDate dueDate,
            Long projectId,
            Set<Long> labelIds,
            String color
    ) {
        Task task = getOwnedTask(username, id);
        boolean wasCompleted = task.isCompleted();
        task.setTitle(title.trim());
        task.setDescription(normalizeOptionalText(description));
        task.setCompleted(completed);
        task.setPriority(normalizePriority(priority, task.getPriority()));
        task.setDueDate(dueDate);
        task.setProject(resolveProject(username, projectId));
        task.setColor(normalizeColor(color));

        if (labelIds != null) {
            task.setLabels(resolveLabels(username, labelIds));
        }

        if (completed && !wasCompleted) {
            task.setCompletedAt(LocalDateTime.now());
        } else if (!completed) {
            task.setCompletedAt(null);
        }

        return taskRepository.save(task);
    }

    @Transactional
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

    private Project resolveProject(String username, Long projectId) {
        if (projectId == null) {
            return null;
        }

        return projectRepository.findByIdAndUserUsername(projectId, username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Проект не найден"));
    }

    private Set<Label> resolveLabels(String username, Set<Long> labelIds) {
        if (labelIds == null || labelIds.isEmpty()) {
            return new HashSet<>();
        }

        Set<Long> normalizedIds = new HashSet<>(labelIds);
        normalizedIds.remove(null);

        if (normalizedIds.isEmpty()) {
            return new HashSet<>();
        }

        Set<Label> labels = labelRepository.findByIdInAndUserUsername(normalizedIds, username);

        if (labels.size() != normalizedIds.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Метка не найдена");
        }

        return labels;
    }

    private String normalizeOptionalText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        return text.trim();
    }

    private String normalizeColor(String color) {
        if (color == null || color.isBlank()) {
            return null;
        }

        String normalizedColor = color.trim();
        return normalizedColor.length() > 20 ? normalizedColor.substring(0, 20) : normalizedColor;
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
