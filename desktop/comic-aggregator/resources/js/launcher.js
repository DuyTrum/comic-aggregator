let javaProcess = null;

// Initialize Neutralino
Neutralino.init();

async function startBackend() {
  try {
    // Spawns the Java backend jar located inside the bin/ directory
    let command = 'java -jar bin/backend.jar';
    console.log("Starting backend with command:", command);
    let info = await Neutralino.os.spawnProcess(command);
    javaProcess = info;
    console.log("Backend spawned successfully. PID:", info.pid);
  } catch (err) {
    console.error("Failed to spawn Java backend:", err);
  }
}

async function stopBackend() {
  if (javaProcess && javaProcess.pid) {
    try {
      console.log("Terminating backend PID:", javaProcess.pid);
      await Neutralino.os.killProcess(javaProcess.pid);
    } catch (e) {
      console.error("Error killing process:", e);
    }
  }
}

// Listen to windowClose event to kill backend and exit
Neutralino.events.on("windowClose", async () => {
  await stopBackend();
  Neutralino.app.exit();
});

// Start backend on load
startBackend();
