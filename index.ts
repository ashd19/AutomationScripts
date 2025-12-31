#!/usr/bin/env bun
import { GoogleGenerativeAI } from "@google/generative-ai";
import { $ } from "bun";


const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GOOGLE_API_KEY or GEMINI_API_KEY not found in environment.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function getCommitMessage(diff: string) {
    try {
        const prompt = `Generate a concise, professional git commit message for the following changes. 
        Output ONLY the commit message text, no quotes or prefix.
        
        Diff:
        ${diff}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
            throw new Error("AI response did not contain text content.");
        }

        return text.trim();
    } catch (error: any) {
        if (error.status === 429 || error.message?.includes("429")) {
            console.error("Quota Exceeded: You've reached the Gemini API free tier limit. Please wait a moment and try again.");
        } else {
            console.error("AI Generation failed:", error.message || error);
        }
        return null;
    }
}

async function main() {
    const files = process.argv.slice(2);
    
    if (files.length === 0) {
        console.log("Usage: gitx <file1> <file2> ...");
        process.exit(1);
    }

    console.log(`Checking changes for: ${files.join(", ")}...`);

    try {
        // Get the diff for specified files
        const diff = await $`git diff HEAD ${files}`.text();
        
        if (!diff) {
            console.log("No changes detected in specified files.");
            // Check if they are already staged
            const stagedDiff = await $`git diff --staged ${files}`.text();
            if (!stagedDiff) {
                process.exit(0);
            }
        }

        console.log("Generating commit message...");
        const commitMessage = await getCommitMessage(diff || await $`git diff --staged ${files}`.text());

        if (!commitMessage) {
            console.error("❌ Could not generate commit message.");
            process.exit(1);
        }

        console.log(`Suggested Message: "${commitMessage}"`);

     
        console.log("Performing git actions...");
        
        await $`git add ${files}`;
        await $`git commit -m ${commitMessage}`;
        
        console.log("Pushing to remote...");
        await $`git push`;

        console.log("Successfully committed and pushed!");

    } catch (error) {
        console.error("Process failed:", error);
    }
}

main();