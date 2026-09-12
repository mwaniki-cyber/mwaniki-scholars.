import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT TUTOR MESSAGE SYSTEM
// Compatible with dashboard.html
// =====================================================

console.log("👨‍🏫 Student Tutor System Loaded");

// -----------------------------------------------------
// GET LOGGED-IN USER EMAIL
// -----------------------------------------------------

async function getStudentEmail() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.warn("Could not get logged-in user:", error.message);
            return "";
        }

        return user?.email || "";
    } catch (error) {
        console.error("User email error:", error);
        return "";
    }
}

// -----------------------------------------------------
// SEND STUDENT QUESTION
// -----------------------------------------------------

async function sendTutorMessage() {
    const nameInput = document.getElementById("studentName");
    const emailInput = document.getElementById("studentEmail");
    const topicInput = document.getElementById("topic");
    const messageInput = document.getElementById("studentMessage");
    const sendButton = document.getElementById("sendTutorMessageButton");
    const statusBox = document.getElementById("messageStatus");

    if (
        !nameInput ||
        !emailInput ||
        !topicInput ||
        !messageInput ||
        !statusBox
    ) {
        console.error("Tutor form elements were not found.");
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const topic = topicInput.value.trim();
    const message = messageInput.value.trim();

    if (name === "") {
        statusBox.textContent = "❌ Please enter your full name.";
        return;
    }

    if (email === "") {
        statusBox.textContent = "❌ Please enter your email.";
        return;
    }

    if (!email.includes("@")) {
        statusBox.textContent = "❌ Please enter a valid email.";
        return;
    }

    if (topic === "") {
        statusBox.textContent = "❌ Please enter the topic.";
        return;
    }

    if (message === "") {
        statusBox.textContent = "❌ Please write your question.";
        return;
    }

    if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = "⏳ Sending...";
    }

    statusBox.textContent = "Sending your question...";

    try {
        const loggedInEmail = await getStudentEmail();

        const finalEmail = loggedInEmail || email;

        const { error } = await supabase
            .from("tutor_messages")
            .insert({
                student_name: name,
                student_email: finalEmail,
                topic: topic,
                message: message,
                status: "pending"
            });

        if (error) {
            console.error("Tutor message insert error:", error);

            statusBox.textContent =
                "❌ Message could not be sent: " + error.message;

            return;
        }

        statusBox.textContent =
            "✅ Your question has been sent successfully. A tutor will respond soon.";

        messageInput.value = "";
        topicInput.value = "";

    } catch (error) {
        console.error("Unexpected tutor message error:", error);

        statusBox.textContent =
            "❌ An unexpected error occurred. Please try again.";
    } finally {
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.textContent = "📨 Send Question";
        }
    }
}

// -----------------------------------------------------
// BACKWARD COMPATIBILITY
// -----------------------------------------------------

window.sendTutorMessage = sendTutorMessage;

// Also support the previous function name.
window.bookTutor = sendTutorMessage;

console.log("✅ sendTutorMessage() is available globally");
