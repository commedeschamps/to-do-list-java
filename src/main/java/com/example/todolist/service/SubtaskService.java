package com.example.todolist.service;

import com.example.todolist.entity.Subtask;
import com.example.todolist.entity.Task;
import com.example.todolist.repository.SubtaskRepository;
import com.example.todolist.repository.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class SubtaskService {
    private final SubtaskRepository subtaskRepository;
    private final TaskRepository taskRepository;

    public SubtaskService(SubtaskRepository subtaskRepository, TaskRepository taskRepository) {
        this.subtaskRepository = subtaskRepository;
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public List<Subtask> getSubtasks(String username, Long taskId) {
        getOwnedTask(username, taskId);
        return subtaskRepository.findByTaskIdAndTaskUserUsernameOrderByCreatedAtAsc(taskId, username);
    }

    @Transactional
    public Subtask createSubtask(String username, Long taskId, String title, Boolean completed) {
        Task task = getOwnedTask(username, taskId);
        Subtask subtask = new Subtask();
        subtask.setTitle(normalizeTitle(title));
        subtask.setCompleted(Boolean.TRUE.equals(completed));
        subtask.setTask(task);
        return subtaskRepository.save(subtask);
    }

    @Transactional
    public Subtask updateSubtask(String username, Long taskId, Long subtaskId, String title, Boolean completed) {
        Subtask subtask = getOwnedSubtask(username, taskId, subtaskId);

        if (title != null) {
            subtask.setTitle(normalizeTitle(title));
        }

        if (completed != null) {
            subtask.setCompleted(completed);
        }

        return subtaskRepository.save(subtask);
    }

    @Transactional
    public void deleteSubtask(String username, Long taskId, Long subtaskId) {
        Subtask subtask = getOwnedSubtask(username, taskId, subtaskId);
        subtaskRepository.delete(subtask);
    }

    private Task getOwnedTask(String username, Long taskId) {
        return taskRepository.findByIdAndUserUsername(taskId, username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Задача не найдена"));
    }

    private Subtask getOwnedSubtask(String username, Long taskId, Long subtaskId) {
        return subtaskRepository.findByIdAndTaskIdAndTaskUserUsername(subtaskId, taskId, username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Подзадача не найдена"));
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название подзадачи обязательно");
        }

        String normalizedTitle = title.trim();

        if (normalizedTitle.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название подзадачи слишком длинное");
        }

        return normalizedTitle;
    }
}
