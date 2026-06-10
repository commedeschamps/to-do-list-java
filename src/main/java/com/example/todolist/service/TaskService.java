package com.example.todolist.service;

import com.example.todolist.entity.Task;
import com.example.todolist.entity.User;
import com.example.todolist.repository.TaskRepository;
import com.example.todolist.repository.UserRepository;
import org.springframework.stereotype.Service;

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
        Long userId = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found")).getId();
        return taskRepository.findByUserId(userId);
    }
    public Task createTask(String username, String title, String description, String priority){
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        Task task = new Task();
        task.setTitle(title);
        task.setDescription(description);
        task.setPriority(normalizePriority(priority, "medium"));
        task.setUser(user);
        return taskRepository.save(task);
    }
    public Task updateTask(Long id, String title, String description, boolean completed, String priority) {
        Task task = taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task not found"));
        task.setTitle(title);
        task.setDescription(description);
        task.setCompleted(completed);
        task.setPriority(normalizePriority(priority, task.getPriority()));
        return taskRepository.save(task);
    }
    public void deleteTask(Long id) {
        taskRepository.deleteById(id);
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
