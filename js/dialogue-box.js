const fullText = "Hello there! This is a cozy dialogue box with that warm, comforting aesthetic. Feel free to customize the text and styling to match your needs!";
const textElement = document.getElementById('text');
let charIndex = 0;
let typingInterval;

function typeWriter() {
    if (charIndex < fullText.length) {
        textElement.textContent = fullText.substring(0, charIndex + 1);
        charIndex++;
    } else {
        clearInterval(typingInterval);
        textElement.innerHTML = fullText + '<span class="cursor"></span>';
    }
}

function startTyping() {
    charIndex = 0;
    textElement.textContent = '';
    typingInterval = setInterval(typeWriter, 50);
}

function restartAnimation() {
    clearInterval(typingInterval);
    startTyping();
}

// Start typing on load
startTyping();