class EmailService {
  constructor() {
    this.PUBLIC_KEY = "PD1zox9xtV3d0Qs6-";
    this.SERVICE_ID = "service_ydo1xhm"; // Replace with your service ID
    this.TEMPLATE_ID = "template_idlzfmb"; // Replace with your template ID
    this.debugMode = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.rateLimit = {
      attempts: 0,
      lastAttempt: 0,
      maxAttempts: 5,
      timeWindow: 60000, // 1 minute
    };

    this.init();
  }

  init() {
    emailjs.init(this.PUBLIC_KEY);
    this.attachEventListeners();
  }

  attachEventListeners() {
    const form = document.getElementById("contactForm");
    form.addEventListener("submit", this.handleSubmit.bind(this));
  }

  sanitizeInput(input) {
    return input.replace(/<[^>]*>/g, "").trim();
  }

  validateForm(formData) {
    const errors = [];

    if (!formData.name || formData.name.length < 2) {
      errors.push("Name must be at least 2 characters long");
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push("Please enter a valid email address");
    }

    if (!formData.message || formData.message.length < 10) {
      errors.push("Message must be at least 10 characters long");
    }

    return errors;
  }

  checkRateLimit() {
    const now = Date.now();
    if (now - this.rateLimit.lastAttempt > this.rateLimit.timeWindow) {
      this.rateLimit.attempts = 0;
    }

    if (this.rateLimit.attempts >= this.rateLimit.maxAttempts) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    this.rateLimit.attempts++;
    this.rateLimit.lastAttempt = now;
  }

  async sendEmail(templateParams, attempt = 1) {
    try {
      this.checkRateLimit();

      const response = await emailjs.send(
        this.SERVICE_ID,
        this.TEMPLATE_ID,
        templateParams
      );

      if (this.debugMode) {
        console.log("Email sent successfully:", response);
      }

      return response;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.sendEmail(templateParams, attempt + 1);
      }
      throw error;
    }
  }

  async handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector("#submitButton");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const successMessage = document.getElementById("successMessage");
    const errorMessage = document.getElementById("errorMessage");

    // Reset messages
    successMessage.textContent = "";
    errorMessage.textContent = "";

    // Get form data
    const formData = {
      name: this.sanitizeInput(form.name.value),
      email: this.sanitizeInput(form.email.value),
      message: this.sanitizeInput(form.message.value),
    };

    // Validate form
    const validationErrors = this.validateForm(formData);
    if (validationErrors.length > 0) {
      errorMessage.textContent = validationErrors.join(". ");
      return;
    }

    try {
      // Show loading state
      submitButton.disabled = true;
      loadingIndicator.classList.remove("d-none");

      // Prepare template parameters
      const templateParams = {
        to_name: "UFAS 1 Huawei-ICT team",
        to_mail: "ufas1.huawei.ict@gmail.com",
        from_name: formData.name,
        from_mail: formData.email,
        message: formData.message,
        reply_to: formData.email,
      };

      // Send email
      await this.sendEmail(templateParams);

      // Show success message
      successMessage.textContent = "Message sent successfully!";
      form.reset();
    } catch (error) {
      // Show error message
      errorMessage.textContent =
        "Failed to send message. Please try again later.";
      if (this.debugMode) {
        console.error("Email error:", error);
      }
    } finally {
      // Reset loading state
      submitButton.disabled = false;
      loadingIndicator.classList.add("d-none");
    }
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
}

// Initialize email service
const emailService = new EmailService();
