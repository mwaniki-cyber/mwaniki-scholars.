import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
   COMPLETE VERSION
   ---------------------------------------------------------
   IMPORTANT ARCHITECTURE:

   Mwaniki AI = separate system / aiTutor.html

   Turbo AI = separate dashboard system

   Turbo AI MUST NOT use Mwaniki AI DOM IDs,
   storage keys, handlers or backend code.
========================================================= */

console.log("🚀 Mwaniki Scholars dashboard engine loaded");

/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;
let dashboardInitializing = false;
let dashboardClockTimer = null;

/* =========================================================
   CONFIGURATION
========================================================= */

const PROFILE_PHOTO_BUCKET = "student-profiles";

const MAX_PROFILE_PHOTO_SIZE =
    5 * 1024 * 1024;

const NOTIFICATION_STORAGE_PREFIX =
    "mwanikiNotifications_";

const NOTIFICATION_STATE_PREFIX =
    "mwanikiNotificationState_";

const APP_UPDATE_ID =
    "mwaniki-dashboard-update-2026-09";

/* =========================================================
   TURBO AI CONFIGURATION
   ---------------------------------------------------------
   COMPLETELY SEPARATE FROM MWANIKI AI
========================================================= */

const TURBO_AI_FUNCTION_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co/functions/v1/turbo-ai";

const TURBO_AI_LAST_QUESTION_KEY =
    "mwanikiTurboAILastQuestion";

const TURBO_AI_RECENT_QUESTIONS_KEY =
    "mwanikiTurboAIRecentQuestions";

/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(
        document.querySelectorAll(selector)
    );
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent = value ?? "";
    }
}

function setHTML(selector, value) {
    const element = $(selector);

    if (element) {
        element.innerHTML = value ?? "";
    }
}

function showElement(selector, displayValue = "") {
    const element = $(selector);

    if (element) {
        element.style.display = displayValue;
    }
}

function hideElement(selector) {
    const element = $(selector);

    if (element) {
        element.style.display = "none";
    }
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setCounterText(selector, value) {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent =
        Number(value || 0).toLocaleString();
}

/* =========================================================
   FORM FIELD HELPERS
========================================================= */

function getFieldValue(selector) {
    const element = $(selector);

    if (!element) {
        return "";
    }

    if ("value" in element) {
        return String(
            element.value ?? ""
        ).trim();
    }

    return String(
        element.textContent ?? ""
    ).trim();
}

function setFieldValue(selector, value) {
    const element = $(selector);

    if (!element) {
        return;
    }

    if ("value" in element) {
        element.value = value ?? "";
    } else {
        element.textContent = value ?? "";
    }
}

/* =========================================================
   USER-FACING STATUS MESSAGE
========================================================= */

function showMessage(
    selector,
    message,
    type = "info"
) {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.dataset.messageType =
        type;

    element.classList.remove(
        "success",
        "error",
        "info",
        "warning"
    );

    element.classList.add(type);

    element.style.display =
        message ? "block" : "";
}

/* =========================================================
   STORAGE HELPERS
========================================================= */

function readStorage(
    key,
    fallback = null
) {
    try {
        const value =
            localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        return JSON.parse(value);

    } catch (error) {

        console.warn(
            `⚠️ Could not read localStorage key: ${key}`,
            error
        );

        return fallback;
    }
}

function writeStorage(
    key,
    value
) {
    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.warn(
            `⚠️ Could not write localStorage key: ${key}`,
            error
        );
    }
}

function removeStorage(key) {
    try {

        localStorage.removeItem(key);

    } catch (error) {

        console.warn(
            `⚠️ Could not remove localStorage key: ${key}`,
            error
        );
    }
}

/* =========================================================
   COURSE NORMALIZATION
========================================================= */

function normalizeCourse(course) {

    if (!course) {
        return null;
    }

    const id =
        course.id ??
        course.courseId ??
        course.course_id ??
        null;

    const title =
        course.title ||
        course.courseTitle ||
        course.course_name ||
        course.name ||
        "Untitled Course";

    if (
        id === null ||
        id === undefined ||
        id === ""
    ) {
        return null;
    }

    return {

        id,

        title:
            String(title).trim() ||
            "Untitled Course",

        description:
            String(
                course.description || ""
            ).trim(),

        image:
            String(
                course.image || ""
            ).trim(),

        created_at:
            course.created_at || null
    };
}

/* =========================================================
   COURSE URL
========================================================= */

function getCourseURL(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return "./courses.html";
    }

    return (
        `./course.html?course_id=` +
        encodeURIComponent(
            normalizedCourse.id
        )
    );
}

/* =========================================================
   RECENT COURSE STORAGE
========================================================= */

function getLastCourse() {

    const storedCourse =
        readStorage(
            "mwanikiLastCourse",
            null
        );

    return normalizeCourse(
        storedCourse
    );
}

function saveLastCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    writeStorage(
        "mwanikiLastCourse",
        normalizedCourse
    );
}

function getRecentCourses() {

    const recentCourses =
        readStorage(
            "mwanikiRecentCourses",
            []
        );

    if (!Array.isArray(recentCourses)) {
        return [];
    }

    return recentCourses
        .map(normalizeCourse)
        .filter(Boolean);
}

function saveRecentCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    const existingCourses =
        getRecentCourses();

    const filteredCourses =
        existingCourses.filter(
            item =>
                String(item.id) !==
                String(normalizedCourse.id)
        );

    filteredCourses.unshift(
        normalizedCourse
    );

    writeStorage(
        "mwanikiRecentCourses",
        filteredCourses.slice(0, 8)
    );
}

function saveSelectedCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    writeStorage(
        "selectedCourse",
        normalizedCourse.id
    );

    writeStorage(
        "selectedCourseName",
        normalizedCourse.title
    );

    saveLastCourse(
        normalizedCourse
    );

    saveRecentCourse(
        normalizedCourse
    );
}

/* =========================================================
   COURSE OPENING
========================================================= */

function openCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {

        console.warn(
            "⚠️ Cannot open invalid course:",
            course
        );

        return;
    }

    saveSelectedCourse(
        normalizedCourse
    );

    window.location.href =
        getCourseURL(
            normalizedCourse
        );
}

window.mwanikiOpenCourse =
    openCourse;

/* =========================================================
   LIVE DATE AND TIME
========================================================= */

function updateCurrentDate() {

    const currentDateElement =
        $("#currentDate");

    if (!currentDateElement) {
        return;
    }

    const now =
        new Date();

    const formattedDate =
        now.toLocaleDateString(
            "en-KE",
            {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );

    const formattedTime =
        now.toLocaleTimeString(
            "en-KE",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    currentDateElement.textContent =
        `${formattedDate} • ${formattedTime}`;
}

function startDashboardClock() {

    updateCurrentDate();

    if (dashboardClockTimer) {

        clearInterval(
            dashboardClockTimer
        );
    }

    dashboardClockTimer =
        setInterval(
            updateCurrentDate,
            60000
        );
}

/* =========================================================
   AUTHENTICATION
========================================================= */

async function getAuthenticatedUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {

            console.error(
                "❌ Could not get authenticated user:",
                error
            );

            return null;
        }

        return data?.user || null;

    } catch (error) {

        console.error(
            "❌ Unexpected authentication error:",
            error
        );

        return null;
    }
}

async function handleSignedOut() {

    currentUser = null;
    currentStudent = null;
    dashboardReady = false;

    if (dashboardClockTimer) {

        clearInterval(
            dashboardClockTimer
        );

        dashboardClockTimer = null;
    }

    window.location.href =
        "./index.html";
}

/* =========================================================
   STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {

    if (!currentUser) {
        return false;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("students")
            .select(`
                id,
                full_name,
                email,
                phone,
                course,
                level,
                photo_url,
                created_at
            `)
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();

        if (error) {

            console.error(
                "❌ Student profile loading failed:",
                error
            );

            return false;
        }

        currentStudent =
            data || {

                id:
                    currentUser.id,

                full_name:
                    currentUser
                        .user_metadata
                        ?.full_name ||
                    currentUser
                        .user_metadata
                        ?.name ||
                    "Student",

                email:
                    currentUser.email ||
                    "",

                phone: "",
                course: "",
                level: "",
                photo_url: ""
            };

        renderStudentProfile();

        return true;

    } catch (error) {

        console.error(
            "❌ Unexpected profile error:",
            error
        );

        return false;
    }
}

/* =========================================================
   STUDENT NAME
========================================================= */

function getStudentDisplayName() {

    if (!currentStudent) {
        return "Student";
    }

    return (

        currentStudent.full_name ||

        currentStudent.name ||

        currentUser
            ?.user_metadata
            ?.full_name ||

        currentUser
            ?.email
            ?.split("@")[0] ||

        "Student"
    );
}

function getStudentFirstName() {

    return getStudentDisplayName()
        .trim()
        .split(/\s+/)[0] ||
        "Student";
}

/* =========================================================
   PROFILE AVATAR
========================================================= */

function createInitialsAvatar(name) {

    const safeName =
        String(
            name || "Student"
        ).trim();

    const initials =
        safeName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
                word =>
                    word
                        .charAt(0)
                        .toUpperCase()
            )
            .join("");

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="160"
            height="160"
            viewBox="0 0 160 160"
        >
            <rect
                width="160"
                height="160"
                rx="80"
                fill="#087f73"
            />

            <text
                x="80"
                y="96"
                text-anchor="middle"
                font-size="54"
                font-family="Arial, sans-serif"
                font-weight="700"
                fill="#ffffff"
            >
                ${escapeHTML(
                    initials || "S"
                )}
            </text>
        </svg>
    `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}

function getPossibleProfileImage() {

    if (!currentStudent) {
        return "";
    }

    return (

        currentStudent.photo_url ||

        currentStudent.photo ||

        currentStudent.avatar_url ||

        currentStudent.profile_image ||

        currentStudent.image ||

        currentUser
            ?.user_metadata
            ?.photo_url ||

        currentUser
            ?.user_metadata
            ?.avatar_url ||

        currentUser
            ?.user_metadata
            ?.picture ||

        ""
    );
}

function setAvatar(
    selector,
    photoURL,
    name
) {

    const element =
        $(selector);

    if (!element) {
        return;
    }

    const fallbackURL =
        createInitialsAvatar(
            name
        );

    element.setAttribute(
        "alt",
        `${name} profile photo`
    );

    element.onerror =
        function () {

            this.onerror = null;

            this.src =
                fallbackURL;
        };

    element.src =
        photoURL ||
        fallbackURL;

    element.style.display =
        "block";

    element.style.visibility =
        "visible";

    element.style.opacity =
        "1";
}

function displayProfileImage() {

    const displayName =
        getStudentDisplayName();

    const imageURL =
        getPossibleProfileImage();

    setAvatar(
        "#headerProfileAvatar",
        imageURL,
        displayName
    );

    setAvatar(
        "#profileLargeAvatar",
        imageURL,
        displayName
    );

    console.log(
        imageURL
            ? "✅ Student profile image displayed."
            : "ℹ️ No saved profile image found. Initials avatar displayed."
    );
}

/* =========================================================
   PROFILE RENDERING
========================================================= */

function renderStudentProfile() {

    if (!currentStudent) {
        return;
    }

    const displayName =
        getStudentDisplayName();

    setText(
        "#headerProfileName",
        displayName
    );

    setText(
        "#welcomeName",
        getStudentFirstName()
    );

    setFieldValue(
        "#profileName",
        currentStudent.full_name ||
        displayName
    );

    setFieldValue(
        "#profileEmail",
        currentStudent.email ||
        currentUser?.email ||
        ""
    );

    setFieldValue(
        "#profilePhone",
        currentStudent.phone ||
        ""
    );

    setFieldValue(
        "#profileCourse",
        currentStudent.course ||
        ""
    );

    setFieldValue(
        "#profileLevel",
        currentStudent.level ||
        ""
    );

    const profileEmail =
        $("#profileEmail");

    if (profileEmail) {

        profileEmail.readOnly =
            true;

        profileEmail.setAttribute(
            "aria-readonly",
            "true"
        );
    }

    displayProfileImage();
}

/* =========================================================
   PROFILE PANEL
========================================================= */

function setPanelOpen(
    panel,
    shouldOpen
) {

    if (!panel) {
        return;
    }

    if (shouldOpen) {

        panel.classList.add(
            "active"
        );

        panel.classList.add(
            "open"
        );

        panel.removeAttribute(
            "hidden"
        );

        panel.setAttribute(
            "aria-hidden",
            "false"
        );

        panel.style.display =
            "flex";

        panel.style.visibility =
            "visible";

        panel.style.opacity =
            "1";

        panel.style.pointerEvents =
            "auto";

        panel.style.zIndex =
            "9999";

    } else {

        panel.classList.remove(
            "active"
        );

        panel.classList.remove(
            "open"
        );

        panel.setAttribute(
            "aria-hidden",
            "true"
        );

        panel.style.display =
            "none";

        panel.style.visibility =
            "hidden";

        panel.style.opacity =
            "0";

        panel.style.pointerEvents =
            "none";
    }
}

function openProfilePanel() {

    setPanelOpen(
        $("#profilePanel"),
        true
    );
}

function closeProfilePanel() {

    setPanelOpen(
        $("#profilePanel"),
        false
    );
}

function setupProfilePanel() {

    const profileButton =
        $("#profileButton");

    const closeButton =
        $("#closeProfilePanel");

    const panel =
        $("#profilePanel");

    if (!profileButton) {

        console.warn(
            "⚠️ #profileButton was not found."
        );

    } else {

        profileButton.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                const isOpen =
                    panel?.classList
                        .contains("active");

                if (isOpen) {

                    closeProfilePanel();

                } else {

                    renderStudentProfile();

                    openProfilePanel();
                }
            };
    }

    if (closeButton) {

        closeButton.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                closeProfilePanel();
            };
    }

    if (panel) {

        setPanelOpen(
            panel,
            false
        );
    }
}

/* =========================================================
   REPAIR PROFILE FIELDS
========================================================= */

function repairProfileFields() {

    if (!currentStudent) {
        return;
    }

    setFieldValue(
        "#profileName",
        currentStudent.full_name ||
        getStudentDisplayName()
    );

    setFieldValue(
        "#profileEmail",
        currentStudent.email ||
        currentUser?.email ||
        ""
    );

    setFieldValue(
        "#profilePhone",
        currentStudent.phone ||
        ""
    );

    setFieldValue(
        "#profileCourse",
        currentStudent.course ||
        ""
    );

    setFieldValue(
        "#profileLevel",
        currentStudent.level ||
        ""
    );

    const profileEmail =
        $("#profileEmail");

    if (profileEmail) {
        profileEmail.readOnly =
            true;
    }
}

/* =========================================================
   SAVE STUDENT PROFILE
========================================================= */

function setupProfileForm() {

    const saveButton =
        $("#saveProfileButton");

    if (!saveButton) {
        return;
    }

    saveButton.onclick =
        saveStudentProfile;
}

async function saveStudentProfile() {

    if (
        !currentUser ||
        !currentStudent
    ) {
        return;
    }

    const fullName =
        getFieldValue(
            "#profileName"
        ) ||
        getStudentDisplayName();

    const phone =
        getFieldValue(
            "#profilePhone"
        );

    const course =
        getFieldValue(
            "#profileCourse"
        );

    const level =
        getFieldValue(
            "#profileLevel"
        );

    const saveButton =
        $("#saveProfileButton");

    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";
    }

    showMessage(
        "#profileSaveStatus",
        "Saving profile...",
        "info"
    );

    try {

        const {
            data,
            error
        } = await supabase
            .from("students")
            .update({

                full_name:
                    fullName,

                phone:
                    phone,

                course:
                    course,

                level:
                    level
            })
            .eq(
                "id",
                currentUser.id
            )
            .select()
            .maybeSingle();

        if (error) {

            console.error(
                "❌ Profile update failed:",
                error
            );

            showMessage(
                "#profileSaveStatus",
                "Could not save your profile. Please try again.",
                "error"
            );

            return;
        }

        currentStudent = {

            ...currentStudent,

            ...(data || {}),

            full_name:
                fullName,

            phone:
                phone,

            course:
                course,

            level:
                level
        };

        renderStudentProfile();

        showMessage(
            "#profileSaveStatus",
            "Profile saved successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "❌ Unexpected profile save error:",
            error
        );

        showMessage(
            "#profileSaveStatus",
            "An unexpected error occurred while saving.",
            "error"
        );

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Profile";
        }
    }
}

/* =========================================================
   PROFILE PHOTO UPLOAD
========================================================= */

function sanitizeFileName(
    fileName
) {

    return String(
        fileName || "profile-photo"
    )
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .slice(0, 100);
}

async function uploadProfilePhoto(
    file
) {

    if (!currentUser) {

        throw new Error(
            "No authenticated student."
        );
    }

    const safeFileName =
        sanitizeFileName(
            file.name
        );

    const extension =
        safeFileName.includes(".")
            ? safeFileName
                .split(".")
                .pop()
                .toLowerCase()
            : "jpg";

    const storagePath =
        `${currentUser.id}/` +
        `${Date.now()}-profile.${extension}`;

    console.log(
        "📤 Uploading profile photo:",
        storagePath
    );

    const {
        error: uploadError
    } = await supabase.storage
        .from(
            PROFILE_PHOTO_BUCKET
        )
        .upload(
            storagePath,
            file,
            {
                cacheControl:
                    "3600",

                contentType:
                    file.type,

                upsert:
                    true
            }
        );

    if (uploadError) {

        console.error(
            "❌ Profile photo upload failed:",
            uploadError
        );

        throw uploadError;
    }

    const {
        data: publicData
    } = supabase.storage
        .from(
            PROFILE_PHOTO_BUCKET
        )
        .getPublicUrl(
            storagePath
        );

    const publicURL =
        publicData?.publicUrl;

    if (!publicURL) {

        throw new Error(
            "Could not generate the public profile photo URL."
        );
    }

    const {
        error: profileError
    } = await supabase
        .from("students")
        .update({
            photo_url:
                publicURL
        })
        .eq(
            "id",
            currentUser.id
        );

    if (profileError) {

        console.error(
            "❌ Could not save photo URL:",
            profileError
        );

        throw profileError;
    }

    currentStudent = {

        ...currentStudent,

        photo_url:
            publicURL
    };

    displayProfileImage();

    return publicURL;
}

function setupProfilePhoto() {

    const photoInput =
        $("#profilePhotoInput");

    if (!photoInput) {

        console.warn(
            "⚠️ #profilePhotoInput was not found."
        );

        return;
    }

    photoInput.onchange =
        async function (event) {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            if (
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                showMessage(
                    "#profileSaveStatus",
                    "Please select a valid image file.",
                    "error"
                );

                photoInput.value =
                    "";

                return;
            }

            if (
                file.size >
                MAX_PROFILE_PHOTO_SIZE
            ) {

                showMessage(
                    "#profileSaveStatus",
                    "The profile photo must be 5 MB or smaller.",
                    "error"
                );

                photoInput.value =
                    "";

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                function () {

                    const previewURL =
                        reader.result;

                    setAvatar(
                        "#headerProfileAvatar",
                        previewURL,
                        getStudentDisplayName()
                    );

                    setAvatar(
                        "#profileLargeAvatar",
                        previewURL,
                        getStudentDisplayName()
                    );
                };

            reader.readAsDataURL(
                file
            );

            showMessage(
                "#profileSaveStatus",
                "Uploading profile photo...",
                "info"
            );

            photoInput.disabled =
                true;

            try {

                await uploadProfilePhoto(
                    file
                );

                showMessage(
                    "#profileSaveStatus",
                    "Profile photo uploaded and saved successfully.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "❌ Profile photo process failed:",
                    error
                );

                displayProfileImage();

                showMessage(
                    "#profileSaveStatus",
                    "Photo upload failed. Make sure the student-profiles bucket allows uploads.",
                    "error"
                );

            } finally {

                photoInput.disabled =
                    false;
            }
        };
}

/* =========================================================
   PASSWORD RESET
========================================================= */

function setupChangePassword() {

    const button =
        $("#changePasswordButton");

    if (!button) {
        return;
    }

    button.onclick =
        async function () {

            if (!currentUser?.email) {

                alert(
                    "No registered email address was found."
                );

                return;
            }

            button.disabled =
                true;

            button.textContent =
                "Sending...";

            try {

                const {
                    error
                } =
                    await supabase.auth
                        .resetPasswordForEmail(
                            currentUser.email
                        );

                if (error) {

                    console.error(
                        "❌ Password reset error:",
                        error
                    );

                    alert(
                        "Could not send the password reset email."
                    );

                    return;
                }

                alert(
                    "A password reset email has been sent to your registered email address."
                );

            } catch (error) {

                console.error(
                    "❌ Unexpected password reset error:",
                    error
                );

                alert(
                    "An unexpected error occurred."
                );

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Change Password";
            }
        };
}

/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    const logoutButton =
        $("#logoutButton");

    if (!logoutButton) {
        return;
    }

    logoutButton.onclick =
        async function () {

            logoutButton.disabled =
                true;

            logoutButton.textContent =
                "Signing out...";

            try {

                const {
                    error
                } =
                    await supabase.auth
                        .signOut();

                if (error) {

                    console.error(
                        "❌ Logout failed:",
                        error
                    );

                    logoutButton.disabled =
                        false;

                    logoutButton.textContent =
                        "Sign Out";

                    return;
                }

                window.location.href =
                    "./index.html";

            } catch (error) {

                console.error(
                    "❌ Unexpected logout error:",
                    error
                );

                logoutButton.disabled =
                    false;

                logoutButton.textContent =
                    "Sign Out";
            }
        };
}

/* =========================================================
   NOTIFICATION STORAGE
========================================================= */

function getNotificationStorageKey() {

    if (!currentUser?.id) {
        return null;
    }

    return (
        NOTIFICATION_STORAGE_PREFIX +
        currentUser.id
    );
}

function getNotificationStateKey() {

    if (!currentUser?.id) {
        return null;
    }

    return (
        NOTIFICATION_STATE_PREFIX +
        currentUser.id
    );
}

function getNotifications() {

    const key =
        getNotificationStorageKey();

    if (!key) {
        return [];
    }

    const notifications =
        readStorage(
            key,
            []
        );

    return Array.isArray(
        notifications
    )
        ? notifications
        : [];
}

function saveNotifications(
    notifications
) {

    const key =
        getNotificationStorageKey();

    if (!key) {
        return;
    }

    writeStorage(
        key,
        notifications.slice(0, 50)
    );
}

function getNotificationState() {

    const key =
        getNotificationStateKey();

    if (!key) {
        return {};
    }

    const state =
        readStorage(
            key,
            {}
        );

    return (
        state &&
        typeof state === "object"
    )
        ? state
        : {};
}

function saveNotificationState(
    state
) {

    const key =
        getNotificationStateKey();

    if (!key) {
        return;
    }

    writeStorage(
        key,
        state
    );
}

/* =========================================================
   ADD NOTIFICATION
========================================================= */

function addNotification({
    id,
    type = "info",
    title,
    message,
    created_at =
        new Date().toISOString()
}) {

    if (!currentUser) {
        return;
    }

    if (!id) {
        return;
    }

    const notifications =
        getNotifications();

    const alreadyExists =
        notifications.some(
            notification =>
                notification.id === id
        );

    if (alreadyExists) {
        return;
    }

    notifications.unshift({

        id,

        type,

        title:
            title ||
            "Mwaniki Scholars",

        message:
            message ||
            "",

        created_at,

        read:
            false
    });

    saveNotifications(
        notifications
    );

    updateNotificationBadge();

    console.log(
        "🔔 Notification added:",
        title
    );
}

/* =========================================================
   WELCOME NOTIFICATION
========================================================= */

function createWelcomeNotification() {

    if (!currentUser) {
        return;
    }

    const state =
        getNotificationState();

    if (state.welcomeSent) {
        return;
    }

    addNotification({

        id:
            `welcome-${currentUser.id}`,

        type:
            "welcome",

        title:
            "Welcome to Mwaniki Scholars",

        message:
            `Welcome, ${getStudentFirstName()}. Your medical learning dashboard is ready. Explore courses, notes and quizzes to continue learning.`,

        created_at:
            new Date().toISOString()
    });

    state.welcomeSent =
        true;

    saveNotificationState(
        state
    );
}

/* =========================================================
   CONTENT NOTIFICATIONS
========================================================= */

function syncContentNotifications() {

    if (!currentUser) {
        return;
    }

    const state =
        getNotificationState();

    const currentCourseIds =
        allCourses.map(
            course =>
                String(course.id)
        );

    const currentNoteIds =
        allNotes.map(
            note =>
                String(note.id)
        );

    if (!state.contentBaselineReady) {

        state.knownCourseIds =
            currentCourseIds;

        state.knownNoteIds =
            currentNoteIds;

        state.contentBaselineReady =
            true;

        saveNotificationState(
            state
        );

    } else {

        const knownCourseIds =
            Array.isArray(
                state.knownCourseIds
            )
                ? state.knownCourseIds
                : [];

        const knownNoteIds =
            Array.isArray(
                state.knownNoteIds
            )
                ? state.knownNoteIds
                : [];

        const newCourses =
            allCourses.filter(
                course =>
                    !knownCourseIds.includes(
                        String(course.id)
                    )
            );

        const newNotes =
            allNotes.filter(
                note =>
                    !knownNoteIds.includes(
                        String(note.id)
                    )
            );

        if (newCourses.length) {

            addNotification({

                id:
                    `new-courses-${newCourses
                        .map(c => c.id)
                        .join("-")}`,

                type:
                    "course",

                title:
                    "New courses available",

                message:
                    newCourses.length === 1
                        ? `A new course, "${newCourses[0].title}", has been added to the Course Library.`
                        : `${newCourses.length} new courses have been added to the Course Library.`,

                created_at:
                    newCourses
                        .map(
                            c =>
                                c.created_at
                        )
                        .filter(Boolean)
                        .sort()
                        .pop() ||
                    new Date().toISOString()
            });
        }

        if (newNotes.length) {

            addNotification({

                id:
                    `new-notes-${newNotes
                        .map(n => n.id)
                        .join("-")}`,

                type:
                    "notes",

                title:
                    "New study notes available",

                message:
                    newNotes.length === 1
                        ? `A new study resource, "${newNotes[0].file_name || newNotes[0].unit || "Medical note"}", has been published.`
                        : `${newNotes.length} new study resources have been published in the Notes Library.`,

                created_at:
                    newNotes
                        .map(
                            n =>
                                n.created_at
                        )
                        .filter(Boolean)
                        .sort()
                        .pop() ||
                    new Date().toISOString()
            });
        }

        state.knownCourseIds =
            Array.from(
                new Set([
                    ...knownCourseIds,
                    ...currentCourseIds
                ])
            ).slice(-500);

        state.knownNoteIds =
            Array.from(
                new Set([
                    ...knownNoteIds,
                    ...currentNoteIds
                ])
            ).slice(-1000);

        saveNotificationState(
            state
        );
    }

    if (
        state.lastAppUpdateId !==
        APP_UPDATE_ID
    ) {

        addNotification({

            id:
                APP_UPDATE_ID,

            type:
                "update",

            title:
                "Mwaniki Scholars dashboard updated",

            message:
                "Your dashboard has received improvements to make your learning experience smoother. Check your profile, notifications, courses and study resources.",

            created_at:
                new Date().toISOString()
        });

        state.lastAppUpdateId =
            APP_UPDATE_ID;

        saveNotificationState(
            state
        );
    }

    updateNotificationBadge();
}

/* =========================================================
   NOTIFICATION BADGE
   ---------------------------------------------------------
   SHOWS NUMBER OF UNREAD NOTIFICATIONS
========================================================= */

function updateNotificationBadge() {

    const notifications =
        getNotifications();

    const unreadCount =
        notifications.filter(
            notification =>
                !notification.read
        ).length;

    const possibleBadges =
        $all(
            "#notificationBadge, [data-notification-count], .notification-badge, .notification-count"
        );

    possibleBadges.forEach(
        badge => {

            if (unreadCount > 0) {

                badge.textContent =
                    unreadCount > 99
                        ? "99+"
                        : String(
                            unreadCount
                        );

                badge.style.display =
                    "inline-flex";

                badge.style.visibility =
                    "visible";

                badge.setAttribute(
                    "aria-hidden",
                    "false"
                );

                badge.setAttribute(
                    "aria-label",
                    `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                );

            } else {

                badge.textContent =
                    "";

                badge.style.display =
                    "none";

                badge.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }
    );

    const panelCount =
        $("#notificationPanelCount");

    if (panelCount) {

        if (unreadCount > 0) {

            panelCount.textContent =
                unreadCount > 99
                    ? "99+"
                    : String(
                        unreadCount
                    );

            panelCount.hidden =
                false;

        } else {

            panelCount.textContent =
                "0";

            panelCount.hidden =
                true;
        }
    }

    const button =
        $("#notificationButton");

    if (button) {

        button.setAttribute(
            "aria-label",
            unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
        );

        button.dataset.unreadCount =
            String(unreadCount);
    }

    const visibleCount =
        $("#notificationCount");

    if (visibleCount) {

        visibleCount.textContent =
            String(unreadCount);

        visibleCount.style.display =
            unreadCount > 0
                ? ""
                : "none";
    }
}

/* =========================================================
   FORMAT NOTIFICATION DATE
========================================================= */

function formatNotificationDate(
    timestamp
) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleString(
        "en-KE",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotifications() {

    const content =
        $("#notificationContent");

    if (!content) {

        updateNotificationBadge();

        return;
    }

    const notifications =
        getNotifications()
            .sort(
                (a, b) =>
                    new Date(
                        b.created_at || 0
                    ) -
                    new Date(
                        a.created_at || 0
                    )
            );

    if (!notifications.length) {

        content.innerHTML = `

            <div class="empty-panel">

                <strong>
                    You are all caught up.
                </strong>

                <span>
                    New learning updates will appear here.
                </span>

            </div>

        `;

        updateNotificationBadge();

        return;
    }

    content.innerHTML =
        notifications
            .map(
                notification => {

                    const unreadClass =
                        notification.read
                            ? ""
                            : " unread";

                    return `

                        <article
                            class="notification-item${unreadClass}"
                            data-notification-id="${escapeHTML(notification.id)}"
                            tabindex="0"
                        >

                            <div
                                class="notification-item-header"
                            >

                                <strong>
                                    ${escapeHTML(
                                        notification.title
                                    )}
                                </strong>

                                ${
                                    notification.read
                                        ? ""
                                        : `
                                            <span
                                                class="notification-unread-dot"
                                                aria-label="Unread"
                                            ></span>
                                        `
                                }

                            </div>

                            <p>
                                ${escapeHTML(
                                    notification.message
                                )}
                            </p>

                            <small>
                                ${escapeHTML(
                                    formatNotificationDate(
                                        notification.created_at
                                    )
                                )}
                            </small>

                        </article>

                    `;
                }
            )
            .join("");

    content
        .querySelectorAll(
            "[data-notification-id]"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "click",
                    () => {

                        markNotificationRead(
                            item.dataset
                                .notificationId
                        );

                        renderNotifications();
                    }
                );

                item.addEventListener(
                    "keydown",
                    event => {

                        if (
                            event.key ===
                                "Enter" ||
                            event.key ===
                                " "
                        ) {

                            event.preventDefault();

                            markNotificationRead(
                                item.dataset
                                    .notificationId
                            );

                            renderNotifications();
                        }
                    }
                );
            }
        );

    updateNotificationBadge();
}

/* =========================================================
   MARK NOTIFICATION READ
========================================================= */

function markNotificationRead(
    notificationId
) {

    if (!notificationId) {
        return;
    }

    const notifications =
        getNotifications();

    let changed =
        false;

    const updated =
        notifications.map(
            notification => {

                if (
                    notification.id ===
                    notificationId
                ) {

                    changed =
                        true;

                    return {
                        ...notification,
                        read: true
                    };
                }

                return notification;
            }
        );

    if (changed) {

        saveNotifications(
            updated
        );

        updateNotificationBadge();
    }
}

function markAllNotificationsRead() {

    const notifications =
        getNotifications();

    if (!notifications.length) {

        updateNotificationBadge();

        return;
    }

    const updated =
        notifications.map(
            notification => ({
                ...notification,
                read: true
            })
        );

    saveNotifications(
        updated
    );

    updateNotificationBadge();

    renderNotifications();
}

/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function openNotificationPanel() {

    setPanelOpen(
        $("#notificationPanel"),
        true
    );
}

function closeNotificationPanel() {

    setPanelOpen(
        $("#notificationPanel"),
        false
    );
}

function setupNotificationPanel() {

    const button =
        $("#notificationButton");

    const closeButton =
        $("#closeNotificationPanel");

    const panel =
        $("#notificationPanel");

    if (!button) {

        console.warn(
            "⚠️ #notificationButton was not found."
        );

    } else {

        button.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                if (!panel) {
                    return;
                }

                const isOpen =
                    panel.classList
                        .contains("active");

                if (isOpen) {

                    closeNotificationPanel();

                } else {

                    renderNotifications();

                    openNotificationPanel();
                }
            };
    }

    if (closeButton) {

        closeButton.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                closeNotificationPanel();
            };
    }

    if (panel) {

        setPanelOpen(
            panel,
            false
        );
    }

    updateNotificationBadge();
}

/* =========================================================
   NAVIGATION
========================================================= */

function activateSection(
    sectionId
) {

    $all(
        ".nav-link"
    ).forEach(
        link => {

            const linkSection =
                link.dataset.section;

            if (!linkSection) {
                return;
            }

            const isActive =
                linkSection ===
                sectionId;

            link.classList.toggle(
                "active",
                isActive
            );

            if (isActive) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );
            }
        }
    );
}

function setupNavigation() {

    $all(
        ".nav-link"
    ).forEach(
        link => {

            const sectionId =
                link.dataset.section;

            if (!sectionId) {
                return;
            }

            link.addEventListener(
                "click",
                event => {

                    const section =
                        document.getElementById(
                            sectionId
                        );

                    if (!section) {
                        return;
                    }

                    event.preventDefault();

                    activateSection(
                        sectionId
                    );

                    section.scrollIntoView(
                        {
                            behavior:
                                "smooth",

                            block:
                                "start"
                        }
                    );
                }
            );
        }
    );

    $all(
        'a[href^="#"]'
    ).forEach(
        link => {

            if (
                link.classList
                    .contains("nav-link")
            ) {
                return;
            }

            link.addEventListener(
                "click",
                event => {

                    const targetId =
                        link
                            .getAttribute(
                                "href"
                            )
                            ?.slice(1);

                    if (!targetId) {
                        return;
                    }

                    const target =
                        document.getElementById(
                            targetId
                        );

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    target.scrollIntoView(
                        {
                            behavior:
                                "smooth",

                            block:
                                "start"
                        }
                    );

                    activateSection(
                        targetId
                    );
                }
            );
        }
    );
}

/* =========================================================
   COURSE LOADING
========================================================= */

async function loadCourses() {

    const courseGrid =
        $("#courseGrid");

    if (courseGrid) {

        courseGrid.innerHTML = `

            <div class="loading-state">
                Loading courses...
            </div>

        `;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select(`
                id,
                title,
                description,
                image,
                created_at
            `)
            .order(
                "id",
                {
                    ascending:
                        true
                }
            );

        if (error) {

            console.error(
                "❌ Course loading failed:",
                error
            );

            allCourses =
                [];

            if (courseGrid) {

                courseGrid.innerHTML = `

                    <div class="empty-state">
                        Unable to load courses.
                    </div>

                `;
            }

            updateDashboardStatistics();

            return;
        }

        allCourses =
            (data || [])
                .map(
                    normalizeCourse
                )
                .filter(Boolean);

        console.log(
            "📚 Courses loaded:",
            allCourses.length
        );

        renderCourseLibrary();

        renderRecentCourse();

        renderRecommendations();

        updateDashboardStatistics();

        /*
            Apply an existing search after fresh
            course data has loaded.
        */
        const searchInput =
            $("#courseSearch");

        if (
            searchInput &&
            searchInput.value.trim()
        ) {

            performCourseSearch(
                false
            );
        }

    } catch (error) {

        console.error(
            "❌ Unexpected course loading error:",
            error
        );

        allCourses =
            [];

        if (courseGrid) {

            courseGrid.innerHTML = `

                <div class="empty-state">
                    An unexpected error occurred while loading courses.
                </div>

            `;
        }

        updateDashboardStatistics();
    }
}

/* =========================================================
   COURSE LIBRARY RENDERING
   ---------------------------------------------------------
   NO COURSE IMAGE
   NO IMAGE PLACEHOLDER
========================================================= */

function renderCourseLibrary(
    coursesToRender = allCourses
) {

    const courseGrid =
        $("#courseGrid");

    if (!courseGrid) {

        console.warn(
            "⚠️ #courseGrid was not found."
        );

        return;
    }

    if (!coursesToRender.length) {

        courseGrid.innerHTML = `

            <div class="empty-state">
                No courses match your search.
            </div>

        `;

        return;
    }

    courseGrid.innerHTML =
        coursesToRender
            .map(
                course => `

                    <article
                        class="course-card"
                        data-course-id="${escapeHTML(
                            course.id
                        )}"
                    >

                        <div
                            class="course-card-content"
                        >

                            <h3>
                                ${escapeHTML(
                                    course.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    course.description ||
                                    "Explore this medical course and begin learning."
                                )}
                            </p>

                            <button
                                type="button"
                                class="course-card-button"
                                data-open-course="${escapeHTML(
                                    course.id
                                )}"
                            >
                                Start Learning
                            </button>

                        </div>

                    </article>

                `
            )
            .join("");

    courseGrid
        .querySelectorAll(
            "[data-open-course]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const courseId =
                            button.dataset
                                .openCourse;

                        const course =
                            allCourses.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        courseId
                                    )
                            );

                        openCourse(
                            course
                        );
                    }
                );
            }
        );
}

/* =========================================================
   COURSE SEARCH
   ---------------------------------------------------------
   FIXED:

   searchStatus is now properly declared.

   The search system:
   - searches title
   - searches description
   - works with Enter
   - works with Search button
   - works live while typing
   - supports Clear
   - supports "/" shortcut
========================================================= */

function performCourseSearch(
    shouldScroll = false
) {

    const searchInput =
        $("#courseSearch");

    const searchStatus =
        $("#courseSearchStatus");

    if (!searchInput) {
        return;
    }

    const searchTerm =
        String(
            searchInput.value || ""
        )
            .trim()
            .toLowerCase();

    if (!searchTerm) {

        renderCourseLibrary(
            allCourses
        );

        if (searchStatus) {

            searchStatus.textContent =
                `${allCourses.length.toLocaleString()} courses available`;

            searchStatus.dataset.messageType =
                "info";
        }

        if (shouldScroll) {

            scrollToCourses();
        }

        return;
    }

    const matchingCourses =
        allCourses.filter(
            course => {

                const searchableText =
                    `${course.title} ${course.description || ""}`
                        .toLowerCase();

                return searchableText
                    .includes(
                        searchTerm
                    );
            }
        );

    renderCourseLibrary(
        matchingCourses
    );

    if (searchStatus) {

        searchStatus.textContent =
            `${matchingCourses.length.toLocaleString()} course${matchingCourses.length === 1 ? "" : "s"} found`;

        searchStatus.dataset.messageType =
            matchingCourses.length
                ? "success"
                : "warning";
    }

    if (shouldScroll) {

        scrollToCourses();
    }
}

function clearCourseSearch() {

    const searchInput =
        $("#courseSearch");

    const searchStatus =
        $("#courseSearchStatus");

    if (searchInput) {
        searchInput.value = "";
    }

    renderCourseLibrary(
        allCourses
    );

    if (searchStatus) {

        searchStatus.textContent =
            `${allCourses.length.toLocaleString()} courses available`;

        searchStatus.dataset.messageType =
            "info";
    }
}

function scrollToCourses() {

    const coursesSection =
        $("#courses");

    if (!coursesSection) {
        return;
    }

    coursesSection.scrollIntoView(
        {
            behavior:
                "smooth",

            block:
                "start"
        }
    );

    activateSection(
        "courses"
    );
}

function setupCourseSearch() {

    const searchInput =
        $("#courseSearch");

    const searchButton =
        $("#searchCourseButton");

    const clearButton =
        $("#clearCourseSearchButton");

    /*
        IMPORTANT:
        This was the missing declaration that caused:

        ReferenceError: searchStatus is not defined
    */
    const searchStatus =
        $("#courseSearchStatus");

    /*
        Prevent duplicate event handlers.
        This function is called again after refresh.
    */
    if (searchInput) {

        searchInput.onkeydown =
            function (event) {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    performCourseSearch(
                        true
                    );
                }

                if (
                    event.key ===
                    "Escape"
                ) {

                    clearCourseSearch();
                }
            };

        searchInput.oninput =
            function () {

                performCourseSearch(
                    false
                );
            };
    }

    if (searchButton) {

        searchButton.onclick =
            function (event) {

                event.preventDefault();

                performCourseSearch(
                    true
                );
            };
    }

    if (clearButton) {

        clearButton.onclick =
            function (event) {

                event.preventDefault();

                clearCourseSearch();

                if (searchInput) {
                    searchInput.focus();
                }
            };
    }

    /*
        "/" focuses the course search.
    */
    if (
        !document.body.dataset
            .courseSearchShortcutReady
    ) {

        document.body.dataset
            .courseSearchShortcutReady =
            "true";

        document.addEventListener(
            "keydown",
            function (event) {

                const activeElement =
                    document.activeElement;

                const isTyping =
                    activeElement &&
                    (
                        activeElement.tagName ===
                            "INPUT" ||
                        activeElement.tagName ===
                            "TEXTAREA" ||
                        activeElement.isContentEditable
                    );

                if (
                    event.key === "/" &&
                    !isTyping
                ) {

                    const input =
                        $("#courseSearch");

                    if (input) {

                        event.preventDefault();

                        scrollToCourses();

                        setTimeout(
                            () => {
                                input.focus();
                            },
                            250
                        );
                    }
                }
            }
        );
    }

    /*
        Initialize the status safely.
    */
    if (searchStatus) {

        const existingTerm =
            searchInput?.value
                ?.trim();

        if (existingTerm) {

            searchStatus.textContent =
                "Searching courses...";

        } else {

            searchStatus.textContent =
                `${allCourses.length.toLocaleString()} courses available`;

            searchStatus.dataset.messageType =
                "info";
        }
    }

    console.log(
        "🔎 Course search initialized."
    );
}

/* =========================================================
   RECENT COURSE
   ---------------------------------------------------------
   NO IMAGE
   NO IMAGE PLACEHOLDER
========================================================= */

function renderRecentCourse() {

    const recentCourse =
        getLastCourse();

    const titleElement =
        $("#recentCourseTitle");

    const descriptionElement =
        $("#recentCourseDescription");

    const buttonElement =
        $("#recentCourseButton");

    if (
        !titleElement ||
        !descriptionElement ||
        !buttonElement
    ) {
        return;
    }

    if (!recentCourse) {

        titleElement.textContent =
            "No recent course";

        descriptionElement.textContent =
            "Choose a course from the library to begin learning.";

        buttonElement.textContent =
            "Explore Courses";

        buttonElement.onclick =
            function () {

                scrollToCourses();
            };

        return;
    }

    titleElement.textContent =
        recentCourse.title;

    descriptionElement.textContent =
        recentCourse.description ||
        "Continue learning from your previously selected course.";

    buttonElement.textContent =
        "Continue Learning";

    buttonElement.onclick =
        function () {

            openCourse(
                recentCourse
            );
        };
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function renderRecommendations() {

    const recommendationsGrid =
        $("#recommendationsGrid");

    if (!recommendationsGrid) {
        return;
    }

    if (!allCourses.length) {

        recommendationsGrid.innerHTML = `

            <div class="empty-state">
                Recommendations will appear when courses are available.
            </div>

        `;

        return;
    }

    const lastCourse =
        getLastCourse();

    let recommendations =
        allCourses.filter(
            course => {

                if (!lastCourse) {
                    return true;
                }

                return (
                    String(course.id) !==
                    String(lastCourse.id)
                );
            }
        );

    if (!recommendations.length) {
        recommendations =
            allCourses;
    }

    recommendations =
        recommendations.slice(
            0,
            3
        );

    recommendationsGrid.innerHTML =
        recommendations
            .map(
                course => `

                    <article
                        class="recommendation-card"
                    >

                        <div
                            class="recommendation-card-content"
                        >

                            <span
                                class="recommendation-label"
                            >
                                Recommended for you
                            </span>

                            <h3>
                                ${escapeHTML(
                                    course.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    course.description ||
                                    "Build your medical knowledge with this course."
                                )}
                            </p>

                            <button
                                type="button"
                                class="recommendation-button"
                                data-recommendation-course="${escapeHTML(
                                    course.id
                                )}"
                            >
                                Start Learning
                            </button>

                        </div>

                    </article>

                `
            )
            .join("");

    recommendationsGrid
        .querySelectorAll(
            "[data-recommendation-course]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const courseId =
                            button.dataset
                                .recommendationCourse;

                        const course =
                            allCourses.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        courseId
                                    )
                            );

                        openCourse(
                            course
                        );
                    }
                );
            }
        );
}

/* =========================================================
   NOTES LOADING
========================================================= */

async function loadNotes() {

    const notesGrid =
        $("#notesGrid");

    if (notesGrid) {

        notesGrid.innerHTML = `

            <div class="loading-state">
                Loading notes...
            </div>

        `;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select(`
                id,
                course,
                unit,
                file_name,
                file_url,
                created_at,
                uploaded_by,
                course_id,
                unit_id,
                published
            `)
            .eq(
                "published",
                true
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            );

        if (error) {

            console.error(
                "❌ Notes loading failed:",
                error
            );

            allNotes =
                [];

            if (notesGrid) {

                notesGrid.innerHTML = `

                    <div class="empty-state">
                        Unable to load notes.
                    </div>

                `;
            }

            updateDashboardStatistics();

            return;
        }

        allNotes =
            data || [];

        console.log(
            "📝 Notes loaded:",
            allNotes.length
        );

        renderNotesLibrary();

        updateDashboardStatistics();

    } catch (error) {

        console.error(
            "❌ Unexpected notes loading error:",
            error
        );

        allNotes =
            [];

        if (notesGrid) {

            notesGrid.innerHTML = `

                <div class="empty-state">
                    An unexpected error occurred while loading notes.
                </div>

            `;
        }

        updateDashboardStatistics();
    }
}

/* =========================================================
   SAFE NOTE URL
========================================================= */

function getSafeURL(
    url
) {

    if (!url) {
        return "";
    }

    const value =
        String(url).trim();

    if (!value) {
        return "";
    }

    if (
        /^https?:\/\//i.test(
            value
        ) ||
        value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../")
    ) {

        return value;
    }

    return "";
}

/* =========================================================
   NOTES LIBRARY
========================================================= */

function renderNotesLibrary() {

    const notesGrid =
        $("#notesGrid");

    if (!notesGrid) {

        console.warn(
            "⚠️ #notesGrid was not found."
        );

        return;
    }

    if (!allNotes.length) {

        notesGrid.innerHTML = `

            <div class="empty-state">
                No published notes are currently available.
            </div>

        `;

        return;
    }

    notesGrid.innerHTML =
        allNotes
            .map(
                note => {

                    const noteTitle =
                        note.file_name ||
                        note.unit ||
                        "Medical Study Note";

                    const courseName =
                        note.course ||
                        "Mwaniki Scholars";

                    const unitName =
                        note.unit ||
                        "Study material";

                    const noteURL =
                        getSafeURL(
                            note.file_url
                        );

                    const buttonHTML =
                        noteURL
                            ? `

                                <a
                                    href="${escapeHTML(
                                        noteURL
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="note-card-button"
                                >
                                    View Notes
                                </a>

                            `
                            : `

                                <span
                                    class="note-unavailable"
                                >
                                    File unavailable
                                </span>

                            `;

                    return `

                        <article
                            class="note-card"
                        >

                            <div
                                class="note-card-icon"
                            >
                                📄
                            </div>

                            <div
                                class="note-card-content"
                            >

                                <h3>
                                    ${escapeHTML(
                                        noteTitle
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        courseName
                                    )}
                                </p>

                                <span>
                                    ${escapeHTML(
                                        unitName
                                    )}
                                </span>

                                ${buttonHTML}

                            </div>

                        </article>

                    `;
                }
            )
            .join("");
}

/* =========================================================
   QUIZ LOADING
========================================================= */

async function loadQuizzes() {

    try {

        const {
            data,
            error
        } = await supabase
            .from("quizzes")
            .select(`
                id,
                course_id,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                created_at,
                course,
                unit
            `)
            .order(
                "id",
                {
                    ascending:
                        true
                }
            );

        if (error) {

            console.error(
                "❌ Quiz loading failed:",
                error
            );

            allQuizzes =
                [];

            updateDashboardStatistics();

            return;
        }

        allQuizzes =
            data || [];

        console.log(
            "📝 Quiz questions loaded:",
            allQuizzes.length
        );

        updateDashboardStatistics();

    } catch (error) {

        console.error(
            "❌ Unexpected quiz loading error:",
            error
        );

        allQuizzes =
            [];

        updateDashboardStatistics();
    }
}

/* =========================================================
   QUIZ PROGRESS
========================================================= */

function calculateQuizProgress() {

    const progress =
        readStorage(
            "mwanikiQuizProgress",
            {}
        );

    if (
        !progress ||
        typeof progress !== "object"
    ) {
        return 0;
    }

    const progressValues =
        Object.values(
            progress
        );

    if (!progressValues.length) {
        return 0;
    }

    let completed =
        0;

    progressValues.forEach(
        value => {

            if (
                typeof value ===
                "number"
            ) {

                completed +=
                    value > 0
                        ? 1
                        : 0;

            } else if (
                value &&
                typeof value ===
                    "object"
            ) {

                if (
                    value.completed ===
                        true ||

                    value.finished ===
                        true ||

                    value.score !==
                        undefined
                ) {

                    completed +=
                        1;
                }
            }
        }
    );

    return Math.min(
        100,
        Math.round(
            (
                completed /
                progressValues.length
            ) * 100
        )
    );
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function updateDashboardStatistics() {

    setCounterText(
        "#totalCourses",
        allCourses.length
    );

    setCounterText(
        "#totalNotes",
        allNotes.length
    );

    setCounterText(
        "#totalQuizzes",
        allQuizzes.length
    );

    const progress =
        calculateQuizProgress();

    setText(
        "#learningProgress",
        `${progress}%`
    );

    const progressBar =
        $("#learningProgressBar");

    if (progressBar) {

        progressBar.style.width =
            `${progress}%`;

        progressBar.setAttribute(
            "aria-valuenow",
            String(progress)
        );

        progressBar.setAttribute(
            "aria-valuemin",
            "0"
        );

        progressBar.setAttribute(
            "aria-valuemax",
            "100"
        );
    }
}

/* =========================================================
   COMPATIBILITY FUNCTIONS
========================================================= */

function updateDashboardStats() {
    updateDashboardStatistics();
}

window.updateDashboardStats =
    updateDashboardStats;

window.updateDashboardStatistics =
    updateDashboardStatistics;

/* =========================================================
   UNIT TRACKING
========================================================= */

function mwanikiTrackUnit(
    courseId,
    unitId,
    unitTitle,
    courseTitle
) {

    const activity =
        readStorage(
            "mwanikiRecentActivity",
            []
        );

    const newActivity = {

        courseId,

        unitId,

        unitTitle:
            unitTitle || "",

        courseTitle:
            courseTitle || "",

        timestamp:
            new Date().toISOString()
    };

    const updatedActivity = [

        newActivity,

        ...(
            Array.isArray(
                activity
            )
                ? activity
                : []
        )

    ].slice(
        0,
        20
    );

    writeStorage(
        "mwanikiRecentActivity",
        updatedActivity
    );

    const matchingCourse =
        allCourses.find(
            course =>
                String(
                    course.id
                ) ===
                String(
                    courseId
                )
        );

    const fallbackCourse =
        normalizeCourse({

            id:
                courseId,

            title:
                courseTitle ||
                "Selected Course"
        });

    const courseToSave =
        matchingCourse ||
        fallbackCourse;

    if (courseToSave) {

        saveLastCourse(
            courseToSave
        );

        saveRecentCourse(
            courseToSave
        );
    }

    writeStorage(
        "mwanikiLastUnit",
        {
            courseId,
            unitId,
            unitTitle:
                unitTitle || "",
            courseTitle:
                courseTitle || "",
            timestamp:
                new Date().toISOString()
        }
    );

    renderRecentCourse();

    renderRecommendations();
}

window.mwanikiTrackUnit =
    mwanikiTrackUnit;

/* =========================================================
   REFRESH BUTTONS
========================================================= */

function setupRefreshButtons() {

    const refreshCoursesButton =
        $("#refreshCoursesButton");

    const refreshNotesButton =
        $("#refreshNotesButton");

    if (refreshCoursesButton) {

        refreshCoursesButton.onclick =
            async function () {

                refreshCoursesButton.disabled =
                    true;

                refreshCoursesButton.textContent =
                    "Refreshing...";

                try {

                    await loadCourses();

                    syncContentNotifications();

                    renderNotifications();

                } catch (error) {

                    console.error(
                        "❌ Course refresh failed:",
                        error
                    );

                } finally {

                    refreshCoursesButton.disabled =
                        false;

                    refreshCoursesButton.textContent =
                        "Refresh";
                }
            };
    }

    if (refreshNotesButton) {

        refreshNotesButton.onclick =
            async function () {

                refreshNotesButton.disabled =
                    true;

                refreshNotesButton.textContent =
                    "Refreshing...";

                try {

                    await loadNotes();

                    syncContentNotifications();

                    renderNotifications();

                } catch (error) {

                    console.error(
                        "❌ Notes refresh failed:",
                        error
                    );

                } finally {

                    refreshNotesButton.disabled =
                        false;

                    refreshNotesButton.textContent =
                        "Refresh";
                }
            };
    }
}

/* =========================================================
   GENERIC CARD FILTER
========================================================= */

function filterCards(
    input,
    cardSelector
) {

    if (!input) {
        return;
    }

    const searchTerm =
        input.value
            .trim()
            .toLowerCase();

    $all(
        cardSelector
    ).forEach(
        card => {

            const cardText =
                card.textContent
                    .toLowerCase();

            card.style.display =
                !searchTerm ||
                cardText.includes(
                    searchTerm
                )
                    ? ""
                    : "none";
        }
    );
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const notesSearch =
        $("#notesSearch");

    if (notesSearch) {

        notesSearch.oninput =
            function () {

                filterCards(
                    notesSearch,
                    ".note-card"
                );
            };
    }

    $all(
        "[data-dashboard-search]"
    ).forEach(
        input => {

            const target =
                input.dataset
                    .dashboardSearch;

            if (
                target ===
                "notes"
            ) {

                input.oninput =
                    function () {

                        filterCards(
                            input,
                            ".note-card"
                        );
                    };

            } else if (
                target ===
                "courses"
            ) {

                input.oninput =
                    function () {

                        const courseSearch =
                            $("#courseSearch");

                        if (
                            courseSearch &&
                            input !== courseSearch
                        ) {

                            courseSearch.value =
                                input.value;
                        }

                        performCourseSearch(
                            false
                        );
                    };
            }
        }
    );

    setupCourseSearch();
}

/* =========================================================
   TURBO AI
   ---------------------------------------------------------
   COMPLETELY SEPARATE FROM MWANIKI AI

   Mwaniki AI IDs are NOT USED HERE.

   Turbo AI IDs:
   #turboAIQuestion
   #askTurboAIButton
   #turboAIAnswer
   #turboAIStatus
   #turboAIRecentQuestions
========================================================= */

/* =========================================================
   TURBO AI RECENT QUESTIONS
========================================================= */

function getTurboAIRecentQuestions() {

    const questions =
        readStorage(
            TURBO_AI_RECENT_QUESTIONS_KEY,
            []
        );

    return Array.isArray(
        questions
    )
        ? questions
        : [];
}

function saveTurboAIQuestion(
    question
) {

    const cleanedQuestion =
        String(
            question || ""
        ).trim();

    if (!cleanedQuestion) {
        return;
    }

    const existing =
        getTurboAIRecentQuestions();

    const filtered =
        existing.filter(
            item =>
                String(
                    item.question || ""
                ).toLowerCase() !==
                cleanedQuestion.toLowerCase()
        );

    filtered.unshift({

        question:
            cleanedQuestion,

        timestamp:
            new Date().toISOString()
    });

    writeStorage(
        TURBO_AI_RECENT_QUESTIONS_KEY,
        filtered.slice(
            0,
            8
        )
    );
}

function renderTurboAIRecentQuestions() {

    const container =
        $("#turboAIRecentQuestions");

    if (!container) {
        return;
    }

    const questions =
        getTurboAIRecentQuestions();

    if (!questions.length) {

        container.innerHTML = `

            <div class="turbo-ai-empty-history">
                Your recent Turbo AI questions will appear here.
            </div>

        `;

        return;
    }

    container.innerHTML =
        questions
            .map(
                item => `

                    <button
                        type="button"
                        class="turbo-ai-history-item"
                        data-turbo-question="${escapeHTML(
                            item.question
                        )}"
                    >
                        ${escapeHTML(
                            item.question
                        )}
                    </button>

                `
            )
            .join("");

    container
        .querySelectorAll(
            "[data-turbo-question]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const input =
                            $("#turboAIQuestion");

                        if (!input) {
                            return;
                        }

                        input.value =
                            button.dataset
                                .turboQuestion ||
                            "";

                        input.focus();

                        scrollToTurboAI();
                    }
                );
            }
        );
}

/* =========================================================
   TURBO AI STATUS
========================================================= */

function setTurboAIStatus(
    message,
    type = "info"
) {

    const status =
        $("#turboAIStatus");

    if (!status) {
        return;
    }

    status.textContent =
        message || "";

    status.dataset.messageType =
        type;

    status.style.display =
        message
            ? ""
            : "none";
}

/* =========================================================
   TURBO AI SCROLL
========================================================= */

function scrollToTurboAI() {

    const section =
        $("#turbo-ai") ||
        $("#turboAISection");

    if (!section) {
        return;
    }

    section.scrollIntoView(
        {
            behavior:
                "smooth",

            block:
                "start"
        }
    );

    activateSection(
        "turbo-ai"
    );
}

/* =========================================================
   ASK TURBO AI
========================================================= */

async function askTurboAI() {
    const questionInput = document.getElementById("turboAIQuestion");
    const answerBox = document.getElementById("turboAIAnswer");
    const statusBox = document.getElementById("turboAIStatus");
    const askButton = document.getElementById("askTurboAIButton");

    if (!questionInput || !answerBox || !askButton) {
        console.error("❌ Turbo AI elements were not found.");
        return;
    }

    const question = questionInput.value.trim();

    if (!question) {
        if (statusBox) {
            statusBox.textContent = "Please enter a question.";
        }

        answerBox.innerHTML =
            "<p>Please enter a question for Turbo AI.</p>";

        questionInput.focus();
        return;
    }

    askButton.disabled = true;

    if (statusBox) {
        statusBox.textContent = "Turbo AI is thinking...";
    }

    answerBox.innerHTML = `
        <div class="turbo-ai-loading">
            <span>Turbo AI is preparing your answer...</span>
        </div>
    `;

    try {
        console.log("🤖 Sending question to Turbo AI...");

        const {
            data,
            error
        } = await supabase.functions.invoke(
            "turbo-ai",
            {
                body: {
                    message: question
                }
            }
        );

        if (error) {
            console.error(
                "❌ Turbo AI function error:",
                error
            );

            throw new Error(
                error.message ||
                "Turbo AI could not be reached."
            );
        }

        if (!data) {
            throw new Error(
                "Turbo AI returned no response."
            );
        }

        if (!data.success) {
            throw new Error(
                data.error ||
                "Turbo AI could not answer the question."
            );
        }

        const answer =
            typeof data.answer === "string"
                ? data.answer.trim()
                : "";

        if (!answer) {
            throw new Error(
                "Turbo AI returned an empty answer."
            );
        }

        answerBox.innerHTML = `
            <div class="turbo-ai-response">
                ${formatTurboAIAnswer(answer)}
            </div>
        `;

        if (statusBox) {
            statusBox.textContent =
                "Turbo AI response ready.";
        }

        saveTurboAIRecentQuestion(question);

        console.log(
            "✅ Turbo AI response received successfully."
        );

    } catch (error) {

        console.error(
            "❌ Turbo AI request failed:",
            error
        );

        answerBox.innerHTML = `
            <div class="turbo-ai-error">
                <strong>Turbo AI could not respond.</strong>
                <p>
                    ${escapeHTML(
                        error.message ||
                        "Please try again."
                    )}
                </p>
            </div>
        `;

        if (statusBox) {
            statusBox.textContent =
                "Turbo AI request failed.";
        }

    } finally {
        askButton.disabled = false;
    }
}

/* =========================================================
   TURBO AI EVENT HANDLER
========================================================= */

function setupTurboAI() {

    const askButton =
        $("#askTurboAIButton");

    const questionInput =
        $("#turboAIQuestion");

    const clearButton =
        $("#clearTurboAIButton");

    const section =
        $("#turbo-ai") ||
        $("#turboAISection");

    if (!askButton || !questionInput) {

        console.log(
            "ℹ️ Turbo AI dashboard interface is not present on this page."
        );

        return;
    }

    /*
        Use onclick/onkeydown rather than repeatedly
        adding listeners because initialization can happen
        again after authentication.
    */

    askButton.onclick =
        function (event) {

            event.preventDefault();

            askTurboAI();
        };

    questionInput.onkeydown =
        function (event) {

            if (
                event.key === "Enter" &&
                event.ctrlKey
            ) {

                event.preventDefault();

                askTurboAI();
            }
        };

    if (clearButton) {

        clearButton.onclick =
            function (event) {

                event.preventDefault();

                questionInput.value =
                    "";

                const answer =
                    $("#turboAIAnswer");

                if (answer) {

                    answer.textContent =
                        "Ask Turbo AI a medical learning question.";

                    answer.dataset.messageType =
                        "info";
                }

                setTurboAIStatus(
                    "",
                    "info"
                );

                questionInput.focus();
            };
    }

    renderTurboAIRecentQuestions();

    console.log(
        "🤖 Turbo AI dashboard interface ready."
    );

    if (section) {

        section.dataset.turboAIReady =
            "true";
    }
}

/* =========================================================
   OUTSIDE PANEL CLOSING
========================================================= */

function setupOutsidePanelClosing() {

    if (
        document.body.dataset
            .outsidePanelsReady
    ) {
        return;
    }

    document.body.dataset
        .outsidePanelsReady =
        "true";

    document.addEventListener(
        "click",
        function (event) {

            const profilePanel =
                $("#profilePanel");

            const notificationPanel =
                $("#notificationPanel");

            const profileButton =
                $("#profileButton");

            const notificationButton =
                $("#notificationButton");

            if (
                profilePanel &&
                profilePanel.classList
                    .contains("active") &&
                !profilePanel.contains(
                    event.target
                ) &&
                !profileButton?.contains(
                    event.target
                )
            ) {

                closeProfilePanel();
            }

            if (
                notificationPanel &&
                notificationPanel.classList
                    .contains("active") &&
                !notificationPanel.contains(
                    event.target
                ) &&
                !notificationButton?.contains(
                    event.target
                )
            ) {

                closeNotificationPanel();
            }
        }
    );
}

/* =========================================================
   ESCAPE KEY
========================================================= */

function setupEscapeKey() {

    if (
        document.body.dataset
            .escapeKeyReady
    ) {
        return;
    }

    document.body.dataset
        .escapeKeyReady =
        "true";

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            closeProfilePanel();

            closeNotificationPanel();
        }
    );
}

/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

async function initializeDashboard() {

    if (
        dashboardInitializing ||
        dashboardReady
    ) {
        return;
    }

    dashboardInitializing =
        true;

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    try {

        startDashboardClock();

        setupNavigation();

        setupNotificationPanel();

        setupProfilePanel();

        setupProfileForm();

        setupProfilePhoto();

        setupChangePassword();

        setupLogout();

        setupRefreshButtons();

        setupSearch();

        setupTurboAI();

        setupOutsidePanelClosing();

        setupEscapeKey();

        currentUser =
            await getAuthenticatedUser();

        if (!currentUser) {

            console.warn(
                "⚠️ No authenticated user found."
            );

            window.location.href =
                "./index.html";

            return;
        }

        console.log(
            "🔐 Authenticated user:",
            currentUser.email
        );

        const profileLoaded =
            await loadStudentProfile();

        if (!profileLoaded) {

            console.warn(
                "⚠️ Student profile was not loaded, but dashboard will continue."
            );
        }

        createWelcomeNotification();

        /*
            Load all dashboard data independently.
            A failure in one section does not prevent
            the others from loading.
        */

        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        /*
            Course search is initialized AFTER course
            data has arrived.
        */
        setupCourseSearch();

        syncContentNotifications();

        renderStudentProfile();

        repairProfileFields();

        renderRecentCourse();

        renderRecommendations();

        renderNotesLibrary();

        renderNotifications();

        updateNotificationBadge();

        updateDashboardStatistics();

        dashboardReady =
            true;

        console.log(
            "✅ Mwaniki Scholars dashboard ready"
        );

    } catch (error) {

        console.error(
            "❌ Dashboard initialization failed:",
            error
        );

    } finally {

        dashboardInitializing =
            false;
    }
}

/* =========================================================
   PUBLIC DASHBOARD API
========================================================= */

window.mwanikiDashboard = {

    getCurrentUser() {
        return currentUser;
    },

    getCurrentStudent() {
        return currentStudent;
    },

    getCourses() {
        return allCourses;
    },

    getNotes() {
        return allNotes;
    },

    getQuizzes() {
        return allQuizzes;
    },

    refreshCourses:
        async function () {

            await loadCourses();

            setupCourseSearch();

            syncContentNotifications();

            updateDashboardStatistics();

            updateNotificationBadge();
        },

    refreshNotes:
        async function () {

            await loadNotes();

            syncContentNotifications();

            updateDashboardStatistics();

            updateNotificationBadge();
        },

    refreshAll:
        async function () {

            await Promise.all([
                loadCourses(),
                loadNotes(),
                loadQuizzes()
            ]);

            setupCourseSearch();

            syncContentNotifications();

            renderRecentCourse();

            renderRecommendations();

            updateDashboardStatistics();

            renderNotifications();

            updateNotificationBadge();
        },

    openProfile:
        function () {

            renderStudentProfile();

            openProfilePanel();
        },

    closeProfile:
        closeProfilePanel,

    openNotifications:
        function () {

            renderNotifications();

            openNotificationPanel();
        },

    closeNotifications:
        closeNotificationPanel,

    markNotificationsRead:
        markAllNotificationsRead,

    searchCourses:
        function (term) {

            const searchInput =
                $("#courseSearch");

            if (!searchInput) {
                return;
            }

            searchInput.value =
                String(term || "");

            performCourseSearch(
                true
            );
        },

    askTurboAI:
        askTurboAI
};

/* =========================================================
   PUBLIC NOTIFICATION FUNCTION
========================================================= */

window.mwanikiAddNotification =
    function (notification) {

        addNotification(
            notification
        );

        renderNotifications();

        updateNotificationBadge();
    };

/* =========================================================
   AUTH STATE LISTENER
========================================================= */

supabase.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "🔐 Auth state:",
            event
        );

        if (
            event ===
            "SIGNED_OUT"
        ) {

            handleSignedOut();

            return;
        }

        if (
            event ===
                "SIGNED_IN" &&
            session?.user &&
            !dashboardReady &&
            !dashboardInitializing
        ) {

            initializeDashboard();
        }
    }
);

/* =========================================================
   START DASHBOARD
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        {
            once: true
        }
    );

} else {

    initializeDashboard();
}

/* =========================================================
   FINAL STARTUP LOG
========================================================= */

console.log(
    "✅ Mwaniki Scholars dashboard.js loaded successfully."
);
