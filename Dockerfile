# Imagen para publicar la app (Render, Railway, Fly.io, etc.).
# No hace falta Docker para desarrollar: esto lo usa el servicio de hosting.

# 1) Compilar: el jar incluye el backend y el frontend (se copia a /static)
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY backend/pom.xml backend/pom.xml
RUN mvn -q -f backend/pom.xml dependency:go-offline
COPY backend backend
COPY frontend frontend
RUN mvn -q -f backend/pom.xml -DskipTests package

# 2) Ejecutar: solo Java + el jar
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/backend/target/mis-gastos-*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
