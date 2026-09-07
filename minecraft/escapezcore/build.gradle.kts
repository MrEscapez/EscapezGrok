plugins {
    java
}

group = "be.escapezcraft"
version = "0.1.1"
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
}

dependencies {
    // Paper API 1.21.4 — compileOnly (provided by server at runtime)
    // Chosen because it is a stable 1.21.x artifact on repo.papermc.io matching api-version 1.21 + Java 21.
    compileOnly("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")

    // HikariCP for optional async PostgreSQL pool
    implementation("com.zaxxer:HikariCP:5.1.0")
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
    // Bundle implementation deps (HikariCP) into the plugin jar
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
