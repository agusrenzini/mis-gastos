package com.misgastos.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * Define "qué día es hoy" para la app, en hora argentina.
 * El servidor puede estar en otra zona horaria (los hostings suelen usar UTC).
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock(@Value("${app.timezone}") String timezone) {
        return Clock.system(ZoneId.of(timezone));
    }
}
