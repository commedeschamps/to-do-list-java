package com.example.todolist.repository;

import com.example.todolist.entity.Task;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {
    @EntityGraph(attributePaths = {"project", "labels", "subtasks"})
    @Query("select distinct task from Task task where task.user.id = :userId")
    List<Task> findByUserId(@Param("userId") Long userId);

    @EntityGraph(attributePaths = {"project", "labels", "subtasks"})
    Optional<Task> findByIdAndUserUsername(Long id, String username);

    List<Task> findByProjectIdAndUserUsername(Long projectId, String username);
}
