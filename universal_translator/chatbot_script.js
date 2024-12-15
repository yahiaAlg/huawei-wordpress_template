const apiKey = "AIzaSyC-Aj1TmsnXKVlZJth-yL0s6tjLbPAt5D4";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

// Configure marked options immediately since scripts are already loaded
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
});

// Configure marked options
function configureMarked() {
  marked.setOptions({
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
  });
}

// Wait for marked and hljs to load
function waitForDependencies() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.marked && window.hljs) {
        configureMarked();
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

let conversationHistory = [];

function createMessageBubble(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble markdown-content";

  // Parse markdown and render HTML directly
  bubble.innerHTML = marked.parse(text);
  // Apply syntax highlighting to code blocks
  bubble.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });

  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addToHistory(role, text) {
  conversationHistory.push({
    role: role,
    text: text,
  });

  const maxHistoryLength = 10;
  if (conversationHistory.length > maxHistoryLength) {
    conversationHistory = conversationHistory.slice(-maxHistoryLength);
  }
}

function formatHistoryForAPI() {
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: conversationHistory
            .map((msg) => {
              const rolePrefix = msg.role === "user" ? "User: " : "Assistant: ";
              return `${rolePrefix}${msg.text}`;
            })
            .join("\n"),
        },
      ],
    },
  ];

  return contents;
}

function handleMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  createMessageBubble(userMessage, "user");
  addToHistory("user", userMessage);
  userInput.value = "";

  const data = {
    contents: formatHistoryForAPI(),
  };

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((result) => {
      const botMessage =
        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't process that.";

      createMessageBubble(botMessage, "bot");
      addToHistory("assistant", botMessage);

      if (!document.getElementById("clear-history")) {
        addClearHistoryButton();
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      const errorMessage = "Oops! Something went wrong. Please try again.";
      createMessageBubble(errorMessage, "bot");
      addToHistory("assistant", errorMessage);
    });
}

function addClearHistoryButton() {
  const clearButton = document.createElement("button");
  clearButton.id = "clear-history";
  clearButton.textContent = "Clear Chat History";
  clearButton.className = "clear-history-btn";
  clearButton.addEventListener("click", clearHistory);

  // Add button above the chat messages
  chatMessages.parentElement.insertBefore(clearButton, chatMessages);

  // Add CSS for the button
  const style = document.createElement("style");
  style.textContent = `
    .clear-history-btn {
      margin: 10px;
      padding: 8px 16px;
      background-color: #ff4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .clear-history-btn:hover {
      background-color: #cc0000;
    }
  `;
  document.head.appendChild(style);
}

function clearHistory() {
  conversationHistory = [];
  chatMessages.innerHTML = "";
  if (document.getElementById("clear-history")) {
    document.getElementById("clear-history").remove();
  }
}

sendButton.addEventListener("click", handleMessage);
userInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    handleMessage();
  }
});
