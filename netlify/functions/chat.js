// Load environment variables from .env file for local development
try {
  require("dotenv").config({ path: "../../.env" });
  console.log("✅ Environment loaded from .env file");
} catch (error) {
  console.warn("⚠️ Could not load .env file:", error.message);
}

// Netlify function wrapper for universal chat handler
const {
  handleGeminiChat,
  parseRequestBody,
  createResponse,
} = require("../../chat-handler");

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse request body
    const { message, chatHistory } = parseRequestBody(event.body);

    // Enhanced environment passing - use process.env directly
    console.log(
      "🔑 Environment variables loaded:",
      Object.keys(process.env).filter((key) => key.includes("GEMINI"))
    );

    // Call universal handler
    const result = await handleGeminiChat({
      message,
      chatHistory,
      env: process.env,
    });

    // Return response
    return createResponse(result);
  } catch (error) {
    console.error("Netlify function error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
