import { afterEach, expect, test } from "bun:test";
import { InvokeHarnessCommand } from "@aws-sdk/client-bedrock-agentcore";
import { startHttpServer, type HttpServerHandle } from "../io";
import { createDataClient } from "./factories";

let server: HttpServerHandle | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

test("createDataClient signs bearer invocations without resolving AWS credentials", async () => {
  let authorization: string | undefined;
  let resolvedCredentials = false;
  server = await startHttpServer((request) => {
    authorization = request.headers.authorization;
    return {
      status: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "expected test rejection" }),
    };
  });
  const client = createDataClient({
    region: "us-west-2",
    endpoint: `http://127.0.0.1:${server.port}`,
    bearerToken: "secret-token",
    credentials: async () => {
      resolvedCredentials = true;
      throw new Error("AWS credentials must not be resolved for bearer authentication");
    },
  });

  try {
    await client.send(
      new InvokeHarnessCommand({
        harnessArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:harness/MyHarness-abc123",
        runtimeSessionId: "s".repeat(40),
        messages: [{ role: "user", content: [{ text: "hi" }] }],
      }),
    );
  } catch {
    // The local server only captures the signed request; it is not an AgentCore endpoint.
  } finally {
    client.destroy();
  }

  expect(authorization).toBe("Bearer secret-token");
  expect(resolvedCredentials).toBe(false);
});
