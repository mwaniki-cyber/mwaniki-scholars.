```javascript
import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS — STUDENT REGISTRATION
   ========================================================= */

window.registerStudent = async function () {

    const status =
        document.getElementById("registerStatus");

    try {

        /* =====================================================
           GET FORM VALUES
           ===================================================== */

        const name =
            document
                .getElementById("studentName")
                .value
                .trim();

        const email =
            document
                .getElementById("studentEmail")
                .value
                .trim();

        const phone =
            document
                .getElementById("studentPhone")
                .value
                .trim();

        const course =
            document
                .getElementById("studentCourse")
                .value
                .trim();

        const level =
            document
                .getElementById("studentLevel")
                .value
                .trim();

        const password =
            document
                .getElementById("studentPassword")
                .value;


        /* =====================================================
           VALIDATION
           ===================================================== */

        if (!name) {

            status.textContent =
                "❌ Please enter your full name.";

            return;

        }


        if (!email) {

            status.textContent =
                "❌ Please enter your email address.";

            return;

        }


        if (!phone) {

            status.textContent =
                "❌ Please enter your phone number.";

            return;

        }


        if (!course) {

            status.textContent =
                "❌ Please enter your course.";

            return;

        }


        if (!level) {

            status.textContent =
                "❌ Please enter your level/year.";

            return;

        }


        if (!password) {

            status.textContent =
                "❌ Please enter a password.";

            return;

        }


        if (password.length < 6) {

            status.textContent =
                "❌ Password must contain at least 6 characters.";

            return;

        }


        /* =====================================================
           SHOW LOADING
           ===================================================== */

        status.textContent =
            "⏳ Creating your student account...";


        /* =====================================================
           CREATE SUPABASE AUTH ACCOUNT
           ===================================================== */

        const {
            data,
            error
        } = await supabase.auth.signUp({

            email: email,

            password: password

        });


        if (error) {

            console.error(
                "❌ SUPABASE SIGNUP ERROR:",
                error
            );

            status.textContent =
                "❌ " + error.message;

            return;

        }


        if (!data || !data.user) {

            status.textContent =
                "❌ Account could not be created.";

            return;

        }


        const user =
            data.user;


        console.log(
            "✅ Auth account created:",
            user.id
        );


        /* =====================================================
           CREATE STUDENT PROFILE
           ===================================================== */

        const {
            error: profileError
        } = await supabase

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
                "❌ STUDENT PROFILE ERROR:",
                profileError
            );


            status.innerHTML =
                `
                ❌ Account authentication was created,
                but the student profile could not be saved.

                <br><br>

                <small>
                ${escapeHTML(profileError.message)}
                </small>
                `;

            return;

        }


        /* =====================================================
           SUCCESS
           ===================================================== */

        console.log(
            "✅ Student profile created successfully"
        );


        status.innerHTML =
            `
            <strong>
                ✅ Student account created successfully!
            </strong>

            <br><br>

            Redirecting to Student Login...
            `;


        /* =====================================================
           REDIRECT
           ===================================================== */

        setTimeout(
            () => {

                window.location.href =
                    "studentLogin.html";

            },
            1800
        );

    }

    catch (error) {

        console.error(
            "❌ REGISTRATION ERROR:",
            error
        );


        if (status) {

            status.innerHTML =
                `
                ❌ Registration failed.

                <br><br>

                <small>
                ${escapeHTML(error.message)}
                </small>
                `;

        }

    }

};


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}
```
