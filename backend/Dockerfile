# Stage 1: Build the application
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace/app

# Copy gradle files for caching dependencies
COPY gradle gradle
COPY gradlew .
COPY build.gradle settings.gradle ./

# Grant execution permission and fetch dependencies
RUN chmod +x gradlew
RUN ./gradlew dependencies --no-daemon

# Copy source and build
COPY src src
RUN ./gradlew bootJar -x test --no-daemon

# Stage 2: Runtime environment
FROM eclipse-temurin:25-jdk
# Install Node.js for Scraper Runner
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled jar
COPY --from=build /workspace/app/build/libs/*.jar app.jar

# Setup scraper dependencies
COPY scraper scraper
WORKDIR /app/scraper
RUN npm install --only=production

# Return to root app directory
WORKDIR /app

# Copy extensions defaults (will be layered or overridden by bind mounts)
COPY extensions extensions

# Create default cache dir
RUN mkdir -p image_cache

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
