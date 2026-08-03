(function () {
    const MATRIX_URL = "data/sales-team-state-route-requirements.json";

    const ASSET_MAP = {
        connecticut_permit_not_required: "forms/option-5/option-5-no-connecticut-permit-statement-fillable.pdf"
    };

    const DOC_TYPE_LABELS = {
        official_pdf: "Official PDF",
        official_page: "Official page",
        app_asset: "Fillable PDF"
    };

    const STATUS_BADGES = {
        not_required: "Not required",
        conditional_local_review: "Confirm locally"
    };

    const OPTION_2_HIDDEN_DOWNLOAD_IDS = ["mtc_multijurisdiction_resale_certificate"];

    const elements = {
        permitSelect: document.getElementById("permit-state"),
        deliverySelect: document.getElementById("delivery-state"),
        permitLabel: document.getElementById("permit-state-label"),
        deliveryLabel: document.getElementById("delivery-state-label"),
        swapButton: document.getElementById("swap-states"),
        result: document.getElementById("sales-result"),
        placeholder: document.getElementById("sales-placeholder"),
        badge: document.getElementById("sales-option-badge"),
        optionName: document.getElementById("sales-option-name"),
        optionMeta: document.getElementById("sales-option-meta"),
        edgeCaseBanner: document.getElementById("sales-edge-case-banner"),
        edgeCaseList: document.getElementById("sales-edge-case-list"),
        stepsList: document.getElementById("sales-steps-list")
    };

    let matrix = null;

    function populateStateSelect(select, stateOrder, stateNames) {
        stateOrder.forEach(code => {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = `${stateNames[code] || code} (${code})`;
            select.appendChild(option);
        });
    }

    function createDocButton(doc) {
        const href = doc.access_type === "app_asset" ? (ASSET_MAP[doc.asset_key] || null) : doc.url;

        if (href) {
            const link = document.createElement("a");
            link.className = "sales-download-card";
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener";

            const type = document.createElement("span");
            type.className = "sales-download-type";
            type.textContent = DOC_TYPE_LABELS[doc.access_type] || "Reference";

            const label = document.createElement("strong");
            label.textContent = doc.official_name;

            link.appendChild(type);
            link.appendChild(label);
            return link;
        }

        const plain = document.createElement("span");
        plain.className = "sales-doc-chip-plain";
        plain.textContent = doc.official_name;
        return plain;
    }

    function renderEdgeCases(comparison) {
        elements.edgeCaseBanner.classList.toggle("hidden", !comparison.is_edge_case);
        elements.edgeCaseList.innerHTML = "";

        (comparison.edge_cases || []).forEach(edgeCase => {
            const item = document.createElement("div");
            item.className = "sales-edge-case-item";

            const label = document.createElement("p");
            label.className = "sales-edge-case-label";
            label.textContent = edgeCase.label;

            const instruction = document.createElement("p");
            instruction.className = "sales-edge-case-instruction";
            instruction.textContent = (matrix.edge_case_catalog && matrix.edge_case_catalog[edgeCase.key]) || "";

            item.appendChild(label);
            item.appendChild(instruction);
            elements.edgeCaseList.appendChild(item);
        });
    }

    function visibleDownloads(step, optionNumber) {
        if (optionNumber !== 2) return step.downloads || [];
        return (step.downloads || []).filter(doc => !OPTION_2_HIDDEN_DOWNLOAD_IDS.includes(doc.id));
    }

    function renderSteps(comparison) {
        elements.stepsList.innerHTML = "";

        comparison.steps.forEach(step => {
            const item = document.createElement("li");
            item.className = "sales-doc-item sales-step-item";
            if (step.status !== "required") {
                item.classList.add(step.status === "conditional_local_review" ? "is-conditional" : "is-not-required");
            }

            const indexEl = document.createElement("span");
            indexEl.className = "sales-doc-index";
            indexEl.textContent = String(step.step_number);

            const body = document.createElement("div");
            body.className = "sales-step-body";

            const titleRow = document.createElement("div");
            titleRow.className = "sales-step-title-row";

            const titleEl = document.createElement("p");
            titleEl.className = "sales-step-title";
            titleEl.textContent = step.title;
            titleRow.appendChild(titleEl);

            if (step.purpose_label) {
                const purposeEl = document.createElement("span");
                purposeEl.className = "sales-step-purpose";
                purposeEl.textContent = step.purpose_label;
                titleRow.appendChild(purposeEl);
            }

            if (STATUS_BADGES[step.status]) {
                const statusBadge = document.createElement("span");
                statusBadge.className = `sales-step-status sales-step-status-${step.status === "conditional_local_review" ? "conditional" : "not-required"}`;
                statusBadge.textContent = STATUS_BADGES[step.status];
                titleRow.appendChild(statusBadge);
            }

            const instructionEl = document.createElement("p");
            instructionEl.className = "sales-step-instruction";
            instructionEl.textContent = step.instruction;

            body.appendChild(titleRow);
            body.appendChild(instructionEl);

            const downloads = visibleDownloads(step, comparison.route.option_number);
            if (downloads.length) {
                const docsRow = document.createElement("div");
                docsRow.className = "sales-step-docs";
                downloads.forEach(doc => docsRow.appendChild(createDocButton(doc)));
                body.appendChild(docsRow);
            }

            item.appendChild(indexEl);
            item.appendChild(body);
            elements.stepsList.appendChild(item);
        });
    }

    function renderComparison() {
        if (!matrix) return;

        const permitState = elements.permitSelect.value;
        const deliveryState = elements.deliverySelect.value;
        const comparison = matrix.comparisons[permitState] && matrix.comparisons[permitState][deliveryState];

        if (!comparison) {
            elements.result.classList.add("hidden");
            elements.placeholder.classList.remove("hidden");
            return;
        }

        elements.placeholder.classList.add("hidden");
        elements.result.classList.remove("hidden");

        elements.badge.textContent = `Option ${comparison.route.option_number}`;
        elements.badge.className = `sales-option-badge option-${comparison.route.option_number}`;
        elements.optionName.textContent = comparison.route.title;
        elements.optionMeta.textContent = `Dealer home state: ${comparison.dealer_home_or_registration_state.name} — Delivery state: ${comparison.delivery_state.name}`;

        renderEdgeCases(comparison);
        renderSteps(comparison);
    }

    function swapStates() {
        const permitValue = elements.permitSelect.value;
        elements.permitSelect.value = elements.deliverySelect.value;
        elements.deliverySelect.value = permitValue;
        renderComparison();
    }

    async function init() {
        const response = await fetch(`${MATRIX_URL}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Matrix data error: ${response.status}`);
        }

        matrix = await response.json();

        if (matrix.ui_labels) {
            elements.permitLabel.textContent = matrix.ui_labels.dealer_state || elements.permitLabel.textContent;
            elements.deliveryLabel.textContent = matrix.ui_labels.delivery_state || elements.deliveryLabel.textContent;
        }

        populateStateSelect(elements.permitSelect, matrix.state_order, matrix.state_names);
        populateStateSelect(elements.deliverySelect, matrix.state_order, matrix.state_names);
        elements.deliverySelect.value = matrix.state_order[1] || matrix.state_order[0];

        elements.permitSelect.addEventListener("change", renderComparison);
        elements.deliverySelect.addEventListener("change", renderComparison);
        elements.swapButton.addEventListener("click", swapStates);

        renderComparison();
    }

    init().catch(error => {
        console.error(error);
        elements.placeholder.textContent = "Could not load the state route data. Refresh to try again.";
    });
})();
