class UniversalTranslator {
  constructor(geminiApiKey) {
    this.cache = this.loadCache();
    this.currentLang = "en";
    this.originalTexts = new WeakMap();
    this.pendingRequests = new Map();
    this.batchSize = 5; // Reduced from 10 to prevent quota exhaustion
    this.maxConcurrentRequests = 2;
    this.debounceTimeout = null;
    this.geminiApiKey = geminiApiKey;
    // Rate limiting properties
    this.requestQueue = [];
    this.isProcessing = false;
    this.rateLimitDelay = 1000; // 1 second between requests
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds before retry
    this.lastRequestTime = 0;
    this.init();
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processRequestQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];

      // Ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitDelay) {
        await this.delay(this.rateLimitDelay - timeSinceLastRequest);
      }

      try {
        const result = await this.makeRequest(request);
        request.resolve(result);
        this.lastRequestTime = Date.now();
        this.requestQueue.shift();
      } catch (error) {
        if (error.code === 429 && request.retries < this.maxRetries) {
          request.retries++;
          await this.delay(this.retryDelay * request.retries);
          continue;
        }
        request.reject(error);
        this.requestQueue.shift();
      }
    }

    this.isProcessing = false;
  }

  async makeRequest(request) {
    const response = await fetch(request.url, request.options);
    if (!response.ok) {
      const error = await response.json();
      throw error;
    }
    return response.json();
  }

  queueRequest(url, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve,
        reject,
        retries: 0,
      });
      this.processRequestQueue();
    });
  }

  async detectLanguage(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.geminiApiKey}`;

    const prompt = {
      contents: [
        {
          parts: [
            {
              text: `Detect the language of the following text and return only the ISO 639-1 language code (e.g., 'en' for English, 'ar' for Arabic, etc.). Do not include any other text or explanation in your response.\n\nText to analyze:\n"${text}"`,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prompt),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const detectedLang =
        result?.candidates?.[0]?.content?.parts?.[0]?.text
          ?.trim()
          .toLowerCase() || this.currentLang;

      return detectedLang;
    } catch (e) {
      console.error("Language detection failed:", e);
      return this.currentLang; // fallback to current language if detection fails
    }
  }

  getCurrentLanguage() {
    return this.currentLang;
  }

  init() {
    this.createButton();
    this.loadUserPreference();
    document.addEventListener("DOMContentLoaded", () =>
      this.observeDOMChanges()
    );
  }

  async toggleTranslation() {
    const btn = document.querySelector(".translator-btn");
    btn.setAttribute("aria-busy", "true");

    try {
      // Sample text to detect current page language
      const sampleText = document.body.textContent.substring(0, 100);
      const detectedLang = await this.detectLanguage(sampleText);

      // Determine target language based on detected language
      const targetLang = detectedLang === "ar" ? "en" : "ar";

      await this.translatePage(targetLang);
      this.currentLang = targetLang;

      // Update document direction
      this.updateDocumentDirection(targetLang);

      localStorage.setItem("preferredLanguage", targetLang);
    } catch (e) {
      console.error("Translation failed:", e);
      this.showError("Translation failed. Please try again.");
    } finally {
      btn.setAttribute("aria-busy", "false");
    }
  }

  updateDocumentDirection(lang) {
    const isRTL = lang === "ar";
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");

    // Update CSS for RTL/LTR support
    const style = document.createElement("style");
    style.textContent = `
      body {
        direction: ${isRTL ? "rtl" : "ltr"};
        text-align: ${isRTL ? "right" : "left"};
      }
      
      .translator-btn {
        ${isRTL ? "left" : "right"}: 20px;
      }
      
      /* Additional RTL/LTR specific styles */
      .pricing-card,
      .testimonial-card,
      .feature-card {
        direction: ${isRTL ? "rtl" : "ltr"};
      }
      
      /* Adjust margins and paddings for RTL */
      [dir="rtl"] .ms-auto {
        margin-left: unset !important;
        margin-right: auto !important;
      }
      
      [dir="rtl"] .me-auto {
        margin-right: unset !important;
        margin-left: auto !important;
      }
    `;

    // Remove previous dynamic styles if they exist
    const previousStyle = document.getElementById("dynamic-direction-styles");
    if (previousStyle) {
      previousStyle.remove();
    }

    style.id = "dynamic-direction-styles";
    document.head.appendChild(style);
  }

  async translateBatch(nodes, targetLang) {
    const textsToTranslate = nodes.map((node) => {
      const text = node.textContent.trim();
      if (!this.originalTexts.has(node)) {
        this.originalTexts.set(node, text);
      }
      return text;
    });

    const translations = await this.getTranslations(
      textsToTranslate,
      targetLang
    );

    nodes.forEach((node, index) => {
      if (translations[index]) {
        const translatedText = translations[index];
        // Detect language and set text alignment accordingly
        this.detectLanguage(translatedText).then((detectedLang) => {
          const isRTL = detectedLang === "ar";
          node.style.direction = isRTL ? "rtl" : "ltr";
          node.style.textAlign = isRTL ? "right" : "left";
          node.textContent = translatedText;
        });
      }
    });
  }

  createButton() {
    const btn = document.createElement("button");
    btn.className = "translator-btn";
    btn.setAttribute("aria-label", "Translate Page");
    btn.innerHTML = `
                    <div class="lang-icon">EN</div>
                    <div class="lang-icon">ع</div>
                    <div class="spinner"></div>
                `;

    btn.addEventListener("click", () => this.toggleTranslation());
    document.body.appendChild(btn);
  }

  loadCache() {
    try {
      return JSON.parse(localStorage.getItem("translationCache")) || {};
    } catch (e) {
      return {};
    }
  }

  saveCache() {
    try {
      localStorage.setItem("translationCache", JSON.stringify(this.cache));
    } catch (e) {
      console.error("Cache storage failed:", e);
    }
  }

  loadUserPreference() {
    const savedLang = localStorage.getItem("preferredLanguage");
    if (savedLang && savedLang !== "en") {
      this.toggleTranslation();
    }
  }

  async toggleTranslation() {
    const targetLang = this.currentLang === "en" ? "ar" : "en";
    const btn = document.querySelector(".translator-btn");

    try {
      btn.setAttribute("aria-busy", "true");
      await this.translatePage(targetLang);
      this.currentLang = targetLang;
      document.documentElement.setAttribute(
        "dir",
        targetLang === "ar" ? "rtl" : "ltr"
      );
      localStorage.setItem("preferredLanguage", targetLang);
    } catch (e) {
      console.error("Translation failed:", e);
      this.showError("Translation failed. Please try again.");
    } finally {
      btn.setAttribute("aria-busy", "false");
    }
  }

  async translatePage(targetLang) {
    const textNodes = this.collectTextNodes(document.body);
    const batches = this.createBatches(textNodes, this.batchSize);

    for (const batch of batches) {
      await this.translateBatch(batch, targetLang);
    }
  }

  collectTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (
          parent.tagName === "SCRIPT" ||
          parent.tagName === "STYLE" ||
          parent.tagName === "META"
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    return textNodes;
  }

  createBatches(items, size) {
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  async translateBatch(nodes, targetLang) {
    const textsToTranslate = nodes.map((node) => {
      const text = node.textContent.trim();
      if (!this.originalTexts.has(node)) {
        this.originalTexts.set(node, text);
      }
      return text;
    });

    const translations = await this.getTranslations(
      textsToTranslate,
      targetLang
    );

    nodes.forEach((node, index) => {
      if (translations[index]) {
        node.textContent = translations[index];
      }
    });
  }

  async getTranslations(texts, targetLang) {
    const uncachedTexts = texts.filter(
      (text) => !this.cache[`${text}_${targetLang}`]
    );

    if (uncachedTexts.length > 0) {
      const chunks = this.createBatches(
        uncachedTexts,
        Math.ceil(uncachedTexts.length / this.maxConcurrentRequests)
      );
      const translations = [];

      for (const chunk of chunks) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.geminiApiKey}`;

          const data = {
            contents: [
              {
                parts: [
                  {
                    text: `Instructions: Translate each text segment from ${
                      this.currentLang
                    } to ${targetLang}. 
                         Provide ONLY the direct translations with no explanations, notes, or commentary.
                         Return ONLY the translated text, exactly one translation per line.
                         DO NOT add any additional text, markers, or explanations.
                         Texts to translate:\n${chunk.join("\n---\n")}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1, // Lower temperature for more consistent outputs
              topP: 0.1, // Lower top_p for more focused responses
              topK: 1, // Restrict to most likely tokens
            },
          };

          const result = await this.queueRequest(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });

          let translatedChunk =
            result?.candidates?.[0]?.content?.parts?.[0]?.text?.split(
              "\n---\n"
            ) || chunk;

          // Clean up any potential commentary or markers
          translatedChunk = translatedChunk.map((text) => {
            return text
              .trim()
              .replace(/^[-*•]/g, "") // Remove bullet points
              .replace(/^Translation:?\s*/i, "") // Remove "Translation:" prefix
              .replace(/^\d+\.\s*/, "") // Remove numbered lists
              .replace(/^["']|["']$/g, "") // Remove quotes
              .trim();
          });

          translations.push(...translatedChunk);

          // Cache the results
          chunk.forEach((text, index) => {
            this.cache[`${text}_${targetLang}`] = translatedChunk[index];
          });
        } catch (e) {
          console.error("Translation chunk failed:", e);
          translations.push(...chunk);
        }
      }

      this.saveCache();
      return texts.map((text) => this.cache[`${text}_${targetLang}`] || text);
    }

    return texts.map((text) => this.cache[`${text}_${targetLang}`] || text);
  }

  observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      if (this.currentLang !== "en") {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
          this.translatePage(this.currentLang);
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  /*


curl \
  -H "Content-Type: application/json" \
  -d "{\"contents\":[{\"parts\":[{\"text\":\"Explain how AI works\"}]}]}" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyC-Aj1TmsnXKVlZJth-yL0s6tjLbPAt5D4"


*/
  showError(message) {
    const error = document.createElement("div");
    error.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #ff4444;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 10000;
                `;
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
  }
}
