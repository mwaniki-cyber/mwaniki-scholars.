import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT → HUMAN TUTOR MESSAGE SYSTEM
// =====================================================

console.log("👨‍🏫 Student Tutor System Loaded");


// =====================================================
// GET CURRENT USER
// =====================================================

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();


        if (error) {

            console.warn(
                "Could not get current user:",
                error.message
            );

            return null;
        }


        return data?.user || null;

    } catch (error) {

        console.error(
            "Current user error:",
            error
        );

        return null;
    }
}


// =====================================================
// SEND QUESTION
// =====================================================

async function sendTutorMessage() {

    console.log(
        "📨 sendTutorMessage() started"
    );


    const nameInput =
        document.getElementById(
            "studentName"
        );

    const emailInput =
        document.getElementById(
            "studentEmail"
        );

    const topicInput =
        document.getElementById(
            "topic"
        );

    const messageInput =
        document.getElementById(
            "studentMessage"
        );

    const sendButton =
        document.getElementById(
            "sendTutorMessageButton"
        );

    const statusBox =
        document.getElementById(
            "messageStatus"
        );


    if (
        !nameInput ||
        !emailInput ||
        !topicInput ||
        !messageInput ||
        !statusBox
    ) {

        console.error(
            "❌ Tutor form elements are missing."
        );

        return;
    }


    const name =
        nameInput.value.trim();

    const enteredEmail =
        emailInput.value.trim();

    const topic =
        topicInput.value.trim();

    const message =
        messageInput.value.trim();


    // =====================================================
    // VALIDATION
    // =====================================================

    if (!name) {

        statusBox.textContent =
            "❌ Please enter your full name.";

        nameInput.focus();

        return;
    }


    if (!enteredEmail) {

        statusBox.textContent =
            "❌ Please enter your email.";

        emailInput.focus();

        return;
    }


    if (!enteredEmail.includes("@")) {

        statusBox.textContent =
            "❌ Please enter a valid email.";

        emailInput.focus();

        return;
    }


    if (!topic) {

        statusBox.textContent =
            "❌ Please enter the topic.";

        topicInput.focus();

        return;
    }


    if (!message) {

        statusBox.textContent =
            "❌ Please write your question.";

        messageInput.focus();

        return;
    }


    // =====================================================
    // LOADING STATE
    // =====================================================

    if (sendButton) {

        sendButton.disabled =
            true;

        sendButton.textContent =
            "⏳ Sending...";

        sendButton.style.cursor =
            "wait";
    }


    statusBox.textContent =
        "📨 Sending your question to a Mwaniki tutor...";


    try {

        const user =
            await getCurrentUser();


        const finalEmail =
            user?.email ||
            enteredEmail;


        // =================================================
        // INSERT MESSAGE
        // =================================================

        const {
            data,
            error
        } = await supabase
            .from("tutor_messages")
            .insert({

                student_name:
                    name,

                student_email:
                    finalEmail,

                topic:
                    topic,

                message:
                    message,

                status:
                    "pending"

            })
            .select()
            .single();


        if (error) {

            console.error(
                "❌ Tutor message error:",
                error
            );

            throw new Error(
                error.message
            );
        }


        console.log(
            "✅ Tutor question saved:",
            data
        );


        // =================================================
        // SUCCESS
        // =================================================

        statusBox.textContent =
            "✅ Question sent successfully. Your tutor can now review it from the tutor portal.";


        messageInput.value =
            "";

        topicInput.value =
            "";


    } catch (error) {

        console.error(
            "❌ Tutor message failed:",
            error
        );


        statusBox.textContent =
            "❌ Your question could not be sent: " +
            error.message;

    } finally {

        if (sendButton) {

            sendButton.disabled =
                false;

            sendButton.textContent =
                "📨 Send Question";

            sendButton.style.cursor =
                "pointer";
        }

    }

}


// =====================================================
// GLOBAL FUNCTION
// =====================================================

window.sendTutorMessage =
    sendTutorMessage;


// Backward compatibility

window.bookTutor =
    sendTutorMessage;


console.log(
    "✅ sendTutorMessage() is globally available"
);
