import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT TUTOR INBOX
// =====================================================

console.log("📬 Student Inbox Loaded");


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// GET CURRENT USER EMAIL
// =====================================================

async function getLoggedInEmail() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();


        if (error) {

            console.warn(
                "Could not retrieve logged-in user:",
                error.message
            );

            return "";
        }


        return data?.user?.email || "";

    } catch (error) {

        console.error(
            "Email retrieval error:",
            error
        );

        return "";
    }
}


// =====================================================
// LOAD ANSWERS
// =====================================================

async function loadStudentAnswers() {

    console.log(
        "📥 loadStudentAnswers() started"
    );


    const emailInput =
        document.getElementById(
            "checkEmail"
        );

    const inbox =
        document.getElementById(
            "studentInbox"
        );

    const loadButton =
        document.getElementById(
            "loadAnswersButton"
        );


    if (!emailInput || !inbox) {

        console.error(
            "❌ Inbox elements were not found."
        );

        return;
    }


    let email =
        emailInput.value.trim();


    // =====================================================
    // AUTOMATICALLY USE LOGGED-IN EMAIL
    // =====================================================

    if (!email) {

        email =
            await getLoggedInEmail();

        if (email) {

            emailInput.value =
                email;
        }
    }


    // =====================================================
    // VALIDATE
    // =====================================================

    if (!email) {

        inbox.innerHTML = `
            <div class="empty-state">
                <span>⚠️</span>
                <p>
                    Enter your email to check your tutor answers.
                </p>
            </div>
        `;

        return;
    }


    if (!email.includes("@")) {

        inbox.innerHTML = `
            <div class="empty-state">
                <span>⚠️</span>
                <p>
                    Please enter a valid email address.
                </p>
            </div>
        `;

        return;
    }


    // =====================================================
    // LOADING
    // =====================================================

    if (loadButton) {

        loadButton.disabled =
            true;

        loadButton.textContent =
            "⏳ Loading...";

        loadButton.style.cursor =
            "wait";
    }


    inbox.innerHTML = `
        <div class="loading-inline">
            📥 Checking your Mwaniki tutor inbox...
        </div>
    `;


    try {

        const {
            data,
            error
        } = await supabase
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
            .eq(
                "student_email",
                email
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                "❌ Inbox error:",
                error
            );

            throw new Error(
                error.message
            );
        }


        // =================================================
        // NOTHING FOUND
        // =================================================

        if (
            !data ||
            data.length === 0
        ) {

            inbox.innerHTML = `
                <div class="empty-state">

                    <span>📭</span>

                    <h3>
                        No tutor conversations yet
                    </h3>

                    <p>
                        Questions you send to Mwaniki tutors
                        and their replies will appear here.
                    </p>

                </div>
            `;

            return;
        }


        // =================================================
        // DISPLAY MESSAGES
        // =================================================

        inbox.innerHTML =
            "";


        data.forEach(
            item => {

                const card =
                    document.createElement(
                        "article"
                    );


                card.className =
                    "tutor-message-card";


                const topic =
                    escapeHTML(
                        item.topic ||
                        "Medical question"
                    );


                const question =
                    escapeHTML(
                        item.message ||
                        "No question provided."
                    );


                const reply =
                    escapeHTML(
                        item.reply ||
                        ""
                    );


                const status =
                    escapeHTML(
                        item.status ||
                        "pending"
                    );


                const date =
                    item.created_at
                        ? new Date(
                            item.created_at
                        ).toLocaleString()
                        : "Date unavailable";


                let replyHTML;


                if (reply) {

                    replyHTML = `
                        <div class="message-block tutor-reply">

                            <strong>
                                👨‍🏫 Tutor Response
                            </strong>

                            <p>
                                ${reply}
                            </p>

                        </div>
                    `;

                } else {

                    replyHTML = `
                        <div class="message-block tutor-reply">

                            <strong>
                                ⏳ Tutor Response
                            </strong>

                            <p>
                                Your question is waiting
                                for a tutor response.
                            </p>

                        </div>
                    `;
                }


                card.innerHTML = `

                    <div class="tutor-message-header">

                        <h3>
                            📚 ${topic}
                        </h3>

                        <span class="message-status">
                            ${status}
                        </span>

                    </div>


                    <p class="message-date">
                        ${escapeHTML(date)}
                    </p>


                    <div class="message-block">

                        <strong>
                            📝 Your Question
                        </strong>

                        <p>
                            ${question}
                        </p>

                    </div>


                    ${replyHTML}

                `;


                inbox.appendChild(
                    card
                );

            }
        );


        console.log(
            `✅ Loaded ${data.length} tutor messages`
        );


    } catch (error) {

        console.error(
            "❌ Unexpected inbox error:",
            error
        );


        inbox.innerHTML = `

            <div class="empty-state">

                <span>❌</span>

                <h3>
                    Could not load your inbox
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    } finally {

        if (loadButton) {

            loadButton.disabled =
                false;

            loadButton.textContent =
                "📥 Load Answers";

            loadButton.style.cursor =
                "pointer";
        }

    }

}


// =====================================================
// GLOBAL ACCESS
// =====================================================

window.loadStudentAnswers =
    loadStudentAnswers;


console.log(
    "✅ loadStudentAnswers() is globally available"
);
