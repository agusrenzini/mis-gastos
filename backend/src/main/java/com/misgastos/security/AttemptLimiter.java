package com.misgastos.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cuenta intentos por clave (usuario o IP) en una ventana de tiempo deslizante.
 * Vive en memoria: alcanza para una sola instancia del servidor y se reinicia con él.
 */
public class AttemptLimiter {

    private static final int CLEANUP_THRESHOLD = 10_000;

    private final int maxAttempts;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    public AttemptLimiter(int maxAttempts, Duration window, Clock clock) {
        this.maxAttempts = maxAttempts;
        this.window = window;
        this.clock = clock;
    }

    public boolean isBlocked(String key) {
        Deque<Instant> deque = attempts.get(key);
        if (deque == null) {
            return false;
        }
        synchronized (deque) {
            prune(deque);
            return deque.size() >= maxAttempts;
        }
    }

    public void record(String key) {
        if (attempts.size() > CLEANUP_THRESHOLD) {
            cleanup();
        }
        Deque<Instant> deque = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            prune(deque);
            deque.addLast(Instant.now(clock));
        }
    }

    public void reset(String key) {
        attempts.remove(key);
    }

    /** Para los tests. */
    public void clear() {
        attempts.clear();
    }

    private void prune(Deque<Instant> deque) {
        Instant limit = Instant.now(clock).minus(window);
        while (!deque.isEmpty() && deque.peekFirst().isBefore(limit)) {
            deque.pollFirst();
        }
    }

    private void cleanup() {
        attempts.values().removeIf(deque -> {
            synchronized (deque) {
                prune(deque);
                return deque.isEmpty();
            }
        });
    }
}
