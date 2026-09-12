import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT TUTOR INBOX
// =====================================================

console.log("📬 Student Inbox Loaded");

// -----------------------------------------------------
// ESCAPE DATABASE CONTENT BEFORE DISPLAYING IT
// -----------------------------------------------------

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -----------------------------------------------------
// LOAD TUTOR ANSWERS
// -----------------------------------------------------

async function loadStudentAnswers() {
    const emailInput = document.getElementById("checkEmail");
    const inbox = document.getElementById("studentInbox");
    const loadButton = document.getElementById("loadAnswersButton");

    if (!emailInput || !inbox) {
        console.error("Inbox elements were not found.");
        return;
    }

    const email = emailInput.value.trim();

    if (email === "") {
        inbox.innerHTML = `
            <div class="empty-state">
                <span>⚠️</span>
                <p>Enter your email first.</p>
            </div>
        `;
        return;
    }

    if (!email.includes("@")) {
        inbox.innerHTML = `
            <div class="empty-state">
                <span>⚠️</span>
                <p>Enter a valid email address.</p>
            </div>
        `;
        return;
    }

    if (loadButton) {
        loadButton.disabled = true;
        loadButton.textContent = "⏳ Loading...";
    }

    inbox.innerHTML = `
        <div class="loading-inline">
            Loading tutor messages...
        </div>
    `;

    try {
        const { data, error } = await supabase
            .from("tutor_messages")
            .select(`
                id,
                student_name,
                student_email,
                topic,
                message,
                reply,
                status,
                created_at
            `)
            .eq("student_email", email)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Inbox loading error:", error);

            inbox.innerHTML = `
                <div class="empty-state">
                    <span>❌</span>
                    <p>Could not load tutor messages.</p>
                </div>
            `;

            return;
        }

        if (!data || data.length === 0) {
            inbox.innerHTML = `
                <div class="empty-state">
                    <span>📭</span>
                    <p>No tutor messages found for this email.</p>
                </div>
            `;

            return;
        }

        inbox.innerHTML = "";

        data.forEach((item) => {
            const card = document.createElement("article");

            card.className = "tutor-message-card";

            const topic = escapeHTML(item.topic || "Medical question");
            const question = escapeHTML(item.message || "No question provided.");
            const reply = escapeHTML(
                item.reply || "Waiting for a tutor response..."
            );
            const status = escapeHTML(item.status || "pending");

            const date = item.created_at
                ? new Date(item.created_at).toLocaleString()
                : "Date unavailable";

            card.innerHTML = `
                <div class="tutor-message-header">
                    <h3>📚 ${topic}</h3>
                    <span class="message-status">
                        ${status}
                    </span>
                </div>

                <p class="message-date">
                    ${escapeHTML(date)}
                </p>

                <div class="message-block">
                    <strong>📝 Your Question</strong>
                    <p>${question}</p>
                </div>

                <div class="message-block tutor-reply">
                    <strong>👨‍🏫 Tutor Response</strong>
                    <p>${reply}</p>
                </div>
            `;

            inbox.appendChild(card);
        });

    } catch (error) {
        console.error("Unexpected inbox error:", error);

        inbox.innerHTML = `
            <div class="empty-state">
                <span>❌</span>
                <p>An unexpected error occurred.</p>
            </div>
        `;
    } finally {
        if (loadButton) {
            loadButton.disabled = false;
            loadButton.textContent = "📥 Load Answers";
        }
    }
}

// -----------------------------------------------------
// MAKE FUNCTION AVAILABLE TO INLINE HTML onclick
// -----------------------------------------------------

window.loadStudentAnswers = loadStudentAnswers;

console.log("✅ loadStudentAnswers() is available globally");
