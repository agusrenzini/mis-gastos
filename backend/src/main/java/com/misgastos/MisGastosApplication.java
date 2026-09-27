package com.misgastos;

import com.misgastos.config.DatabaseConfigCheck;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MisGastosApplication {

	public static void main(String[] args) {
		SpringApplication app = new SpringApplication(MisGastosApplication.class);
		app.addListeners(new DatabaseConfigCheck());
		app.run(args);
	}

}
