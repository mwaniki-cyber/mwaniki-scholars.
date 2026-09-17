import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
   ALIGNED WITH THE CURRENT dashboard.html
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

let authListenerStarted = false;
let notificationSystemStarted = false;
let profileSystemStarted = false;

/* =========================================================
   CONFIGURATION
========================================================= */

const PROFILE_PHOTO_BUCKET = "student-profiles";

const STORAGE_KEYS = {
    selectedCourse: "selectedCourse",
    selectedCourseName: "selectedCourseName",
    selectedUnit: "selectedUnit",
    selectedUnitTitle: "selectedUnitTitle",
    lastCourse: "mwanikiLastCourse",
    recentCourses: "mwanikiRecentCourses",
    recentActivity: "mwanikiRecentActivity",
    lastUnit: "mwanikiLastUnit",
    quizProgress: "mwanikiQuizProgress",
    notifications: "mwanikiNotifications",
    notificationState: "mwanikiNotificationState"
};

/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
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

    const number = Number(value);

    element.textContent = Number.isFinite(number)
        ? number.toLocaleString()
        : "0";
}

function showMessage(selector, message, type = "info") {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent = message ?? "";
    element.dataset.type = type;
}

/* =========================================================
   LOCAL STORAGE HELPERS
========================================================= */

function readStorage(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);

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

function writeStorage(key, value) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;
    } catch (error) {
        console.warn(
            `⚠️ Could not write localStorage key: ${key}`,
            error
        );

        return false;
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
        title,
        description:
            course.description || "",
        image:
            course.image || "",
        created_at:
            course.created_at || null
    };
}

function getCourseURL(course) {
    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return "./courses.html";
    }

    return `./course.html?course_id=${encodeURIComponent(
        normalizedCourse.id
    )}`;
}

/* =========================================================
   RECENT COURSE STORAGE
========================================================= */

function getLastCourse() {
    const storedCourse =
        readStorage(
            STORAGE_KEYS.lastCourse,
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
        STORAGE_KEYS.lastCourse,
        normalizedCourse
    );
}

function getRecentCourses() {
    const recentCourses =
        readStorage(
            STORAGE_KEYS.recentCourses,
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
        STORAGE_KEYS.recentCourses,
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
        STORAGE_KEYS.selectedCourse,
        normalizedCourse.id
    );

    writeStorage(
        STORAGE_KEYS.selectedCourseName,
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

    const now = new Date();

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
        console.log(
            "👤 Loading student profile..."
        );

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
                    currentUser
                        .email
                        ?.split("@")[0] ||
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
    return (
        getStudentDisplayName()
            .trim()
            .split(/\s+/)[0] ||
        "Student"
    );
}

function getStudentInitials() {
    const name =
        getStudentDisplayName()
            .trim();

    if (!name) {
        return "MS";
    }

    const parts =
        name
            .split(/\s+/)
            .filter(Boolean);

    if (parts.length === 1) {
        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1]
            .charAt(0)
    ).toUpperCase();
}

/* =========================================================
   PROFILE IMAGE
========================================================= */

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

    const displayName =
        name || "Student";

    const url =
        String(photoURL || "")
            .trim();

    if (!url) {
        element.removeAttribute(
            "src"
        );

        element.alt =
            `${displayName} profile`;

        element.style.display =
            "none";

        return;
    }

    element.src = url;

    element.alt =
        `${displayName} profile photo`;

    element.style.display =
        "block";

    element.style.visibility =
        "visible";

    element.style.opacity =
        "1";

    element.onerror =
        function () {
            console.warn(
                "⚠️ Profile image could not be loaded."
            );

            this.removeAttribute(
                "src"
            );

            this.style.display =
                "none";
        };
}

/* =========================================================
   PROFILE RENDERING
========================================================= */

function renderStudentProfile() {
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

    const profileName =
        $("#profileName");

    if (profileName) {
        if (
            profileName.tagName ===
                "INPUT" ||
            profileName.tagName ===
                "TEXTAREA" ||
            profileName.tagName ===
                "SELECT"
        ) {
            profileName.value =
                currentStudent
                    ?.full_name ||
                displayName;
        } else {
            profileName.textContent =
                currentStudent
                    ?.full_name ||
                displayName;
        }
    }

    const profileEmail =
        $("#profileEmail");

    if (profileEmail) {
        if (
            profileEmail.tagName ===
                "INPUT" ||
            profileEmail.tagName ===
                "TEXTAREA" ||
            profileEmail.tagName ===
                "SELECT"
        ) {
            profileEmail.value =
                currentStudent
                    ?.email ||
                currentUser?.email ||
                "";
        } else {
            profileEmail.textContent =
                currentStudent
                    ?.email ||
                currentUser?.email ||
                "";
        }
    }

    const profilePhone =
        $("#profilePhone");

    if (profilePhone) {
        if (
            profilePhone.tagName ===
                "INPUT" ||
            profilePhone.tagName ===
                "TEXTAREA" ||
            profilePhone.tagName ===
                "SELECT"
        ) {
            profilePhone.value =
                currentStudent
                    ?.phone ||
                "";
        } else {
            profilePhone.textContent =
                currentStudent
                    ?.phone ||
                "";
        }
    }

    const profileCourse =
        $("#profileCourse");

    if (profileCourse) {
        if (
            profileCourse.tagName ===
                "INPUT" ||
            profileCourse.tagName ===
                "TEXTAREA" ||
            profileCourse.tagName ===
                "SELECT"
        ) {
            profileCourse.value =
                currentStudent
                    ?.course ||
                "";
        } else {
            profileCourse.textContent =
                currentStudent
                    ?.course ||
                "";
        }
    }

    const profileLevel =
        $("#profileLevel");

    if (profileLevel) {
        if (
            profileLevel.tagName ===
                "INPUT" ||
            profileLevel.tagName ===
                "TEXTAREA" ||
            profileLevel.tagName ===
                "SELECT"
        ) {
            profileLevel.value =
                currentStudent
                    ?.level ||
                "";
        } else {
            profileLevel.textContent =
                currentStudent
                    ?.level ||
                "";
        }
    }

    const photoURL =
        currentStudent
            ?.photo_url ||
        "";

    if (photoURL) {
        setAvatar(
            "#headerProfileAvatar",
            photoURL,
            displayName
        );

        setAvatar(
            "#profileLargeAvatar",
            photoURL,
            displayName
        );
    } else {
        setAvatar(
            "#headerProfileAvatar",
            "",
            displayName
        );

        setAvatar(
            "#profileLargeAvatar",
            "",
            displayName
        );
    }

    /*
       Update initials fallback if the HTML
       contains initials elements.
    */
    setText(
        "#studentAvatarInitials",
        getStudentInitials()
    );

    setText(
        "#profileAvatarInitials",
        getStudentInitials()
    );
}/* =========================================================
   PROFILE PANEL
========================================================= */

function openProfilePanel() {
    const panel =
        $("#profilePanel");

    if (!panel) {
        return;
    }

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
}

function closeProfilePanel() {
    const panel =
        $("#profilePanel");

    if (!panel) {
        return;
    }

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
}

function setupProfilePanel() {
    const profileButton =
        $("#profileButton");

    const closeProfileButton =
        $("#closeProfilePanel");

    if (
        profileButton &&
        !profileButton.dataset
            .profileConnected
    ) {
        profileButton.dataset
            .profileConnected =
            "true";

        profileButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();

                renderStudentProfile();
                populateProfileFields();
                openProfilePanel();
            }
        );
    }

    if (
        closeProfileButton &&
        !closeProfileButton.dataset
            .profileCloseConnected
    ) {
        closeProfileButton.dataset
            .profileCloseConnected =
            "true";

        closeProfileButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();

                closeProfilePanel();
            }
        );
    }
}

/* =========================================================
   PROFILE FORM
========================================================= */

function populateProfileFields() {
    if (!currentStudent) {
        return;
    }

    const name =
        currentStudent.full_name ||
        getStudentDisplayName();

    const email =
        currentStudent.email ||
        currentUser?.email ||
        "";

    const phone =
        currentStudent.phone ||
        "";

    const course =
        currentStudent.course ||
        "";

    const level =
        currentStudent.level ||
        "";

    const profileName =
        $("#profileName");

    if (profileName) {
        if (
            profileName.tagName ===
                "INPUT" ||
            profileName.tagName ===
                "TEXTAREA"
        ) {
            profileName.value =
                name;
        }
    }

    const profileEmail =
        $("#profileEmail");

    if (profileEmail) {
        if (
            profileEmail.tagName ===
                "INPUT" ||
            profileEmail.tagName ===
                "TEXTAREA"
        ) {
            profileEmail.value =
                email;

            profileEmail.readOnly =
                true;
        }
    }

    const profilePhone =
        $("#profilePhone");

    if (
        profilePhone &&
        (
            profilePhone.tagName ===
                "INPUT" ||
            profilePhone.tagName ===
                "TEXTAREA"
        )
    ) {
        profilePhone.value =
            phone;
    }

    const profileCourse =
        $("#profileCourse");

    if (
        profileCourse &&
        (
            profileCourse.tagName ===
                "INPUT" ||
            profileCourse.tagName ===
                "TEXTAREA" ||
            profileCourse.tagName ===
                "SELECT"
        )
    ) {
        profileCourse.value =
            course;
    }

    const profileLevel =
        $("#profileLevel");

    if (
        profileLevel &&
        (
            profileLevel.tagName ===
                "INPUT" ||
            profileLevel.tagName ===
                "TEXTAREA" ||
            profileLevel.tagName ===
                "SELECT"
        )
    ) {
        profileLevel.value =
            level;
    }
}

function setupProfileForm() {
    const saveButton =
        $("#saveProfileButton");

    if (
        !saveButton ||
        saveButton.dataset
            .profileSaveConnected ===
            "true"
    ) {
        return;
    }

    saveButton.dataset
        .profileSaveConnected =
        "true";

    saveButton.addEventListener(
        "click",
        async event => {
            event.preventDefault();

            await saveStudentProfile();
        }
    );
}

async function saveStudentProfile() {
    if (
        !currentUser ||
        !currentStudent
    ) {
        return;
    }

    const profileName =
        $("#profileName");

    const profilePhone =
        $("#profilePhone");

    const profileCourse =
        $("#profileCourse");

    const profileLevel =
        $("#profileLevel");

    let fullName =
        currentStudent.full_name ||
        getStudentDisplayName();

    if (
        profileName &&
        (
            profileName.tagName ===
                "INPUT" ||
            profileName.tagName ===
                "TEXTAREA"
        )
    ) {
        fullName =
            profileName.value.trim();
    }

    let phone =
        currentStudent.phone ||
        "";

    if (
        profilePhone &&
        (
            profilePhone.tagName ===
                "INPUT" ||
            profilePhone.tagName ===
                "TEXTAREA"
        )
    ) {
        phone =
            profilePhone.value.trim();
    }

    let course =
        currentStudent.course ||
        "";

    if (
        profileCourse &&
        (
            profileCourse.tagName ===
                "INPUT" ||
            profileCourse.tagName ===
                "TEXTAREA" ||
            profileCourse.tagName ===
                "SELECT"
        )
    ) {
        course =
            profileCourse.value.trim();
    }

    let level =
        currentStudent.level ||
        "";

    if (
        profileLevel &&
        (
            profileLevel.tagName ===
                "INPUT" ||
            profileLevel.tagName ===
                "TEXTAREA" ||
            profileLevel.tagName ===
                "SELECT"
        )
    ) {
        level =
            profileLevel.value.trim();
    }

    if (!fullName) {
        showMessage(
            "#profileSaveStatus",
            "Please enter your full name.",
            "error"
        );

        return;
    }

    const saveStatus =
        $("#profileSaveStatus");

    if (saveStatus) {
        saveStatus.textContent =
            "Saving profile...";
    }

    try {
        const updateData = {
            full_name:
                fullName,
            phone,
            course,
            level
        };

        /*
           IMPORTANT:
           Preserve the existing photo URL.
        */
        if (
            currentStudent.photo_url
        ) {
            updateData.photo_url =
                currentStudent.photo_url;
        }

        const {
            data,
            error
        } = await supabase
            .from("students")
            .update(updateData)
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

            if (saveStatus) {
                saveStatus.textContent =
                    "Could not save profile.";
            }

            return;
        }

        currentStudent = {
            ...currentStudent,
            ...(data || {}),
            ...updateData
        };

        renderStudentProfile();
        populateProfileFields();

        if (saveStatus) {
            saveStatus.textContent =
                "Profile saved successfully.";
        }

    } catch (error) {
        console.error(
            "❌ Unexpected profile save error:",
            error
        );

        if (saveStatus) {
            saveStatus.textContent =
                "Unexpected error while saving.";
        }
    }
}

/* =========================================================
   PROFILE PHOTO UPLOAD
   BUCKET: student-profiles
========================================================= */

function setupProfilePhoto() {
    const photoInput =
        $("#profilePhotoInput");

    if (!photoInput) {
        console.log(
            "ℹ️ #profilePhotoInput was not found."
        );

        return;
    }

    if (
        photoInput.dataset
            .profilePhotoConnected ===
        "true"
    ) {
        return;
    }

    photoInput.dataset
        .profilePhotoConnected =
        "true";

    photoInput.addEventListener(
        "change",
        async event => {
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

                photoInput.value = "";
                return;
            }

            const maximumSize =
                5 * 1024 * 1024;

            if (
                file.size >
                maximumSize
            ) {
                showMessage(
                    "#profileSaveStatus",
                    "Profile photos must be 5 MB or smaller.",
                    "error"
                );

                photoInput.value = "";
                return;
            }

            const previewURL =
                URL.createObjectURL(
                    file
                );

            const displayName =
                getStudentDisplayName();

            setAvatar(
                "#headerProfileAvatar",
                previewURL,
                displayName
            );

            setAvatar(
                "#profileLargeAvatar",
                previewURL,
                displayName
            );

            showMessage(
                "#profileSaveStatus",
                "Uploading profile photo...",
                "info"
            );

            try {
                const uploadedURL =
                    await uploadProfilePhoto(
                        file
                    );

                if (!uploadedURL) {
                    renderStudentProfile();
                    return;
                }

                if (currentStudent) {
                    currentStudent.photo_url =
                        uploadedURL;
                }

                renderStudentProfile();

                showMessage(
                    "#profileSaveStatus",
                    "Profile photo updated successfully.",
                    "success"
                );

            } catch (error) {
                console.error(
                    "❌ Profile photo error:",
                    error
                );

                renderStudentProfile();

                showMessage(
                    "#profileSaveStatus",
                    "Unable to upload your profile photo.",
                    "error"
                );

            } finally {
                URL.revokeObjectURL(
                    previewURL
                );

                photoInput.value = "";
            }
        }
    );

    console.log(
        "✅ Profile photo input connected."
    );
}

/* =========================================================
   UPLOAD PHOTO TO STORAGE
========================================================= */

async function uploadProfilePhoto(file) {
    if (!file) {
        return null;
    }

    if (!currentUser?.id) {
        showMessage(
            "#profileSaveStatus",
            "You must be signed in before uploading a photo.",
            "error"
        );

        return null;
    }

    try {
        let extension =
            "jpg";

        if (
            file.name &&
            file.name.includes(".")
        ) {
            extension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]/g,
                        ""
                    );
        }

        const filePath =
            `${currentUser.id}/profile-${Date.now()}.${extension}`;

        console.log(
            "📤 Uploading profile photo:",
            filePath
        );

        const {
            error:
                uploadError
        } =
            await supabase.storage
                .from(
                    PROFILE_PHOTO_BUCKET
                )
                .upload(
                    filePath,
                    file,
                    {
                        cacheControl:
                            "3600",
                        upsert:
                            true,
                        contentType:
                            file.type ||
                            "image/jpeg"
                    }
                );

        if (uploadError) {
            console.error(
                "❌ Supabase Storage upload failed:",
                uploadError
            );

            showMessage(
                "#profileSaveStatus",
                `Photo upload failed: ${uploadError.message}`,
                "error"
            );

            return null;
        }

        const {
            data:
                publicURLData
        } =
            supabase.storage
                .from(
                    PROFILE_PHOTO_BUCKET
                )
                .getPublicUrl(
                    filePath
                );

        const publicURL =
            publicURLData?.publicUrl ||
            "";

        if (!publicURL) {
            showMessage(
                "#profileSaveStatus",
                "Photo uploaded, but its public URL could not be obtained.",
                "error"
            );

            return null;
        }

        console.log(
            "🔗 Profile photo public URL obtained."
        );

        const {
            error:
                databaseError
        } =
            await supabase
                .from("students")
                .update({
                    photo_url:
                        publicURL
                })
                .eq(
                    "id",
                    currentUser.id
                );

        if (databaseError) {
            console.error(
                "❌ Could not save photo URL:",
                databaseError
            );

            showMessage(
                "#profileSaveStatus",
                `Photo uploaded but could not save the profile URL: ${databaseError.message}`,
                "error"
            );

            return null;
        }

        if (currentStudent) {
            currentStudent.photo_url =
                publicURL;
        }

        console.log(
            "✅ students.photo_url updated."
        );

        return publicURL;

    } catch (error) {
        console.error(
            "❌ Unexpected profile photo upload error:",
            error
        );

        showMessage(
            "#profileSaveStatus",
            "An unexpected error occurred while uploading your photo.",
            "error"
        );

        return null;
    }
}

/* =========================================================
   PASSWORD RESET
========================================================= */

function setupChangePassword() {
    const button =
        $("#changePasswordButton");

    if (
        !button ||
        button.dataset
            .passwordConnected ===
        "true"
    ) {
        return;
    }

    button.dataset
        .passwordConnected =
        "true";

    button.addEventListener(
        "click",
        async () => {
            if (!currentUser?.email) {
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
        }
    );
}

/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {
    const logoutButton =
        $("#logoutButton");

    if (
        !logoutButton ||
        logoutButton.dataset
            .logoutConnected ===
        "true"
    ) {
        return;
    }

    logoutButton.dataset
        .logoutConnected =
        "true";

    logoutButton.addEventListener(
        "click",
        async () => {
            logoutButton.disabled =
                true;

            logoutButton.textContent =
                "Logging out...";

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
                        "Logout";

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
                    "Logout";
            }
        }
    );
}/* =========================================================
   NOTIFICATION SYSTEM
========================================================= */

function getNotifications() {
    const notifications =
        readStorage(
            STORAGE_KEYS.notifications,
            []
        );

    if (!Array.isArray(notifications)) {
        return [];
    }

    return notifications;
}

function saveNotifications(
    notifications
) {
    writeStorage(
        STORAGE_KEYS.notifications,
        notifications
    );
}

function getNotificationState() {
    const state =
        readStorage(
            STORAGE_KEYS.notificationState,
            {}
        );

    if (
        !state ||
        typeof state !== "object"
    ) {
        return {};
    }

    return state;
}

function saveNotificationState(
    state
) {
    writeStorage(
        STORAGE_KEYS.notificationState,
        state
    );
}

function createNotification(
    title,
    message,
    type = "info",
    uniqueKey = ""
) {
    const existing =
        getNotifications();

    /*
       Prevent duplicate notifications.
    */
    if (uniqueKey) {
        const alreadyExists =
            existing.some(
                notification =>
                    notification.uniqueKey ===
                    uniqueKey
            );

        if (alreadyExists) {
            return null;
        }
    }

    const notification = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 9)}`,

        title:
            title || "Mwaniki Scholars",

        message:
            message || "",

        type:
            type || "info",

        uniqueKey:
            uniqueKey || "",

        created_at:
            new Date().toISOString(),

        read:
            false
    };

    const updated = [
        notification,
        ...existing
    ].slice(0, 50);

    saveNotifications(
        updated
    );

    return notification;
}

/* =========================================================
   WELCOME NOTIFICATION
========================================================= */

function createWelcomeNotification() {
    if (!currentUser) {
        return;
    }

    const userKey =
        currentUser.id ||
        currentUser.email ||
        "student";

    createNotification(
        `Welcome, ${getStudentFirstName()}!`,
        "Welcome to Mwaniki Scholars. Your medical learning dashboard is ready.",
        "welcome",
        `welcome-${userKey}`
    );
}

/* =========================================================
   CONTENT NOTIFICATIONS
========================================================= */

function syncContentNotifications() {
    /*
       Notify the student about newly published notes.
    */
    allNotes.forEach(note => {
        if (!note?.id) {
            return;
        }

        const noteName =
            note.file_name ||
            note.unit ||
            "New study note";

        const courseName =
            note.course ||
            "Medical Learning";

        createNotification(
            "New study notes available",
            `${noteName} has been published under ${courseName}.`,
            "notes",
            `note-${note.id}`
        );
    });

    /*
       Notify about courses added after the
       student's notification state was created.
    */
    allCourses.forEach(course => {
        if (!course?.id) {
            return;
        }

        createNotification(
            "Course Library updated",
            `${course.title} is available in your Course Library.`,
            "course",
            `course-${course.id}`
        );
    });

    /*
       Keep notification history under control.
    */
    const notifications =
        getNotifications();

    saveNotifications(
        notifications
            .sort(
                (a, b) =>
                    new Date(
                        b.created_at
                    ) -
                    new Date(
                        a.created_at
                    )
            )
            .slice(0, 50)
    );
}

/* =========================================================
   NOTIFICATION BADGE
========================================================= */

function updateNotificationBadge() {
    const notifications =
        getNotifications();

    const unreadCount =
        notifications.filter(
            notification =>
                !notification.read
        ).length;

    const badgeSelectors = [
        "#notificationBadge",
        "#notificationCount",
        ".notification-badge"
    ];

    badgeSelectors.forEach(
        selector => {
            $all(selector).forEach(
                badge => {
                    if (
                        unreadCount >
                        0
                    ) {
                        badge.textContent =
                            unreadCount >
                            99
                                ? "99+"
                                : String(
                                      unreadCount
                                  );

                        badge.style.display =
                            "";
                    } else {
                        badge.textContent =
                            "";

                        badge.style.display =
                            "none";
                    }
                }
            );
        }
    );
}

/* =========================================================
   MARK NOTIFICATIONS READ
========================================================= */

function markAllNotificationsRead() {
    const notifications =
        getNotifications();

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
}

/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotifications() {
    const notificationContent =
        $("#notificationContent");

    if (!notificationContent) {
        return;
    }

    const notifications =
        getNotifications();

    if (!notifications.length) {
        notificationContent.innerHTML = `
            <div class="notification-empty">
                <strong>No notifications</strong>
                <p>
                    New Mwaniki Scholars updates will appear here.
                </p>
            </div>
        `;

        updateNotificationBadge();

        return;
    }

    notificationContent.innerHTML =
        notifications
            .map(
                notification => `
                    <article
                        class="notification-item ${
                            notification.read
                                ? "read"
                                : "unread"
                        }"
                        data-notification-id="${escapeHTML(
                            notification.id
                        )}"
                    >
                        <div class="notification-item-content">

                            <strong>
                                ${escapeHTML(
                                    notification.title
                                )}
                            </strong>

                            <p>
                                ${escapeHTML(
                                    notification.message
                                )}
                            </p>

                            <small>
                                ${escapeHTML(
                                    formatNotificationTime(
                                        notification.created_at
                                    )
                                )}
                            </small>

                        </div>
                    </article>
                `
            )
            .join("");

    updateNotificationBadge();
}

function formatNotificationTime(
    value
) {
    if (!value) {
        return "";
    }

    const date =
        new Date(value);

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
            dateStyle:
                "medium",
            timeStyle:
                "short"
        }
    );
}

/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function openNotificationPanel() {
    const panel =
        $("#notificationPanel");

    if (!panel) {
        return;
    }

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

    renderNotifications();

    /*
       Opening the notification panel means
       the student has seen the notifications.
    */
    markAllNotificationsRead();
}

function closeNotificationPanel() {
    const panel =
        $("#notificationPanel");

    if (!panel) {
        return;
    }

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

function setupNotificationPanel() {
    if (
        notificationSystemStarted
    ) {
        return;
    }

    notificationSystemStarted =
        true;

    const notificationButton =
        $("#notificationButton");

    const closeButton =
        $("#closeNotificationPanel");

    const panel =
        $("#notificationPanel");

    if (panel) {
        closeNotificationPanel();
    }

    if (notificationButton) {
        notificationButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();

                const isOpen =
                    panel?.classList
                        .contains(
                            "active"
                        ) ||
                    panel?.classList
                        .contains(
                            "open"
                        );

                if (isOpen) {
                    closeNotificationPanel();
                } else {
                    openNotificationPanel();
                }
            }
        );

        console.log(
            "✅ Notification button connected."
        );
    } else {
        console.warn(
            "⚠️ #notificationButton was not found."
        );
    }

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();

                closeNotificationPanel();
            }
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
    $all(".nav-link").forEach(
        link => {
            const isActive =
                link.dataset.section ===
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
    $all(".nav-link").forEach(
        link => {
            const sectionId =
                link.dataset.section;

            if (!sectionId) {
                return;
            }

            if (
                link.dataset
                    .navigationConnected ===
                "true"
            ) {
                return;
            }

            link.dataset
                .navigationConnected =
                "true";

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

            allCourses = [];

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
           Create course notifications after
           successful course loading.
        */
        syncContentNotifications();

        updateNotificationBadge();

    } catch (error) {
        console.error(
            "❌ Unexpected course loading error:",
            error
        );

        allCourses = [];

        if (courseGrid) {
            courseGrid.innerHTML = `
                <div class="empty-state">
                    An unexpected error occurred while loading courses.
                </div>
            `;
        }
    }
}

/* =========================================================
   COURSE LIBRARY
   NO COURSE IMAGE PLACEHOLDER
========================================================= */

function renderCourseLibrary() {
    const courseGrid =
        $("#courseGrid");

    if (!courseGrid) {
        console.warn(
            "⚠️ #courseGrid was not found."
        );

        return;
    }

    if (!allCourses.length) {
        courseGrid.innerHTML = `
            <div class="empty-state">
                No courses are currently available.
            </div>
        `;

        return;
    }

    /*
       IMPORTANT:
       Course images and image placeholders
       have deliberately been removed.

       The card now contains:
       - course label
       - course name
       - description
       - Start Learning button
    */

    courseGrid.innerHTML =
        allCourses
            .map(
                course => `
                    <article
                        class="course-card"
                        data-course-id="${escapeHTML(
                            course.id
                        )}"
                    >

                        <div class="course-card-content">

                            <span class="course-card-label">
                                MEDICAL COURSE
                            </span>

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

                        if (course) {
                            openCourse(
                                course
                            );
                        }
                    }
                );
            }
        );

    console.log(
        "✅ Course cards rendered:",
        allCourses.length
    );
}/* =========================================================
   RECENT COURSE
   NO IMAGE / NO PLACEHOLDER
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

    /*
       No recent course.
    */
    if (!recentCourse) {
        titleElement.textContent =
            "No recent course";

        descriptionElement.textContent =
            "Choose a course from the Course Library to begin learning.";

        buttonElement.textContent =
            "Explore Courses";

        buttonElement.onclick =
            () => {
                const coursesSection =
                    $("#courses");

                if (coursesSection) {
                    coursesSection.scrollIntoView(
                        {
                            behavior:
                                "smooth",
                            block:
                                "start"
                        }
                    );
                }

                activateSection(
                    "courses"
                );
            };

        /*
           Remove any old image/placeholder
           elements from the previous version.
        */
        const oldImage =
            $("#recentCourseImage");

        const oldPlaceholder =
            $("#recentCourseImagePlaceholder");

        if (oldImage) {
            oldImage.style.display =
                "none";
        }

        if (oldPlaceholder) {
            oldPlaceholder.style.display =
                "none";
        }

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
        () => {
            openCourse(
                recentCourse
            );
        };

    /*
       Completely hide old image elements
       if they still exist in the HTML.
    */
    const oldImage =
        $("#recentCourseImage");

    const oldPlaceholder =
        $("#recentCourseImagePlaceholder");

    if (oldImage) {
        oldImage.style.display =
            "none";
    }

    if (oldPlaceholder) {
        oldPlaceholder.style.display =
            "none";
    }
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

                        if (course) {
                            openCourse(
                                course
                            );
                        }
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

            allNotes = [];

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

        /*
           New published notes become
           notification candidates.
        */
        syncContentNotifications();

        updateNotificationBadge();

    } catch (error) {
        console.error(
            "❌ Unexpected notes loading error:",
            error
        );

        allNotes = [];

        if (notesGrid) {
            notesGrid.innerHTML = `
                <div class="empty-state">
                    An unexpected error occurred while loading notes.
                </div>
            `;
        }
    }
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
                        note.file_url ||
                        "#";

                    return `
                        <article
                            class="note-card"
                            data-note-id="${escapeHTML(
                                note.id
                            )}"
                        >

                            <div
                                class="note-card-icon"
                                aria-hidden="true"
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

                                ${
                                    note.file_url
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
                                        `
                                }

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

            allQuizzes = [];

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

        allQuizzes = [];

        updateDashboardStatistics();
    }
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function calculateQuizProgress() {
    const progress =
        readStorage(
            STORAGE_KEYS.quizProgress,
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
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

    let completed = 0;

    progressValues.forEach(
        value => {
            if (
                typeof value ===
                "number"
            ) {
                if (
                    value > 0
                ) {
                    completed++;
                }
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
                    completed++;
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
            ) *
                100
        )
    );
}

function updateDashboardStatistics() {
    /*
       These are retained for compatibility
       with dashboard HTML that uses these IDs.
    */
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

    /*
       Additional statistics used by the
       current dashboard.
    */
    setCounterText(
        "#coursesCompleted",
        calculateCompletedCourses()
    );

    setCounterText(
        "#unitsCompleted",
        calculateCompletedUnits()
    );

    setCounterText(
        "#quizzesAttempted",
        calculateAttemptedQuizzes()
    );

    setText(
        "#averageScore",
        `${calculateAverageScore()}%`
    );

    setText(
        "#learningStreak",
        `${calculateLearningStreak()}`
    );

    const progress =
        calculateQuizProgress();

    setText(
        "#learningProgress",
        `${progress}%`
    );

    setText(
        "#overallProgressText",
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
    }

    const overallProgressBar =
        $("#overallProgressBar");

    if (overallProgressBar) {
        overallProgressBar.style.width =
            `${progress}%`;

        overallProgressBar.setAttribute(
            "aria-valuenow",
            String(progress)
        );
    }

    setText(
        "#overallProgress",
        `${progress}%`
    );
}

/* =========================================================
   STATISTICS HELPERS
========================================================= */

function calculateCompletedCourses() {
    const recentCourses =
        getRecentCourses();

    return recentCourses.length;
}

function calculateCompletedUnits() {
    const activity =
        readStorage(
            STORAGE_KEYS.recentActivity,
            []
        );

    if (!Array.isArray(activity)) {
        return 0;
    }

    const uniqueUnits =
        new Set();

    activity.forEach(
        item => {
            if (
                item?.unitId !==
                undefined &&
                item?.unitId !==
                null
            ) {
                uniqueUnits.add(
                    String(
                        item.unitId
                    )
                );
            }
        }
    );

    return uniqueUnits.size;
}

function calculateAttemptedQuizzes() {
    const progress =
        readStorage(
            STORAGE_KEYS.quizProgress,
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
    ) {
        return 0;
    }

    return Object.keys(
        progress
    ).length;
}

function calculateAverageScore() {
    const progress =
        readStorage(
            STORAGE_KEYS.quizProgress,
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
    ) {
        return 0;
    }

    const scores = [];

    Object.values(
        progress
    ).forEach(
        value => {
            if (
                typeof value ===
                "number"
            ) {
                if (
                    value >= 0 &&
                    value <= 100
                ) {
                    scores.push(
                        value
                    );
                }
            } else if (
                value &&
                typeof value ===
                    "object" &&
                value.score !==
                    undefined
            ) {
                const score =
                    Number(
                        value.score
                    );

                if (
                    Number.isFinite(
                        score
                    )
                ) {
                    scores.push(
                        score
                    );
                }
            }
        }
    );

    if (!scores.length) {
        return 0;
    }

    const total =
        scores.reduce(
            (
                sum,
                score
            ) =>
                sum + score,
            0
        );

    return Math.round(
        total /
            scores.length
    );
}

function calculateLearningStreak() {
    const activity =
        readStorage(
            STORAGE_KEYS.recentActivity,
            []
        );

    if (
        !Array.isArray(activity) ||
        !activity.length
    ) {
        return 0;
    }

    const uniqueDates =
        new Set();

    activity.forEach(
        item => {
            if (
                !item?.timestamp
            ) {
                return;
            }

            const date =
                new Date(
                    item.timestamp
                );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return;
            }

            uniqueDates.add(
                date
                    .toISOString()
                    .split("T")[0]
            );
        }
    );

    if (!uniqueDates.size) {
        return 0;
    }

    const sortedDates =
        Array.from(
            uniqueDates
        ).sort()
        .reverse();

    let streak = 0;

    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    for (
        let i = 0;
        i < sortedDates.length;
        i++
    ) {
        const expected =
            new Date(today);

        expected.setDate(
            today.getDate() -
                i
        );

        const expectedString =
            expected
                .toISOString()
                .split("T")[0];

        if (
            sortedDates[i] ===
            expectedString
        ) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/* =========================================================
   COMPATIBILITY FUNCTION
========================================================= */

function updateDashboardStats() {
    updateDashboardStatistics();
}

window.updateDashboardStats =
    updateDashboardStats;

window.updateDashboardStatistics =
    updateDashboardStatistics;/* =========================================================
   RECENT COURSE
   NO IMAGE / NO PLACEHOLDER
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

    /*
       No recent course.
    */
    if (!recentCourse) {
        titleElement.textContent =
            "No recent course";

        descriptionElement.textContent =
            "Choose a course from the Course Library to begin learning.";

        buttonElement.textContent =
            "Explore Courses";

        buttonElement.onclick =
            () => {
                const coursesSection =
                    $("#courses");

                if (coursesSection) {
                    coursesSection.scrollIntoView(
                        {
                            behavior:
                                "smooth",
                            block:
                                "start"
                        }
                    );
                }

                activateSection(
                    "courses"
                );
            };

        /*
           Remove any old image/placeholder
           elements from the previous version.
        */
        const oldImage =
            $("#recentCourseImage");

        const oldPlaceholder =
            $("#recentCourseImagePlaceholder");

        if (oldImage) {
            oldImage.style.display =
                "none";
        }

        if (oldPlaceholder) {
            oldPlaceholder.style.display =
                "none";
        }

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
        () => {
            openCourse(
                recentCourse
            );
        };

    /*
       Completely hide old image elements
       if they still exist in the HTML.
    */
    const oldImage =
        $("#recentCourseImage");

    const oldPlaceholder =
        $("#recentCourseImagePlaceholder");

    if (oldImage) {
        oldImage.style.display =
            "none";
    }

    if (oldPlaceholder) {
        oldPlaceholder.style.display =
            "none";
    }
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

                        if (course) {
                            openCourse(
                                course
                            );
                        }
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

            allNotes = [];

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

        /*
           New published notes become
           notification candidates.
        */
        syncContentNotifications();

        updateNotificationBadge();

    } catch (error) {
        console.error(
            "❌ Unexpected notes loading error:",
            error
        );

        allNotes = [];

        if (notesGrid) {
            notesGrid.innerHTML = `
                <div class="empty-state">
                    An unexpected error occurred while loading notes.
                </div>
            `;
        }
    }
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
                        note.file_url ||
                        "#";

                    return `
                        <article
                            class="note-card"
                            data-note-id="${escapeHTML(
                                note.id
                            )}"
                        >

                            <div
                                class="note-card-icon"
                                aria-hidden="true"
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

                                ${
                                    note.file_url
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
                                        `
                                }

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

            allQuizzes = [];

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

        allQuizzes = [];

        updateDashboardStatistics();
    }
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function calculateQuizProgress() {
    const progress =
        readStorage(
            STORAGE_KEYS.quizProgress,
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
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

    let completed = 0;

    progressValues.forEach(
        value => {
            if (
                typeof value ===
                "number"
            ) {
                if (
                    value > 0
                ) {
                    completed++;
                }
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
                    completed++;
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
            ) *
                100
        )
    );
}

function updateDashboardStatistics() {
    /*
       These are retained for compatibility
       with dashboard HTML that uses these IDs.
    */
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

    /*
       Additional statistics used by the
       current dashboard.
    */
    setCounterText(
        "#coursesCompleted",
        calculateCompletedCourses()
    );

    setCounterText(
        "#unitsCompleted",
        calculateCompletedUnits()
    );

    setCounterText(
        "#quizzesAttempted",
        calculateAttemptedQuizzes()
    );

    setText(
        "#averageScore",
        `${calculateAverageScore()}%`
    );

    setText(
        "#learningStreak",
        `${calculateLearningStreak()}`
    );

    const progress =
        calculateQuizProgress();

    setText(
        "#learningProgress",
        `${progress}%`
    );

    setText(
        "#overallProgressText",
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
    }

    const overallProgressBar =
        $("#overallProgressBar");

    if (overallProgressBar) {
        overallProgressBar.style.width =
            `${progress}%`;

        overallProgressBar.setAttribute(
            "aria-valuenow",
            String(progress)
        );
    }

    setText(
        "#overallProgress",
        `${progress}%`
    );
}

/* =========================================================
   STATISTICS HELPERS
========================================================= */

function calculateCompletedCourses() {
    const recentCourses =
        getRecentCourses();

    return recentCourses.length;
}

function calculateCompletedUnits() {
    const activity =
        readStorage(
            STORAGE_KEYS.recentActivity,
            []
        );

    if (!Array.isArray(activity)) {
        return 0;
    }

    const uniqueUnits =
        new Set();

    activity.forEach(
        item => {
            if (
                item?.unitId !==
                undefined &&
                item?.unitId !==
                null
            ) {
                uniqueUnits.add(
                    String(
                        item.unitId
                    )
                );
            }
        }
    );

    return uniqueUnits.size;
}

function calculateAttemptedQuizzes() {
    const progress =
        readStorage(
            STORAGE_KEYS.quizProgress,
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
    ) {
        return 0;
    }

    return Object.keys(
        progress
    ).length;
}

function calculateAverageScore() {
    const progress =
        readStorage(
            STORAGE_KEYS.quizProgress,
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
    ) {
        return 0;
    }

    const scores = [];

    Object.values(
        progress
    ).forEach(
        value => {
            if (
                typeof value ===
                "number"
            ) {
                if (
                    value >= 0 &&
                    value <= 100
                ) {
                    scores.push(
                        value
                    );
                }
            } else if (
                value &&
                typeof value ===
                    "object" &&
                value.score !==
                    undefined
            ) {
                const score =
                    Number(
                        value.score
                    );

                if (
                    Number.isFinite(
                        score
                    )
                ) {
                    scores.push(
                        score
                    );
                }
            }
        }
    );

    if (!scores.length) {
        return 0;
    }

    const total =
        scores.reduce(
            (
                sum,
                score
            ) =>
                sum + score,
            0
        );

    return Math.round(
        total /
            scores.length
    );
}

function calculateLearningStreak() {
    const activity =
        readStorage(
            STORAGE_KEYS.recentActivity,
            []
        );

    if (
        !Array.isArray(activity) ||
        !activity.length
    ) {
        return 0;
    }

    const uniqueDates =
        new Set();

    activity.forEach(
        item => {
            if (
                !item?.timestamp
            ) {
                return;
            }

            const date =
                new Date(
                    item.timestamp
                );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return;
            }

            uniqueDates.add(
                date
                    .toISOString()
                    .split("T")[0]
            );
        }
    );

    if (!uniqueDates.size) {
        return 0;
    }

    const sortedDates =
        Array.from(
            uniqueDates
        ).sort()
        .reverse();

    let streak = 0;

    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    for (
        let i = 0;
        i < sortedDates.length;
        i++
    ) {
        const expected =
            new Date(today);

        expected.setDate(
            today.getDate() -
                i
        );

        const expectedString =
            expected
                .toISOString()
                .split("T")[0];

        if (
            sortedDates[i] ===
            expectedString
        ) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/* =========================================================
   COMPATIBILITY FUNCTION
========================================================= */

function updateDashboardStats() {
    updateDashboardStatistics();
}

window.updateDashboardStats =
    updateDashboardStats;

window.updateDashboardStatistics =
    updateDashboardStatistics;
