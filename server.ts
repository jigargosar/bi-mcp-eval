import { spawn } from "child_process";

const children: ReturnType<typeof spawn>[] = [];

function cleanup() {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

const proc = spawn("claude", [
  "-p",
  "--output-format", "stream-json",
  "--input-format", "stream-json",
  "--system-prompt", "You are Alice. Respond in one sentence.",
  "--bare",
], {
  stdio: ["pipe", "pipe", "pipe"],
});

children.push(proc);
console.log("spawned pid:", proc.pid);

proc.stdout.on("data", (chunk: Buffer) => {
  for (const line of chunk.toString().split("\n")) {
    if (line.trim() === "") continue;
    console.log("OUT:", line);
  }
});

proc.stderr.on("data", (chunk: Buffer) => {
  console.log("ERR:", chunk.toString().trim());
});

proc.on("exit", (code) => {
  console.log("EXIT:", code);
});

// Send after 1s
setTimeout(() => {
  const msg = JSON.stringify({ type: "user_message", message: { role: "user", content: "Say hello." } });
  console.log("SEND:", msg);
  proc.stdin.write(msg + "\n");
}, 1000);
