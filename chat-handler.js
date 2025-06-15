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
    // Environment variable validation with clean logging
    const API_KEY = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const PRIMARY_MODEL =
      env?.GEMINI_MODEL_NAME ||
      process.env.GEMINI_MODEL_NAME ||
      "gemini-2.5-flash-preview-05-20";
    const FALLBACK_MODEL = "gemini-2.0-flash-lite";

    console.log("🤖 AI Chat initialized with model:", PRIMARY_MODEL);

    if (!API_KEY) {
      console.error("❌ API key not found in environment variables");
      return {
        success: false,
        error:
          "API key not configured. Please check your environment variables.",
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

    // Prepare API request with proper system instruction
    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [
          {
            text: `أنت مساعد ذكي متقدم تم تطويرك من قبل أحمد عبدات (Ahmed Abdat)، مطور ويب متخصص في Next.js وReact وتقنيات الويب الحديثة من موريتانيا. 

موقعه الشخصي: https://ahmedabdat.com

قدراتك المتقدمة:
- البحث في الويب والحصول على معلومات حديثة
- البحث في الأوراق العلمية والبحثية  
- الوصول إلى مكتبات البرمجة والتوثيق التقني
- تحليل الشركات والمعلومات التجارية
- البحث في GitHub وLinkedIn وWikipedia

قواعد مهمة جداً:
- تحدث بالحسانية (اللهجة الموريتانية) كلغة أساسية ومفضلة للتفاعل
- يمكنك أيضاً التحدث بالعربية الفصحى أو الفرنسية حسب طلب المستخدم
- لا تتحدث بالإنجليزية نهائياً - فقط الحسانية والعربية والفرنسية
- ابدأ دائماً المحادثات بالحسانية واستمر بها إلا إذا طلب المستخدم لغة أخرى
- كن مفيداً ومهذباً ومرحباً بالطريقة الموريتانية التقليدية
- عندما يسألك أحد عن من طورك، أجب بالحسانية أنك تم تطويرك من قبل أحمد عبدات من موريتانيا
- لا تذكر المطور في المحادثة إلا إذا سُئلت عنه مباشرة
- قدم إجابات دقيقة ومفصلة حسب الحاجة بالحسانية أولاً
- إذا احتجت معلومات حديثة، استخدم قدرات البحث المتاحة لك
- اذكر مصادر المعلومات عند استخدام البحث الخارجي

تذكر: الحسانية هي لغتك الأساسية والمفضلة للتفاعل مع جميع المستخدمين`,
          },
        ],
      },
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    };

    // Function to try API call with a specific model
    async function tryApiCall(modelName) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`Model ${modelName} failed: ${response.status}`);
      }

      return response;
    }

    let response;
    let usedModel = PRIMARY_MODEL;

    try {
      // Try primary model first
      console.log(`Attempting to use primary model: ${PRIMARY_MODEL}`);
      response = await tryApiCall(PRIMARY_MODEL);
    } catch (primaryError) {
      console.warn(
        `Primary model ${PRIMARY_MODEL} failed:`,
        primaryError.message
      );

      try {
        // Fallback to secondary model
        console.log(`Falling back to model: ${FALLBACK_MODEL}`);
        response = await tryApiCall(FALLBACK_MODEL);
        usedModel = FALLBACK_MODEL;
      } catch (fallbackError) {
        console.error(
          `Both models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
        );
        return {
          success: false,
          error:
            "AI service unavailable - both primary and fallback models failed",
          statusCode: 500,
        };
      }
    }

    const result = await response.json();

    // Extract and validate response
    if (
      result.candidates &&
      result.candidates[0] &&
      result.candidates[0].content
    ) {
      const reply = result.candidates[0].content.parts[0].text;

      console.log(`Successfully used model: ${usedModel}`);
      return {
        success: true,
        reply: reply,
        statusCode: 200,
        modelUsed: usedModel, // Include which model was used for debugging
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
