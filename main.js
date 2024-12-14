// Navbar scroll behavior
window.addEventListener("scroll", function () {
  if (window.scrollY > 50) {
    document.querySelector(".navbar").style.background =
      "rgba(11, 36, 71, 0.95)";
  } else {
    document.querySelector(".navbar").style.background = "#0B2447";
  }
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute("href")).scrollIntoView({
      behavior: "smooth",
    });
  });
});

// Animation on scroll
const observerOptions = {
  root: null,
  threshold: 0.1,
  rootMargin: "0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("animate-in");
    }
  });
}, observerOptions);

document
  .querySelectorAll(".course-card, .counter-box, .feature-icon")
  .forEach((el) => observer.observe(el));
