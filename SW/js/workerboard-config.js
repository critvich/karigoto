window.SW_WORKER_BOARD_CONFIG = {
    storageMode: "cloudflare",
    apiBaseUrl: "https://sw-task-board-api.bbourne1104.workers.dev",
    defaultWorker: "BRBO",
    workers: {
        BRBO: {
            code: "BRBO",
            title: "BRBO Task Board",
            description: "Public task board for BRBO. Anyone can post tasks, but only BRBO can manage the queue.",
            ownerEmail: "",
            sharedExtraFields: [
                {
                    id: "priority",
                    label: "Priority",
                    type: "select",
                    options: ["Low", "Medium", "High"],
                    defaultValue: "Medium"
                }
            ],
            presetOptions: [
                {
                    id: "pick-pack",
                    label: "Pick, Pack, & ship",
                    titleHint: "Work a pick, pack, or ship task",
                    extraFields: [
                        {
                            id: "current-stage",
                            label: "Current stage",
                            type: "select",
                            options: ["Pick", "Pack", "Ship"],
                            defaultValue: "Pick"
                        },
                        {
                            id: "order-number",
                            label: "Order number",
                            type: "text",
                            placeholder: "Enter order number"
                        },
                        {
                            id: "zendesk-ticket",
                            label: "Zendesk Ticket",
                            type: "text",
                            placeholder: "Enter Zendesk ticket"
                        },
                        {
                            id: "picklist-printed",
                            label: "Picklist printed",
                            type: "boolean",
                            defaultValue: "No"
                        },
                        {
                            id: "picklist-location",
                            label: "Location",
                            type: "text",
                            placeholder: "Where was it printed?",
                            visibleIf: {
                                fieldId: "picklist-printed",
                                equals: "Yes"
                            }
                        }
                    ]
                },
                {
                    id: "zendesk-ticket",
                    label: "Work on a zendesk ticket",
                    titleHint: "Work on a Zendesk ticket",
                    extraFields: [
                        {
                            id: "zendesk-number",
                            label: "Zendesk ticket number",
                            type: "text",
                            placeholder: "Enter ticket number"
                        },
                        {
                            id: "zendesk-info",
                            label: "Any information i should know?",
                            type: "text",
                            placeholder: "Add anything important to know"
                        }
                    ]
                },
                {
                    id: "delivery-report",
                    label: "Delivery report new shipment",
                    titleHint: "Report a new shipment delivery",
                    extraFields: [
                        {
                            id: "delivery-location",
                            label: "Location (optional)",
                            type: "text",
                            placeholder: "Optional location"
                        },
                        {
                            id: "delivery-order-number",
                            label: "Order number (optional)",
                            type: "text",
                            placeholder: "Optional order number"
                        }
                    ]
                },
                {
                    id: "complete-ncr",
                    label: "Complete an NCR",
                    titleHint: "Complete an NCR",
                    extraFields: [
                        {
                            id: "ncr-internal",
                            label: "Internal",
                            type: "boolean"
                        },
                        {
                            id: "ncr-order-number",
                            label: "Order number",
                            type: "text",
                            placeholder: "Enter order number",
                            visibleIf: {
                                fieldId: "ncr-internal",
                                equals: "Yes"
                            }
                        },
                        {
                            id: "ncr-zendesk-ticket",
                            label: "Zendesk ticket",
                            type: "text",
                            placeholder: "Enter Zendesk ticket",
                            visibleIf: {
                                fieldId: "ncr-internal",
                                equals: "No"
                            }
                        },
                        {
                            id: "ncr-claim-number",
                            label: "Claim number (if there is one already)",
                            type: "text",
                            placeholder: "Optional claim number"
                        }
                    ]
                },
                {
                    id: "misc",
                    label: "Misc",
                    titleHint: "Post a misc task",
                    extraFields: [
                        {
                            id: "misc-notes",
                            label: "What needs doing?",
                            type: "text",
                            placeholder: "Write whatever you want people to know"
                        }
                    ]
                }
            ]
        }
    }
};
