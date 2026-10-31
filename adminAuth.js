
import { supabase } from "./supabase.js";

/* =====================================================
   MWANIKI SCHOLARS — SECURE ADMIN AUTHENTICATION
   Platform Super Admin access is verified by Supabase.
===================================================== */

const statusBox = document.getElementById("status");
const loginButton = document.querySelector(
    'button[onclick="adminLogin()"]'
);

function showStatus(message, type = "error") {
    if (!statusBox) return;

    statusBox.textContent = message;
    statusBox.style.color =
        type === "success" ? "#087f73" : "#dc2626";
}

function setLoading(loading) {
    if (!loginButton) return;

    loginButton.disabled = loading;
    loginButton.textContent = loading
        ? "Verifying..."
        : "🔐 Login";
}

window.adminLogin = async function () {
    const email = document
        .getElementById("adminEmail")
        ?.value.trim();

    const password = document
        .getElementById("adminPassword")
        ?.value;

    if (!email || !password) {
        showStatus("Please enter your email and password.");
        return;
    }

    setLoading(true);
    showStatus("Authenticating...");

    try {
        // 1. Authenticate the account.
        const { data: loginData, error: loginError } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (loginError) throw loginError;

        if (!loginData.session) {
            throw new Error("Authentication session was not created.");
        }

        // 2. Verify global administrator privileges.
        const { data: isAdmin, error: adminError } =
            await supabase.rpc("is_platform_admin");

        if (adminError) {
            await supabase.auth.signOut();

            throw new Error(
                "Unable to verify administrator privileges: " +
                adminError.message
            );
        }

        // 3. Reject ordinary registered users.
        if (isAdmin !== true) {
            await supabase.auth.signOut();

            throw new Error(
                "Access denied. This account is not a Platform Super Admin."
            );
        }

        // 4. Authorized administrator.
        showStatus(
            "Administrator verified. Opening dashboard...",
            "success"
        );

        window.location.replace("admin.html");

    } catch (error) {
        console.error("Admin authentication error:", error);

        showStatus(error.message || "Login failed. Please try again.");
        setLoading(false);
    }
};
