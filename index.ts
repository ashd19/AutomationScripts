import { GoogleGenAI } from "@google/genai";
import { $ } from "bun";

// Initialize AI
// Note: Ensure GOOGLE_API_KEY is set in your environment
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GOOGLE_API_KEY or GEMINI_API_KEY not found in environment.");
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey,  apiVersion: "v1alpha" });

async function getCommitMessage(diff: string) {
    try {
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash-exp", // or your preferred model
            contents: `Generate a concise, professional git commit message for the following changes. 
            Output ONLY the commit message text, no quotes or prefix.
            
            Diff:
            ${diff}`,
        });

        const commitMessage = response.text;
        if (!commitMessage) {
              throw new Error("AI response did not contain text content.");
        }

        return commitMessage.trim();
    } catch (error) {
        console.error("AI Generation failed:", error);
        return null;
    }
}

async function main() {
    const files = process.argv.slice(2);
    
    if (files.length === 0) {
        console.log("Usage: bun run dev <file1> <file2> ...");
        process.exit(1);
    }

    console.log(`🔍 Checking changes for: ${files.join(", ")}...`);

    try {
        // Get the diff for specified files
        const diff = await $`git diff HEAD ${files}`.text();
        
        if (!diff) {
            console.log("✨ No changes detected in specified files.");
            // Check if they are already staged
            const stagedDiff = await $`git diff --staged ${files}`.text();
            if (!stagedDiff) {
                process.exit(0);
            }
        }

        console.log("🤖 Generating commit message...");
        const commitMessage = await getCommitMessage(diff || await $`git diff --staged ${files}`.text());

        if (!commitMessage) {
            console.error("❌ Could not generate commit message.");
            process.exit(1);
        }

        console.log(`📝 Suggested Message: "${commitMessage}"`);

        // Perform Git Actions
        console.log("🚀 Performing git actions...");
        
        await $`git add ${files}`;
        await $`git commit -m ${commitMessage}`;
        
        // Optional: Ask for confirmation before pushing? 
        // For now, let's just do it as requested.
        console.log("⬆️ Pushing to remote...");
        await $`git push`;

        console.log("✅ Successfully committed and pushed!");

    } catch (error) {
        console.error("Process failed:", error);
    }
}

main();