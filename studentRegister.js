import { supabase } from "./supabase.js";

console.log("✅ Mwaniki Scholars Student Registration Loaded");


window.registerStudent = async function () {

    const status = document.getElementById("registerStatus");
    const button = document.getElementById("registerButton");

    try {

        const name = document
            .getElementById("studentName")
            .value
            .trim();

        const email = document
            .getElementById("studentEmail")
            .value
            .trim();

        const phone = document
            .getElementById("studentPhone")
            .value
            .trim();

        const course = document
            .getElementById("studentCourse")
            .value
            .trim();

        const level = document
            .getElementById("studentLevel")
            .value
            .trim();

        const password = document
            .getElementById("studentPassword")
            .value;


        /* ================================
           VALIDATION
        ================================= */

        if (!name) {
            status.textContent = "❌ Please enter your full name.";
            return false;
        }

        if (!email) {
            status.textContent = "❌ Please enter your email address.";
            return false;
        }

        if (!phone) {
            status.textContent = "❌ Please enter your phone number.";
            return false;
        }

        if (!course) {
            status.textContent = "❌ Please enter your course.";
            return false;
        }

        if (!level) {
            status.textContent = "❌ Please enter your level/year.";
            return false;
        }

        if (!password) {
            status.textContent = "❌ Please create a password.";
            return false;
        }

        if (password.length < 6) {
            status.textContent =
                "❌ Password must contain at least 6 characters.";
            return false;
        }


        /* ================================
           LOADING
        ================================= */

        status.textContent =
            "⏳ Creating your Mwaniki Scholars account...";


        if (button) {
            button.disabled = true;
            button.textContent = "⏳ Creating Account...";
        }


        /* ================================
           SUPABASE AUTH ACCOUNT
        ================================= */

        const { data, error } =
            await supabase.auth.signUp({
                email: email,
                password: password
            });


        if (error) {

            console.error(
                "❌ Supabase signup error:",
                error
            );

            status.textContent =
                "❌ " + error.message;

            return false;
        }


        if (!data || !data.user) {

            status.textContent =
                "❌ Supabase did not return a user account.";

            return false;
        }


        const user = data.user;

        console.log(
            "✅ Auth account created:",
            user.id
        );


        /* ================================
           STUDENT PROFILE
        ================================= */

        const { error: profileError } =
            await supabase
                .from("students")
                .insert({
                    id: user.id,
                    full_name: name,
                    email: email,
                    phone: phone,
                    course: course,
                    level: level
                });


        if (profileError) {

            console.error(
                "❌ Student profile error:",
                profileError
            );

            status.textContent =
                "❌ Account was created, but the student profile could not be saved: "
                + profileError.message;

            return false;
        }


        /* ================================
           SUCCESS
        ================================= */

        console.log(
            "✅ Student profile created successfully"
        );


        status.innerHTML =
            "🎉 <strong>Account created successfully!</strong><br>" +
            "Your Mwaniki Scholars student account is ready.";


        setTimeout(() => {

            window.location.href =
                "studentLogin.html";

        }, 1800);


        return true;


    } catch (error) {

        console.error(
            "❌ Unexpected registration error:",
            error
        );


        status.textContent =
            "❌ Registration failed: " +
            (error.message || "Unknown error");


        return false;


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "✨ Create My Student Account";

        }

    }

};
