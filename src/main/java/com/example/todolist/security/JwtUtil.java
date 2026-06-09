package com.example.todolist.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.exceptions.JWTVerificationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import com.auth0.jwt.algorithms.Algorithm;
@Component
public class JwtUtil {
    @Value("${jwt.secret}")
    private String secret;

    public String generateToken(String username) {
        return JWT.create().
                withSubject(username).
                withExpiresAt(new java.util.Date(System.currentTimeMillis() + 86400000)).
                sign(Algorithm.HMAC256(secret));
    }

    public String extractUsername(String token){
        return JWT.require(Algorithm.HMAC256(secret))
                .build()
                .verify(token)
                .getSubject();
    }
    public boolean isTokenValid(String token){
        try {
            extractUsername(token);
            return true;
        } catch (JWTVerificationException e) {
            return false;
        }
    }
}
