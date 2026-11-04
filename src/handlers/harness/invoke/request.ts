import z from "zod";
import { InputValidationError, SourceResolutionError } from "../../../errors";
import { SourceResolver } from "../../../io";

const HARNESS_ARN =
  /^arn:[^:]+:bedrock-agentcore:[^:]+:\d{12}:harness\/[A-Za-z0-9][A-Za-z0-9_-]{0,50}$/;

export const harnessInvokeTargetSchema = z
  .string()
  .refine(
    (value) =>
      (value.length >= 1 && value.length <= 51 && !value.startsWith("arn:")) ||
      HARNESS_ARN.test(value),
    "must be a harness ID or ARN",
  );

export function isHarnessArn(value: string): boolean {
  return HARNESS_ARN.test(value);
}

export async function resolveHarnessInvokeBearerToken(
  source: string | undefined,
  stdin: NodeJS.ReadStream,
): Promise<string | undefined> {
  try {
    const value = await new SourceResolver({ stdin }).resolveText("bearer-token", source);
    if (value === undefined) return undefined;
    const normalized = value.replace(/\r?\n$/, "");
    if (normalized.includes("\n")) {
      throw new InputValidationError("--bearer-token must be a single-line value");
    }
    return normalized;
  } catch (error) {
    if (error instanceof SourceResolutionError) {
      throw new InputValidationError(error.message, { cause: error });
    }
    throw error;
  }
}
