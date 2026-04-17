import { api } from "./_generated/api";
import { defineMcpServer, tool } from "@vibeflowai/convex-mcp";

export const mcp = defineMcpServer({
  name: "voice-linkedin-mcp",
  version: "0.1.0",
  tools: {
    voiceToLinkedInPost: tool(api.voiceToLinkedInPost.voiceToLinkedInPostAction, {
      kind: "action",
      description: "Convert voice note into LinkedIn post",
      args: (z) => ({ 
        filePath: z.string().describe("Path to the audio file") 
      }),
    }),
    
    parseOutreachRequest: tool(api.parseOutreachRequest.parseOutreachRequestAction, {
      kind: "action",
      description: "Parse outreach intent from transcript or audio. Returns transcript, target role, location, and constraints.",
      args: (z) => ({
        transcript: z.string().optional().describe("Optional plain-text transcript"),
        audioFilePath: z.string().optional().describe("Optional audio path to transcribe"),
        maxEmails: z.number().optional().describe("Optional cap for downstream send step"),
      }),
    }),
    
    generateVoiceAssets: tool(api.generateVoiceAssets.generateVoiceAssetsAction, {
      kind: "action",
      description: "Generate reusable outreach voice assets (pitch and speaking script) from parsed intent.",
      args: (z) => ({
        transcript: z.string().describe("Source transcript"),
        targetRole: z.string().optional().describe("Parsed role target"),
        location: z.string().optional().describe("Parsed location"),
      }),
    }),
    
    matchRecruiters: tool(api.matchRecruiters.matchRecruitersAction, {
      kind: "action",
      description: "Match recruiters by role and location using local recruiter dataset.",
      args: (z) => ({
        targetRole: z.string().describe("Role target for filtering"),
        location: z.string().describe("Location target for filtering"),
        limit: z.number().optional().describe("Optional max matches to return"),
      }),
    }),
    
    draftOutreachEmail: tool(api.draftOutreachEmail.draftOutreachEmailAction, {
      kind: "action",
      description: "Draft outreach email subject/body for a selected recruiter using parsed intent and optional pitch/script.",
      args: (z) => ({
        recruiter: z.object({
          name: z.string(),
          company: z.string(),
          email: z.string(),
          location: z.string(),
          focus: z.string(),
        }).describe("Selected recruiter object"),
        targetRole: z.string().describe("Role target"),
        location: z.string().describe("Location target"),
        personalizedPitch: z.string().optional().describe("Optional generated pitch text"),
        audioScript: z.string().optional().describe("Optional generated script text"),
      }),
    }),
    
    sendOutreachEmail: tool(api.sendOutreachEmail.sendOutreachEmailAction, {
      kind: "action",
      description: "Send a drafted outreach email through AgentMail and return send status.",
      args: (z) => ({
        inboxId: z.string().describe("AgentMail inbox ID"),
        toEmail: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body"),
        dryRun: z.boolean().optional().describe("If true, skips actual send"),
      }),
    }),
    
    runOutreachPipeline: tool(api.runOutreachPipeline.runOutreachPipelineAction, {
      kind: "action",
      description: "Run the complete modular outreach pipeline and return VibeFlow-style execution steps.",
      args: (z) => ({
        transcript: z.string().optional().describe("Optional transcript text"),
        audioFilePath: z.string().optional().describe("Optional audio path for transcription"),
        inboxId: z.string().optional().describe("AgentMail inbox ID (required when dryRun is false)"),
        dryRun: z.boolean().optional().describe("If true, skip sending emails"),
        maxEmails: z.number().optional().describe("Max matched recruiters to send to"),
        includeFlow: z.boolean().optional().describe("Include flow graph in the response"),
      }),
    }),
    
    debugEcho: tool(api.debugEcho.debugEchoAction, {
      kind: "action",
      description: "Returns sample flow JSON (nodes, edges) for testing flow-viewer paste/parse. No side effects.",
      args: (z) => ({}),
    }),
    
    exportOutreachPipelineFlow: tool(api.exportOutreachPipelineFlow.exportOutreachPipelineFlowAction, {
      kind: "action",
      description: "Returns VibeFlow-compatible outreach pipeline JSON with modular parsing, voice generation, matching, and email-send nodes.",
      args: (z) => ({}),
    }),
  },
});
