package com.example.todolist.repository;

import com.example.todolist.entity.Label;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface LabelRepository extends JpaRepository<Label, Long> {
    List<Label> findByUserUsernameOrderByNameAsc(String username);

    Optional<Label> findByIdAndUserUsername(Long id, String username);

    Set<Label> findByIdInAndUserUsername(Collection<Long> ids, String username);

    boolean existsByUserUsernameAndNameIgnoreCase(String username, String name);

    boolean existsByUserUsernameAndNameIgnoreCaseAndIdNot(String username, String name, Long id);
}
