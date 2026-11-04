import z from "zod";
import { createHandler, flag, PathKey } from "../../../router";
import type { AppIO } from "../../../io";
import { regionFromArn, serviceIdFromArn } from "../../../core/arn";
import type { Core } from "../../types.tsx";
import { coreOptsFromCtx } from "../../utils.tsx";
import { JsonKey, RegionKey } from "../../keys.tsx";
import { JsonRendererKey, renderTuiAt } from "../../../tui";
import { runWithProgress } from "../../../tui/progress";
import { InputValidationError } from "../../../errors";
import { invokeHarnessTurn } from "./operation.ts";
import { HarnessInvokeLaunchContextKey } from "./launchContext";
import { harnessInvokeTargetSchema, resolveHarnessInvokeBearerToken } from "./request";

export const invokeHarnessFlags = [
  flag("id", "the ID or ARN of the harness", harnessInvokeTargetSchema),
  flag("prompt", "the message to send to the harness", z.string().optional()),
  flag(
    "user-id",
    "the end-user ID for user-scoped AgentCore Identity credentials",
    z.string().optional(),
  ),
  flag(
    "session-id",
    "the Runtime session ID to continue (33-100 characters)",
    z.string().min(33).max(100).optional(),
  ),
  flag(
    "qualifier",
    "the harness endpoint qualifier to invoke (default DEFAULT)",
    z.string().optional(),
  ),
  flag("bearer-token", "the CUSTOM_JWT bearer token", z.string().optional(), {
    sensitive: true,
  }),
] as const;

export const createInvokeHarnessHandler = (core: Core, io: AppIO) =>
  createHandler({
    name: "invoke",
    description: "invoke a harness",
    flags: invokeHarnessFlags,
    handle: async (ctx, flags) => {
      // Without a prompt, open the interactive chat at this harness — resuming
      // the given session and targeting the given qualifier when passed. The
      // one-shot CLI transcript below needs --prompt (and is the only shape
      // JSON mode supports).
      if (!flags["prompt"]) {
        if (flags["bearer-token"] !== undefined) {
          throw new InputValidationError(
            "required option '--prompt <text>' not specified with '--bearer-token'",
          );
        }
        if (ctx.require(JsonKey)) {
          throw new InputValidationError("required option '--prompt <text>' not specified");
        }
        const harnessId = serviceIdFromArn(flags["id"]);
        let path = `${ctx.require(PathKey)}/${encodeURIComponent(harnessId)}`;
        if (flags["session-id"]) path += `/${flags["session-id"]}`;
        if (flags["qualifier"]) path += `?qualifier=${encodeURIComponent(flags["qualifier"])}`;
        await renderTuiAt(
          path,
          ctx
            .withValue(HarnessInvokeLaunchContextKey, {
              harnessId,
              userId: flags["user-id"],
            })
            .withValue(RegionKey, regionFromArn(flags["id"]) ?? ctx.require(RegionKey)),
          core,
          io,
        );
        return;
      }

      const opts = {
        ...coreOptsFromCtx(ctx),
        region: regionFromArn(flags["id"]) ?? ctx.require(RegionKey),
      };
      const prompt = flags["prompt"];
      const bearerToken = await resolveHarnessInvokeBearerToken(flags["bearer-token"], io.stdin);
      const invoke = () =>
        invokeHarnessTurn(
          core.harness,
          {
            harnessId: flags["id"],
            prompt,
            qualifier: flags["qualifier"] ?? "DEFAULT",
            sessionId: flags["session-id"],
            userId: flags["user-id"],
            bearerToken,
          },
          opts,
        );
      const result = await runWithProgress(invoke, {
        io,
        label: "Invoking harness...",
        interactive: !ctx.require(JsonKey),
      });
      ctx.require(JsonRendererKey).renderJson(result);
    },
  });

export { HarnessInvokeScreen } from "./screen.tsx";
