```javascript
import { supabase } from "./supabase.js";

console.log("🎓 dashboard.js loaded");


async function loadStudentProfile() {

    console.log("👤 Loading student profile...");

    const result =
        await supabase.auth.getSession();

    if (result.error) {

        console.error(
            "Session error:",
            result.error
        );

        return;
    }


    const session =
        result.data.session;


    if (!session) {

        console.log(
            "⚠️ No active student session"
        );

        return;
    }


    const user =
        session.user;


    console.log(
        "✅ Logged-in user:",
        user.email
    );


    const profileResult =
        await supabase
            .from("students")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();


    if (profileResult.error) {

        console.error(
            "❌ Student profile error:",
            profileResult.error
        );

        return;
    }


    const student =
        profileResult.data;


    if (!student) {

        console.warn(
            "⚠️ No student profile found for this user."
        );

        return;
    }


    console.log(
        "✅ Student profile:",
        student
    );


    displayStudentProfile(student);
}


function displayStudentProfile(student) {

    const name =
        student.full_name ||
        "Student";


    const email =
        student.email ||
        "";


    const course =
        student.course ||
        "Course not set";


    const level =
        student.level ||
        "Level not set";


    const photo =
        student.photo_url ||
        "";


    const profileButton =
        document.querySelector(".profile");


    if (profileButton) {

        profileButton.innerHTML = photo

            ? `
                <img
                    src="${photo}"
                    style="
                        width:40px;
                        height:40px;
                        border-radius:50%;
                        object-fit:cover;
                        vertical-align:middle;
                        margin-right:8px;
                    "
                >

                ${name}
              `

            : `
                👤 ${name}
              `;


        profileButton.style.cursor =
            "pointer";


        profileButton.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };
    }


    const dashboard =
        document.querySelector(".container");


    if (!dashboard) {

        console.warn(
            "Dashboard container not found."
        );

        return;
    }


    const existing =
        document.getElementById(
            "studentPersonalProfile"
        );


    if (existing) {

        existing.remove();
    }


    const profileCard =
        document.createElement("div");


    profileCard.id =
        "studentPersonalProfile";


    profileCard.style.cssText = `
        background:linear-gradient(
            135deg,
            #063970,
            #0b7285
        );

        color:white;

        padding:25px;

        margin-bottom:25px;

        border-radius:20px;

        box-shadow:
            0 10px 30px
            rgba(0,0,0,.12);
    `;


    profileCard.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:20px;
                flex-wrap:wrap;
            "
        >

            <div>

                ${
                    photo

                    ?

                    `
                    <img
                        src="${photo}"
                        style="
                            width:80px;
                            height:80px;
                            border-radius:50%;
                            object-fit:cover;
                            border:3px solid white;
                        "
                    >
                    `

                    :

                    `
                    <div
                        style="
                            width:80px;
                            height:80px;
                            border-radius:50%;
                            background:
                                rgba(255,255,255,.2);
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:40px;
                        "
                    >
                        👤
                    </div>
                    `
                }

            </div>


            <div>

                <div
                    style="
                        font-size:25px;
                        font-weight:bold;
                    "
                >
                    Welcome, ${name}
                </div>


                <div
                    style="
                        margin-top:6px;
                    "
                >
                    📧 ${email}
                </div>


                <div
                    style="
                        margin-top:6px;
                    "
                >
                    🎓 ${course}
                </div>


                <div
                    style="
                        margin-top:6px;
                    "
                >
                    📚 ${level}
                </div>

            </div>


            <button
                id="myProfileButton"
                type="button"
                style="
                    margin-left:auto;
                    background:white;
                    color:#063970;
                    border:none;
                    padding:12px 18px;
                    border-radius:10px;
                    cursor:pointer;
                    font-weight:bold;
                "
            >
                👤 My Profile
            </button>

        </div>

    `;


    dashboard.prepend(
        profileCard
    );


    const myProfileButton =
        document.getElementById(
            "myProfileButton"
        );


    if (myProfileButton) {

        myProfileButton.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };
    }


    console.log(
        "✅ Student profile displayed"
    );
}


loadStudentProfile();
```
