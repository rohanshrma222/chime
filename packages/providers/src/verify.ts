import { OpenRouterProvider } from "./openrouter.ts";

const provider = new OpenRouterProvider();

for await (const event of provider.stream(
  [{ role: "user", content: "Say hello in exactly five words." }],
  [],
)) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
}

process.stdout.write("\n");
