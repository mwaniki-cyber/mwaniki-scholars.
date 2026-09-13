import { supabase } from "./supabase.js";

console.log("Mwaniki Scholars Student Registration Loaded");

const NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;

function normalizeName(value) {
    return value
        .trim()
        .replace(/\s+/g, " ");
}

function isValidName(name) {
    return NAME_PATTERN.test(name);
}

function setStatus(message) {
    const status = document.getElementById("registerStatus");

    if (status) {
        status.textContent = message;
    }
}

function setButtonState(disabled, text) {
    const button = document.getElementById("registerButton");

    if (!button) {
        return;
    }

    button.disabled = disabled;
    button.textContent = text;
}

window.registerStudent = async function () {
    try {
        const nameInput = document.getElementById("studentName");
        const emailInput = document.getElementById("studentEmail");
        const phoneInput = document.getElementById("studentPhone");
        const courseInput = document.getElementById("studentCourse");
        const levelInput = document.getElementById("studentLevel");
        const passwordInput = document.getElementById("studentPassword");

        if (
            !nameInput ||
            !emailInput ||
            !phoneInput ||
            !courseInput ||
            !levelInput ||
            !passwordInput
        ) {
            console.error("Registration form fields are missing.");
            setStatus("Registration form could not be loaded.");
            return false;
        }

        const name = normalizeName(nameInput.value);
        const email = emailInput.value.trim().toLowerCase();
        const phone = phoneInput.value.trim();
        const course = courseInput.value.trim();
        const level = levelInput.value.trim();
        const password = passwordInput.value;

        if (!name) {
            setStatus("Please enter your full name.");
            nameInput.focus();
            return false;
        }

        if (name.length < 2 || name.length > 80) {
            setStatus("Full name must contain between 2 and 80 characters.");
            nameInput.focus();
            return false;
        }

        if (!isValidName(name)) {
            setStatus(
                "Full name may contain letters, spaces, apostrophes, and hyphens only."
            );
            nameInput.focus();
            return false;
        }

        if (!email) {
            setStatus("Please enter your email address.");
            emailInput.focus();
            return false;
        }

        if (!phone) {
            setStatus("Please enter your phone number.");
            phoneInput.focus();
            return false;
        }

        if (!course) {
            setStatus("Please enter your course.");
            courseInput.focus();
            return false;
        }

        if (!level) {
            setStatus("Please enter your level or year of study.");
            levelInput.focus();
            return false;
        }

        if (!password) {
            setStatus("Please create a password.");
            passwordInput.focus();
            return false;
        }

        if (password.length < 6) {
            setStatus("Password must contain at least 6 characters.");
            passwordInput.focus();
            return false;
        }

        setStatus("Creating your Mwaniki Scholars account.");

        setButtonState(
            true,
            "Creating Account..."
        );

        const {
            data,
            error
        } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            console.error("Supabase signup error:", error);
            setStatus(error.message);
            return false;
        }

        if (!data || !data.user) {
            console.error("Supabase did not return a user.");
            setStatus("The account could not be created.");
            return false;
        }

        const user = data.user;

        console.log("Auth account created:", user.id);

        const {
            error: profileError
        } = await supabase
            .from("students")
            .insert({
                id: user.id,
                full_name: name,
                email,
                phone,
                course,
                level
            });

        if (profileError) {
            console.error(
                "Student profile creation failed:",
                profileError
            );

            setStatus(
                "The account was created, but the student profile could not be saved: " +
                profileError.message
            );

            return false;
        }

        console.log("Student profile created successfully.");

        setStatus(
            "Account created successfully. Redirecting to student login."
        );

        setTimeout(() => {
            window.location.href = "./studentLogin.html";
        }, 1500);

        return true;

    } catch (error) {
        console.error(
            "Unexpected registration error:",
            error
        );

        setStatus(
            error.message ||
            "Registration could not be completed."
        );

        return false;

    } finally {
        setButtonState(
            false,
            "Create Student Account"
        );
    }
};
