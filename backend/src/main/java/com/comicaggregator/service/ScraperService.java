package com.comicaggregator.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ScraperService {

    @Value("${app.extensions.dir}")
    private String extensionsDir;

    @Value("${app.scraper.runner-path}")
    private String runnerPath;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Executes the Node.js runner for a specific JS file path, method, and parameters.
     */
    public String runMethod(String extensionJsPath, String method, String paramsJson) throws Exception {
        // Resolve to absolute path
        File extensionFile = new File(extensionJsPath).getAbsoluteFile();
        
        List<String> command = new ArrayList<>();
        command.add("node");
        command.add("runner.js");  // Will be executed from scraper directory
        command.add(extensionFile.getAbsolutePath());  // Use absolute path
        command.add(method);
        
        String paramsBase64 = java.util.Base64.getEncoder().encodeToString(paramsJson.getBytes(StandardCharsets.UTF_8));
        command.add(paramsBase64);

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        // Set work directory to the runner parent directory
        File runnerFile = new File(runnerPath);
        File resolvedRunnerFile = runnerFile.getAbsoluteFile();
        
        if (resolvedRunnerFile.exists() && resolvedRunnerFile.getParentFile() != null) {
            processBuilder.directory(resolvedRunnerFile.getParentFile());
        }
        
        System.out.println("[DEBUG] Runner command: " + command);
        System.out.println("[DEBUG] Working directory: " + (processBuilder.directory() != null ? processBuilder.directory().getAbsolutePath() : "default"));
        
        Process process = processBuilder.start();

        // Read standard output
        String stdout;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            stdout = reader.lines().collect(Collectors.joining("\n"));
        }

        // Read error output
        String stderr;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
            stderr = reader.lines().collect(Collectors.joining("\n"));
        }

        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new RuntimeException("Scraper runner failed with exit code " + exitCode + ". Error: " + stderr);
        }

        return stdout;
    }

    /**
     * Helper to run methods on a loaded extension using its name.
     */
    public String runExtension(String extensionName, String method, Map<String, Object> params) throws Exception {
        String jsPath = extensionsDir + "/" + extensionName.toLowerCase() + ".js";
        System.out.println("[DEBUG] ScraperService - extensionsDir: " + extensionsDir);
        System.out.println("[DEBUG] ScraperService - jsPath: " + jsPath);
        System.out.println("[DEBUG] ScraperService - runnerPath: " + runnerPath);
        String paramsJson = objectMapper.writeValueAsString(params);
        return runMethod(jsPath, method, paramsJson);
    }
}
