package com.example.todolist.service;

import com.example.todolist.entity.Project;
import com.example.todolist.entity.Task;
import com.example.todolist.entity.User;
import com.example.todolist.repository.ProjectRepository;
import com.example.todolist.repository.TaskRepository;
import com.example.todolist.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ProjectService {
    private static final String DEFAULT_COLOR = "#3B82F6";

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository, TaskRepository taskRepository, UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<Project> getProjects(String username) {
        return projectRepository.findByUserUsernameOrderByNameAsc(username);
    }

    @Transactional
    public Project createProject(String username, String name, String color) {
        String normalizedName = normalizeName(name);
        ensureNameAvailable(username, normalizedName, null);

        Project project = new Project();
        project.setName(normalizedName);
        project.setColor(normalizeColor(color, DEFAULT_COLOR));
        project.setUser(getUser(username));

        return projectRepository.save(project);
    }

    @Transactional
    public Project updateProject(String username, Long id, String name, String color) {
        Project project = getOwnedProject(username, id);
        String normalizedName = normalizeName(name);
        ensureNameAvailable(username, normalizedName, id);

        project.setName(normalizedName);
        project.setColor(normalizeColor(color, project.getColor()));

        return projectRepository.save(project);
    }

    @Transactional
    public void deleteProject(String username, Long id) {
        Project project = getOwnedProject(username, id);
        List<Task> tasks = taskRepository.findByProjectIdAndUserUsername(id, username);
        tasks.forEach(task -> task.setProject(null));
        taskRepository.saveAll(tasks);
        projectRepository.delete(project);
    }

    private Project getOwnedProject(String username, Long id) {
        return projectRepository.findByIdAndUserUsername(id, username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Проект не найден"));
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
    }

    private void ensureNameAvailable(String username, String name, Long currentProjectId) {
        boolean exists = currentProjectId == null
                ? projectRepository.existsByUserUsernameAndNameIgnoreCase(username, name)
                : projectRepository.existsByUserUsernameAndNameIgnoreCaseAndIdNot(username, name, currentProjectId);

        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Проект с таким названием уже есть");
        }
    }

    private String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название проекта обязательно");
        }

        String normalizedName = name.trim();

        if (normalizedName.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название проекта слишком длинное");
        }

        return normalizedName;
    }

    private String normalizeColor(String color, String fallback) {
        if (color == null || color.isBlank()) {
            return fallback == null || fallback.isBlank() ? DEFAULT_COLOR : fallback;
        }

        String normalizedColor = color.trim();
        return normalizedColor.length() > 20 ? normalizedColor.substring(0, 20) : normalizedColor;
    }
}
