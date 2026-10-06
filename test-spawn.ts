import { spawn } from "child_process";

const proc = spawn("claude", [
  "-p",
  "--output-format", "stream-json",
  "--input-format", "stream-json",
  "--bare",
], {
  stdio: ["pipe", "pipe", "pipe"],
});

proc.stdout.on("data", (chunk: Buffer) => {
  for (const line of chunk.toString().split("\n")) {
    if (line.trim()) console.log("OUT:", line);
  }
});

proc.stderr.on("data", (chunk: Buffer) => {
  console.log("ERR:", chunk.toString().trim());
});

proc.on("exit", (code) => {
  console.log("EXIT:", code);
});

setTimeout(() => {
  const msg = JSON.stringify({ type: "user_message", message: { role: "user", content: "Say hello in one word." } });
  console.log("SEND:", msg);
  proc.stdin.write(msg + "\n");
}, 2000);
