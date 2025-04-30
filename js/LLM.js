function update() {
  const currentHash = window.location.hash;
  console.log("update() called. Current hash:", currentHash);

  if (currentHash) {
    const linksToUpdate = document.querySelectorAll('.back');
    console.log(`Found ${linksToUpdate.length} links to update.`);

    linksToUpdate.forEach(link => {
      let baseHref = link.getAttribute('href').split('#')[0];
      console.log(`Updating link from '${link.getAttribute('href')}' to '${baseHref}${currentHash}'`);
      link.setAttribute('href', `${baseHref}${currentHash}`);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed.");
  update();

  const input = document.getElementById('userInput');
  const button = document.querySelector('button');

  if (!input || !button) {
    console.warn("Input or button element not found!");
    return;
  }

  button.addEventListener('click', () => {
    console.log("Button clicked.");
    sendMessage();
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      console.log("Enter key pressed in input.");
      event.preventDefault();
      sendMessage();
    }
  });

  loadHistory();
});

async function sendMessage() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  console.log("sendMessage() called with message:", message);

  if (!message) {
    console.log("Message is empty. Aborting send.");
    return;
  }

  input.value = '';

  try {
    const res = await fetch('https://10.30.35.83:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    console.log("Received response from server:", data);

    if (message.toLowerCase() === "reset") {
      console.log("Reset command detected. Clearing messages.");
      clearMessages();
    }

    await loadHistory();
  } catch (error) {
    console.error("Error in sendMessage():", error);
  }
}

function appendMessage(sender, text, className) {
  console.log(`Appending message from ${sender}: ${text}`);
  const msgContainer = document.getElementById('llmessages');
  const div = document.createElement('div');
  div.className = `llmessage ${className}`;
  div.textContent = `${sender}: ${text}`;
  msgContainer.appendChild(div);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function clearMessages() {
  console.log("Clearing all messages.");
  const msgContainer = document.getElementById('llmessages');
  msgContainer.innerHTML = '';
}

async function loadHistory() {
  console.log("loadHistory() called.");
  try {
    const res = await fetch('https://10.30.35.83:8000/history');
    const history = await res.json();
    console.log("Loaded history:", history);

    const msgContainer = document.getElementById('llmessages');
    msgContainer.innerHTML = ''; // Clear current messages

    history.forEach(entry => {
      appendMessage('You', entry.user, 'lluser');
      appendMessage('Bot', entry.ai, 'llbot');
    });
  } catch (error) {
    console.error("Error loading history:", error);
  }
}
