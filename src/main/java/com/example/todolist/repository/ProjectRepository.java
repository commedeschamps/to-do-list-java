package com.example.todolist.repository;

import com.example.todolist.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByUserUsernameOrderByNameAsc(String username);

    Optional<Project> findByIdAndUserUsername(Long id, String username);

    boolean existsByUserUsernameAndNameIgnoreCase(String username, String name);

    boolean existsByUserUsernameAndNameIgnoreCaseAndIdNot(String username, String name, Long id);
}
