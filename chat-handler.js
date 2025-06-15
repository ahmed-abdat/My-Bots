// Universal Gemini Chat Handler
// Works with any platform: Netlify, Vercel, AWS Lambda, etc.

/**
 * Core chat handler that works with any serverless platform
 * @param {Object} params - Request parameters
 * @param {string} params.message - User message
 * @param {Array} params.chatHistory - Chat history array
 * @param {Object} params.env - Environment variables
 * @returns {Object} Response object with reply or error
 */
async function handleGeminiChat({ message, chatHistory = [], env }) {
  try {
    // Validate environment
    const API_KEY = env.GEMINI_API_KEY;
    const MODEL_NAME = env.GEMINI_MODEL_NAME || "gemini-2.0-flash-lite";

    if (!API_KEY) {
      return {
        success: false,
        error: "API key not configured",
        statusCode: 500,
      };
    }

    // Validate input
    if (!message || message.trim() === "") {
      return {
        success: false,
        error: "Message is required",
        statusCode: 400,
      };
    }

    // Build contents for Gemini API
    const contents = [];

    // Add chat history (limit to last 10 messages for performance)
    const limitedHistory = chatHistory.slice(-10);
    for (const chat of limitedHistory) {
      if (chat.sender && chat.message) {
        contents.push({
          role: chat.sender === "user" ? "user" : "model",
          parts: [{ text: chat.message }],
        });
      }
    }

    // Add current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Prepare API request
    const requestBody = {
      contents: contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    };

    // Call Gemini API with error handling
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        await response.text()
      );
      return {
        success: false,
        error: "AI service unavailable",
        statusCode: 500,
      };
    }

    const result = await response.json();

    // Extract and validate response
    if (
      result.candidates &&
      result.candidates[0] &&
      result.candidates[0].content
    ) {
      const reply = result.candidates[0].content.parts[0].text;

      return {
        success: true,
        reply: reply,
        statusCode: 200,
      };
    } else {
      return {
        success: false,
        error: "Invalid AI response",
        statusCode: 500,
      };
    }
  } catch (error) {
    console.error("Chat handler error:", error);
    return {
      success: false,
      error: "Internal server error",
      statusCode: 500,
    };
  }
}

/**
 * Parse request body from different platforms
 * @param {*} body - Request body (string, object, or Buffer)
 * @returns {Object} Parsed request data
 */
function parseRequestBody(body) {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString());
  }
  return body; // Already parsed object
}

/**
 * Create response in universal format
 * @param {Object} result - Handler result
 * @returns {Object} HTTP response object
 */
function createResponse(result) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (result.success) {
    return {
      statusCode: result.statusCode,
      headers: headers,
      body: JSON.stringify({ reply: result.reply }),
    };
  } else {
    return {
      statusCode: result.statusCode,
      headers: headers,
      body: JSON.stringify({ error: result.error }),
    };
  }
}

// Export for different platforms
module.exports = {
  handleGeminiChat,
  parseRequestBody,
  createResponse,
};
