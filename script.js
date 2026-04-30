// This function watches for elements with the 'reveal' class
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // Add the 'active' class when the element is visible
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1 // Triggers when 10% of the element is visible
});

// Tell the observer to watch all elements with the 'reveal' class
const revealElements = document.querySelectorAll('.reveal');
revealElements.forEach((el) => observer.observe(el));