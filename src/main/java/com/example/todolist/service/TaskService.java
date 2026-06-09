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
    public Task createTask(String username, String title, String description){
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        Task task = new Task();
        task.setTitle(title);
        task.setDescription(description);
        task.setUser(user);
        return taskRepository.save(task);
    }
    public Task updateTask(Long id, String title, String description, boolean completed) {
        Task task = taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task not found"));
        task.setTitle(title);
        task.setDescription(description);
        task.setCompleted(completed);
        return taskRepository.save(task);
    }
    public void deleteTask(Long id) {
        taskRepository.deleteById(id);
    }
}
