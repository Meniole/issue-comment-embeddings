import { Octokit } from "@octokit/rest";
import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { isIssueCommentEvent, isIssueEvent } from "./types/typeguards";
import { LogLevel, Logs } from "@ubiquity-dao/ubiquibot-logger";
import { Database } from "./types/database";
import { createAdapters } from "./adapters";
import { createClient } from "@supabase/supabase-js";
import { addComments } from "./handlers/add-comments";
import { updateComment } from "./handlers/update-comments";
import { deleteComment } from "./handlers/delete-comments";
import { VoyageAIClient } from "voyageai";
import { deleteIssues } from "./handlers/delete-issue";
import { addIssue } from "./handlers/add-issue";
import { updateIssue } from "./handlers/update-issue";

/**
 * The main plugin function. Split for easier testing.
 */
export async function runPlugin(context: Context) {
  const { logger, eventName } = context;
  if (isIssueCommentEvent(context)) {
    switch (eventName) {
      case "issue_comment.created":
        return await addComments(context);
      case "issue_comment.deleted":
        return await deleteComment(context);
      case "issue_comment.edited":
        return await updateComment(context);
    }
  } else if (isIssueEvent(context)) {
    switch (eventName) {
      case "issues.opened":
        return await addIssue(context);
      case "issues.deleted":
        return await deleteIssues(context);
      case "issues.edited":
        return await updateIssue(context);
    }
  } else {
    logger.error(`Unsupported event: ${eventName}`);
  }
  logger.ok(`Exiting plugin`);
}

/**
 * How a worker executes the plugin.
 */
export async function plugin(inputs: PluginInputs, env: Env) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY);
  const voyageClient = new VoyageAIClient({
    apiKey: env.VOYAGEAI_API_KEY,
  });
  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    env,
    logger: new Logs("info" as LogLevel),
    adapters: {} as ReturnType<typeof createAdapters>,
  };
  context.adapters = createAdapters(supabase, voyageClient, context);
  if (isIssueEvent(context)) {
    return await runPlugin(context);
  }
}
