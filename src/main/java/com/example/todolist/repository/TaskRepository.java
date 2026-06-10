package com.example.todolist.repository;

import com.example.todolist.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserId(Long userId);
    Optional<Task> findByIdAndUserUsername(Long id, String username);
}
