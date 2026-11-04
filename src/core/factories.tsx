import { BedrockAgentCoreControlClient } from "@aws-sdk/client-bedrock-agentcore-control";
import { BedrockAgentCoreClient } from "@aws-sdk/client-bedrock-agentcore";
import { IAMClient } from "@aws-sdk/client-iam";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { XRayClient } from "@aws-sdk/client-xray";
import { ApplicationSignalsClient } from "@aws-sdk/client-application-signals";
import { HttpBearerAuthSigner } from "@smithy/core";
import type { TokenIdentity } from "@smithy/types";
import { InputValidationError } from "../errors";
import type {
  CreateApplicationSignalsClient,
  CreateCloudFormationClient,
  CreateControlClient,
  CreateDataClient,
  CreateIamClient,
  CreateLogsClient,
  CreateXrayClient,
} from "./types";

// createControlClient / createDataClient are the production factories injected
// into CoreClient at the app edge (src/index.ts). They live here — rather than
// inline in index.ts — so tests (the record/replay fixture layer) can reuse the
// exact same construction when talking to the live APIs in record mode.

export const createControlClient: CreateControlClient = (config) =>
  new BedrockAgentCoreControlClient({ ...config });

const HTTP_BEARER_AUTH_SCHEME = "smithy.api#httpBearerAuth";

export const createDataClient: CreateDataClient = ({ bearerToken, ...config }) => {
  if (
    bearerToken !== undefined &&
    config.endpoint !== undefined &&
    new URL(config.endpoint).protocol !== "https:"
  ) {
    throw new InputValidationError("CUSTOM_JWT requires an HTTPS endpoint");
  }
  return new BedrockAgentCoreClient(
    bearerToken === undefined
      ? config
      : {
          ...config,
          httpAuthSchemeProvider: () => [{ schemeId: HTTP_BEARER_AUTH_SCHEME }],
          httpAuthSchemes: [
            {
              schemeId: HTTP_BEARER_AUTH_SCHEME,
              identityProvider: () => async (): Promise<TokenIdentity> => ({
                token: bearerToken,
              }),
              signer: new HttpBearerAuthSigner(),
            },
          ],
        },
  );
};

export const createIamClient: CreateIamClient = (config) => new IAMClient({ ...config });

export const createLogsClient: CreateLogsClient = (config) =>
  new CloudWatchLogsClient({ ...config });

export const createXrayClient: CreateXrayClient = (config) => new XRayClient({ ...config });

export const createApplicationSignalsClient: CreateApplicationSignalsClient = (config) =>
  new ApplicationSignalsClient({ ...config });

export const createCloudFormationClient: CreateCloudFormationClient = (config) =>
  new CloudFormationClient({ ...config });
