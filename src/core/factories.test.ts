import { expect, spyOn, test } from "bun:test";
import { InvokeHarnessCommand } from "@aws-sdk/client-bedrock-agentcore";
import { createDataClient } from "./factories";

test("createDataClient signs bearer invocations without resolving AWS credentials", async () => {
  let authorization: string | undefined;
  let sigv4Date: string | undefined;
  let resolvedCredentials = false;
  const client = createDataClient({
    region: "us-west-2",
    endpoint: "https://example.test",
    bearerToken: "secret-token",
    credentials: async () => {
      resolvedCredentials = true;
      throw new Error("AWS credentials must not be resolved for bearer authentication");
    },
  });
  const handle = spyOn(client.config.requestHandler, "handle").mockImplementation(
    async (request) => {
      const headers = (request as { headers: Record<string, string> }).headers;
      authorization = headers.Authorization;
      sigv4Date = headers["x-amz-date"];
      return {
        response: {
          statusCode: 403,
          headers: { "content-type": "application/json" },
          body: Buffer.from('{"message":"expected test rejection"}'),
        },
      } as never;
    },
  );

  try {
    await client.send(
      new InvokeHarnessCommand({
        harnessArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:harness/MyHarness-abc123",
        runtimeSessionId: "s".repeat(40),
        messages: [{ role: "user", content: [{ text: "hi" }] }],
      }),
    );
  } catch {
    // The transport returns a test rejection after capturing the signed request.
  } finally {
    handle.mockRestore();
    client.destroy();
  }

  expect(authorization).toBe("Bearer secret-token");
  expect(sigv4Date).toBeUndefined();
  expect(resolvedCredentials).toBe(false);
});

test("createDataClient refuses bearer authentication over HTTP", () => {
  expect(() =>
    createDataClient({
      region: "us-west-2",
      endpoint: "http://example.test",
      bearerToken: "secret-token",
    }),
  ).toThrow("CUSTOM_JWT requires an HTTPS endpoint");
});
