package com.example.todolist.repository;

import com.example.todolist.entity.Subtask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubtaskRepository extends JpaRepository<Subtask, Long> {
    List<Subtask> findByTaskIdAndTaskUserUsernameOrderByCreatedAtAsc(Long taskId, String username);

    Optional<Subtask> findByIdAndTaskIdAndTaskUserUsername(Long id, Long taskId, String username);
}
