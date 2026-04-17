/**
 * Normative branch-B → BootstrapPackInput mapping (registry-draft SSOT).
 */
export function normalizeOpenAiToolCallsToBootstrapPackInput(envelope: {
  workflowId: string;
  tool_calls: unknown[];
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    workflowId: envelope.workflowId,
    openaiChatCompletion: {
      choices: [
        {
          message: {
            tool_calls: JSON.parse(JSON.stringify(envelope.tool_calls)) as unknown[],
          },
        },
      ],
    },
  };
}
