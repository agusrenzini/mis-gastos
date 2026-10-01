package com.misgastos.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class AttemptLimiterTest {

    /** Reloj que se puede adelantar a mano. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-01T12:00:00Z");

        void advance(Duration duration) { now = now.plus(duration); }

        @Override public Instant instant() { return now; }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    @Test
    void blocksAfterTheLimitAndUnblocksWhenTheWindowPasses() {
        MutableClock clock = new MutableClock();
        AttemptLimiter limiter = new AttemptLimiter(3, Duration.ofMinutes(15), clock);

        limiter.record("ana");
        limiter.record("ana");
        assertThat(limiter.isBlocked("ana")).isFalse();
        limiter.record("ana");
        assertThat(limiter.isBlocked("ana")).isTrue();
        assertThat(limiter.isBlocked("beto")).isFalse();

        clock.advance(Duration.ofMinutes(16));
        assertThat(limiter.isBlocked("ana")).isFalse();
    }

    @Test
    void resetClearsTheCounter() {
        AttemptLimiter limiter = new AttemptLimiter(1, Duration.ofMinutes(15), Clock.systemUTC());
        limiter.record("ana");
        assertThat(limiter.isBlocked("ana")).isTrue();
        limiter.reset("ana");
        assertThat(limiter.isBlocked("ana")).isFalse();
    }
}
