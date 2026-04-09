    const WORKER_BASE = "https://swpartfetch.bbourne1104.workers.dev";

    async function fetchPart(productUrl) {
    const apiUrl = `${WORKER_BASE}/?url=${encodeURIComponent(productUrl)}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
    }

    function renderPart(part, targetId) {
    const container = document.getElementById(targetId);

    if (!container) {
        console.error(`No element found with id "${targetId}"`);
        return;
    }

    container.innerHTML = `
        <div class="part-card">
        ${
            part.imageUrl
            ? `<img src="${part.imageUrl}" alt="${part.name || "Part image"}" class="part-image">`
            : ""
        }
        <h3>${part.name || "Unknown part"}</h3>
        <p><strong>Part #:</strong> ${part.partNumber || "N/A"}</p>
        <p>
            <a href="${part.sourceUrl}" target="_blank" rel="noopener noreferrer">
            View source page
            </a>
        </p>
        </div>
    `;
    }

    async function loadPart(productUrl, targetId) {
    try {
        const part = await fetchPart(productUrl);
        renderPart(part, targetId);
    } catch (error) {
        console.error(error);

        const container = document.getElementById(targetId);
        if (container) {
        container.innerHTML = `<p>Failed to load part data.</p>`;
        }
    }
    }