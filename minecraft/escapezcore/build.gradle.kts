plugins {
    java
}

group = "be.escapezcraft"
version = "0.1.8"
description = "EscapezCore — core Paper plugin for EscapezCraft"

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(21))
}

repositories {
    mavenCentral()
    maven {
        name = "papermc"
        url = uri("https://repo.papermc.io/repository/maven-public/")
    }
    maven {
        name = "jitpack"
        url = uri("https://jitpack.io")
    }
    maven {
        name = "placeholderapi"
        url = uri("https://repo.helpch.at/releases/")
    }
}

dependencies {
    // Paper API 1.21.4 — compileOnly (provided by server at runtime)
    // Chosen because it is a stable 1.21.x artifact on repo.papermc.io matching api-version 1.21 + Java 21.
    // Target runtime: Paper 1.21.10 (api-version 1.21); compile against 1.21.4 stable published API.
    compileOnly("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")

    // Soft-dep public APIs (compileOnly — never shaded into the plugin jar)
    compileOnly("net.luckperms:api:5.5")
    compileOnly("com.github.MilkBowl:VaultAPI:1.7.1") {
        exclude(group = "org.bukkit", module = "bukkit")
    }
    compileOnly("me.clip:placeholderapi:2.11.6")

    // HikariCP connection pool
    implementation("com.zaxxer:HikariCP:5.1.0")
    // PostgreSQL driver (prod) + SQLite (dev / reports fallback)
    implementation("org.postgresql:postgresql:42.7.4")
    implementation("org.xerial:sqlite-jdbc:3.46.1.3")
    // Flyway migrations (EscapezCore-owned schema only)
    implementation("org.flywaydb:flyway-core:10.17.0")
    implementation("org.flywaydb:flyway-database-postgresql:10.17.0")

    // Unit / smoke tests (JUnit 5 + Mockito; Paper API on test classpath for interfaces)
    testImplementation("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")
    testImplementation("org.mockito:mockito-core:5.14.2")
    testImplementation("org.mockito:mockito-junit-jupiter:5.14.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.processResources {
    val props = mapOf("version" to version)
    inputs.properties(props)
    filesMatching("plugin.yml") {
        expand(props)
    }
}

tasks.jar {
    archiveBaseName.set("EscapezCore")
    archiveVersion.set(project.version.toString())
    // Bundle implementation deps (HikariCP, drivers, Flyway) into the plugin jar
    from({
        configurations.runtimeClasspath.get()
            .filter { it.name.endsWith(".jar") }
            .map { zipTree(it) }
    })
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.release.set(21)
}

tasks.test {
    useJUnitPlatform()
}
