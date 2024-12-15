```js
const apiKey = "AIzaSyC-Aj1TmsnXKVlZJth-yL0s6tjLbPAt5D4";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

function createMessageBubble(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  createMessageBubble(userMessage, "user");
  userInput.value = "";

  const data = {
    contents: [
      {
        parts: [
          {
            text: userMessage,
          },
        ],
      },
    ],
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
      // Updated to match the correct response structure
      const botMessage =
        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't process that.";
      createMessageBubble(botMessage, "bot");
    })
    .catch((error) => {
      console.error("Error:", error);
      createMessageBubble(
        "Oops! Something went wrong. Please try again.",
        "bot"
      );
    });
}

sendButton.addEventListener("click", handleMessage);
userInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    handleMessage();
  }
});
```
