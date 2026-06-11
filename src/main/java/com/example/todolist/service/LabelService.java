package com.example.todolist.service;

import com.example.todolist.entity.Label;
import com.example.todolist.entity.User;
import com.example.todolist.repository.LabelRepository;
import com.example.todolist.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class LabelService {
    private static final String DEFAULT_COLOR = "#64748B";

    private final LabelRepository labelRepository;
    private final UserRepository userRepository;

    public LabelService(LabelRepository labelRepository, UserRepository userRepository) {
        this.labelRepository = labelRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<Label> getLabels(String username) {
        return labelRepository.findByUserUsernameOrderByNameAsc(username);
    }

    @Transactional
    public Label createLabel(String username, String name, String color) {
        String normalizedName = normalizeName(name);
        ensureNameAvailable(username, normalizedName, null);

        Label label = new Label();
        label.setName(normalizedName);
        label.setColor(normalizeColor(color, DEFAULT_COLOR));
        label.setUser(getUser(username));

        return labelRepository.save(label);
    }

    @Transactional
    public Label updateLabel(String username, Long id, String name, String color) {
        Label label = getOwnedLabel(username, id);
        String normalizedName = normalizeName(name);
        ensureNameAvailable(username, normalizedName, id);

        label.setName(normalizedName);
        label.setColor(normalizeColor(color, label.getColor()));

        return labelRepository.save(label);
    }

    @Transactional
    public void deleteLabel(String username, Long id) {
        Label label = getOwnedLabel(username, id);
        labelRepository.delete(label);
    }

    private Label getOwnedLabel(String username, Long id) {
        return labelRepository.findByIdAndUserUsername(id, username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Метка не найдена"));
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
    }

    private void ensureNameAvailable(String username, String name, Long currentLabelId) {
        boolean exists = currentLabelId == null
                ? labelRepository.existsByUserUsernameAndNameIgnoreCase(username, name)
                : labelRepository.existsByUserUsernameAndNameIgnoreCaseAndIdNot(username, name, currentLabelId);

        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Метка с таким названием уже есть");
        }
    }

    private String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название метки обязательно");
        }

        String normalizedName = name.trim();

        if (normalizedName.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название метки слишком длинное");
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
