document.addEventListener("DOMContentLoaded", function() {
    const pages = document.querySelectorAll('.slider');
    let currentPage = 0;

    function updateTransforms() {
        pages.forEach((page, index) => {
            const offset = index - currentPage;
            page.style.transform = `translateX(${offset * 100}%)`;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll('.sidebarl').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(link.getAttribute('data-target'), 10);
            if (!isNaN(targetIndex)) {
                currentPage = targetIndex;
                updateTransforms();
            }
        });
    });

    updateTransforms();

    window.addEventListener('load', () => {
        if (window.location.hash) {
            history.replaceState(null, null, ' ');
        }
    });

    requestAnimationFrame(() => {
        const base = document.querySelector('.base');
        if (base) {
            base.classList.add('ready');
        }
    });

    const copyElements = document.querySelectorAll(".copytext");
    copyElements.forEach(function(element) {
        element.addEventListener("click", function(event) {
            event.preventDefault();
            const textToCopy = this.getAttribute("data-target");
            if (!textToCopy) return;

            const textarea = document.createElement("textarea");
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();

            try {
                document.execCommand("copy");
                this.style.backgroundColor = "#131A23";
                setTimeout(() => {
                    this.style.backgroundColor = "";
                }, 200);
            } catch (err) {
                console.error("Failed to copy text: ", err);
            } finally {
                document.body.removeChild(textarea);
            }
        });
    });

    const fullscreenimage = document.querySelectorAll('.imgfs');
    const imhead = document.getElementById('imghead');

    fullscreenimage.forEach(image => {
        image.addEventListener('click', () => {
            const duplicate = image.cloneNode(true);
            const underlay = document.getElementById('imgund');

            duplicate.classList.add('fs');
            duplicate.classList.remove('images');

            document.body.appendChild(duplicate);

            if (underlay) {
                underlay.style.display = 'block';
            }

            duplicate.addEventListener('click', () => {
                document.body.removeChild(duplicate);
                if (underlay) underlay.style.display = 'none';
                if (imhead) imhead.style.display = 'none';
            });

            if (underlay) {
                underlay.addEventListener('click', () => {
                    if (document.body.contains(duplicate)) {
                        document.body.removeChild(duplicate);
                    }
                    underlay.style.display = 'none';
                    if (imhead) imhead.style.display = 'none';
                }, { once: true });
            }
        });
    });

    // =========================
    // Parts area
    // =========================

    const WORKER_BASE = "https://swpartfetch.bbourne1104.workers.dev";
    const partsList = document.getElementById("parts-list");
    const addPartRowButton = document.getElementById("add-part-row");

    async function fetchPart(partNumber) {
        const apiUrl = `${WORKER_BASE}/?part=${encodeURIComponent(partNumber)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    }

    function renderPart(resultEl, part) {
        resultEl.innerHTML = `
            ${part.imageUrl ? `<img src="${part.imageUrl}" alt="${part.name || "Part image"}" class="part-image">` : ""}
            <h2 class="seconded">${part.name || "Unknown part"}</h2>
            <p class="medium"><strong>Part #:</strong> ${part.partNumber || "N/A"}</p>
            <p class="medium">
                <a href="${part.sourceUrl}" target="_blank" rel="noopener noreferrer">View source page</a>
            </p>
        `;
    }

    function getAllPartValues() {
        return Array.from(document.querySelectorAll(".part-input"))
            .map(input => input.value.trim())
            .filter(Boolean);
    }

    function updatePartsInUrl() {
        const values = getAllPartValues();
        const url = new URL(window.location.href);

        if (values.length > 0) {
            url.searchParams.set("parts", values.join(","));
        } else {
            url.searchParams.delete("parts");
        }

        history.replaceState({}, "", url.toString());
    }

    async function loadPartIntoRow(partNumber, resultEl) {
        resultEl.innerHTML = `<p class="medium">Loading part...</p>`;

        try {
            const part = await fetchPart(partNumber);
            renderPart(resultEl, part);
        } catch (error) {
            console.error(error);
            resultEl.innerHTML = `<p class="medium">Failed to load part data.</p>`;
        }
    }

    function createPartRow(initialValue = "") {
        if (!partsList) return null;

        const row = document.createElement("div");
        row.className = "content part-row";

        row.innerHTML = `
            <div class="part-row-controls">
                <input
                    type="text"
                    class="part-input"
                    placeholder="Enter Steelwrist part number"
                    value="${initialValue}"
                >
                <button type="button" class="part-load-btn">Load</button>
                <button type="button" class="part-remove-btn">Remove</button>
            </div>
            <div class="smallspacer"></div>
            <div class="part-result">
                <p class="medium">Enter a part number and click Load.</p>
            </div>
        `;

        const input = row.querySelector(".part-input");
        const loadBtn = row.querySelector(".part-load-btn");
        const removeBtn = row.querySelector(".part-remove-btn");
        const resultEl = row.querySelector(".part-result");

        async function loadCurrentRow() {
            const value = input.value.trim().toUpperCase();

            if (!value) {
                resultEl.innerHTML = `<p class="medium">Please enter a part number.</p>`;
                updatePartsInUrl();
                return;
            }

            await loadPartIntoRow(value, resultEl);
            updatePartsInUrl();
        }

        loadBtn.addEventListener("click", loadCurrentRow);

        input.addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                loadCurrentRow();
            }
        });

        input.addEventListener("change", updatePartsInUrl);

        removeBtn.addEventListener("click", function() {
            row.remove();
            updatePartsInUrl();
        });

        partsList.appendChild(row);
        return { row, input, loadCurrentRow };
    }

    function loadRowsFromUrl() {
        const url = new URL(window.location.href);
        const partsParam = url.searchParams.get("parts");

        if (!partsParam) {
            createPartRow();
            return;
        }

        const partValues = partsParam
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

        if (partValues.length === 0) {
            createPartRow();
            return;
        }

        partValues.forEach(value => {
            const rowObj = createPartRow(value);
            if (rowObj) {
                rowObj.loadCurrentRow();
            }
        });
    }

    if (addPartRowButton) {
        addPartRowButton.addEventListener("click", function() {
            createPartRow();
        });
    }

    if (partsList) {
        loadRowsFromUrl();
    }
});