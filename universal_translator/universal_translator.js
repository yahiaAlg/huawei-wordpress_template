class UniversalTranslator {
  constructor() {
    this.cache = this.loadCache();
    this.currentLang = "en";
    this.originalTexts = new WeakMap();
    this.pendingRequests = new Map();
    this.batchSize = 10;
    this.debounceTimeout = null;
    this.apiEndpoint = "https://libretranslate.com";

    this.init();
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
      try {
        const formData = new FormData();
        formData.append("q", uncachedTexts.join("\n"));
        formData.append("source", this.currentLang);
        formData.append("target", targetLang);
        formData.append("format", "text");

        const response = await fetch(`${this.apiEndpoint}/translate`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Translation API failed");
        }

        const data = await response.json();
        const translatedTexts = data.translatedText.split("\n");

        uncachedTexts.forEach((text, index) => {
          this.cache[`${text}_${targetLang}`] = translatedTexts[index];
        });
        this.saveCache();
      } catch (e) {
        console.error("Translation API error:", e);
        throw e;
      }
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
