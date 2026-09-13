import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
========================================================= */

console.log("Mwaniki Scholars dashboard loaded");

/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;

/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getInitials(name) {
    const cleanName = String(name || "Student")
        .trim()
        .replace(/\s+/g, " ");

    if (!cleanName) {
        return "S";
    }

    const parts = cleanName.split(" ");

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

function updateCurrentDate() {
    const element = $("currentDate");

    if (!element) {
        return;
    }

    const now = new Date();

    element.textContent = now.toLocaleDateString(
        "en-KE",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}

/* =========================================================
   STUDENT IDENTITY
========================================================= */

function updateStudentIdentity() {
    const studentName =
        currentStudent?.full_name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.email ||
        "Student";

    const initials = getInitials(studentName);

    const welcomeName = $("welcomeName");
    const headerName = $("headerProfileName");

    if (welcomeName) {
        welcomeName.textContent = studentName;
    }

    if (headerName) {
        headerName.textContent = studentName;
    }

    const profileNameInput = $("profileName");

    if (profileNameInput) {
        if ("value" in profileNameInput) {
            profileNameInput.value = studentName;
        } else {
            profileNameInput.textContent = studentName;
        }
    }

    const headerAvatar = $("headerProfileAvatar");
    const profileAvatar = $("profileLargeAvatar");

    if (headerAvatar && !currentStudent?.photo_url) {
        headerAvatar.replaceChildren();
        headerAvatar.textContent = initials;
    }

    if (profileAvatar && !currentStudent?.photo_url) {
        profileAvatar.replaceChildren();
        profileAvatar.textContent = initials;
    }
}

/* =========================================================
   STUDENT PHOTO
========================================================= */

function renderAvatar(element, photoURL, studentName) {
    if (!element) {
        return;
    }

    element.replaceChildren();

    if (!photoURL) {
        element.textContent = getInitials(studentName);
        return;
    }

    const image = document.createElement("img");

    image.src = photoURL;
    image.alt = "Student profile photo";

    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.display = "block";

    image.addEventListener(
        "error",
        () => {
            element.replaceChildren();
            element.textContent = getInitials(studentName);
        },
        { once: true }
    );

    element.appendChild(image);
}

function updateStudentPhoto() {
    const photoURL =
        currentStudent?.photo_url || "";

    const studentName =
        currentStudent?.full_name ||
        currentUser?.email ||
        "Student";

    renderAvatar(
        $("headerProfileAvatar"),
        photoURL,
        studentName
    );

    renderAvatar(
        $("profileLargeAvatar"),
        photoURL,
        studentName
    );
}

/* =========================================================
   PROFILE DETAILS
========================================================= */

function updateProfileDetails() {
    const studentName =
        currentStudent?.full_name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.email ||
        "Student";

    const email =
        currentStudent?.email ||
        currentUser?.email ||
        "";

    const phone =
        currentStudent?.phone ||
        "";

    const course =
        currentStudent?.course ||
        "";

    const level =
        currentStudent?.level ||
        "";

    const profileName = $("profileName");
    const profileEmail = $("profileEmail");
    const profilePhone = $("profilePhone");
    const profileCourse = $("profileCourse");
    const profileLevel = $("profileLevel");

    if (profileName) {
        if ("value" in profileName) {
            profileName.value = studentName;
        } else {
            profileName.textContent = studentName;
        }
    }

    if (profileEmail) {
        if ("value" in profileEmail) {
            profileEmail.value = email;
        } else {
            profileEmail.textContent = email;
        }
    }

    if (profilePhone) {
        profilePhone.value = phone;
    }

    if (profileCourse) {
        profileCourse.value = course;
    }

    if (profileLevel) {
        profileLevel.value = level;
    }
}

/* =========================================================
   LOAD STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {
    try {
        const {
            data: authData,
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            console.error(
                "Authentication error:",
                authError
            );
        }

        currentUser = authData?.user || null;

        if (!currentUser) {
            window.location.href = "./index.html";
            return false;
        }

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
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            console.error(
                "Student profile error:",
                error
            );

            currentStudent = null;
        } else {
            currentStudent = data || null;
        }

        updateStudentIdentity();
        updateStudentPhoto();
        updateProfileDetails();

        return true;

    } catch (error) {
        console.error(
            "loadStudentProfile failed:",
            error
        );

        return false;
    }
}

/* =========================================================
   PROFILE EDITOR
========================================================= */

function setProfileStatus(message, type = "") {
    const status = $("profileSaveStatus");

    if (!status) {
        return;
    }

    status.textContent = message;

    status.classList.remove(
        "success",
        "error"
    );

    if (type) {
        status.classList.add(type);
    }
}

function setupProfileEditor() {
    const saveButton = $("saveProfileButton");
    const photoInput = $("profilePhotoInput");
    const changePasswordButton = $("changePasswordButton");

    if (photoInput) {
        photoInput.addEventListener(
            "change",
            handleProfilePhotoSelection
        );
    }

    saveButton?.addEventListener(
        "click",
        saveStudentProfile
    );

    changePasswordButton?.addEventListener(
        "click",
        () => {
            window.location.href =
                "./resetPassword.html";
        }
    );
}

async function handleProfilePhotoSelection(event) {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        setProfileStatus(
            "Please select a valid image file.",
            "error"
        );

        input.value = "";
        return;
    }

    const maxSize =
        5 * 1024 * 1024;

    if (file.size > maxSize) {
        setProfileStatus(
            "Profile photo must be smaller than 5 MB.",
            "error"
        );

        input.value = "";
        return;
    }

    const studentName =
        currentStudent?.full_name ||
        currentUser?.email ||
        "Student";

    const previewURL =
        URL.createObjectURL(file);

    renderAvatar(
        $("profileLargeAvatar"),
        previewURL,
        studentName
    );

    setProfileStatus(
        "New photo selected. Save your profile to upload it.",
        ""
    );
}

async function uploadProfilePhoto(file) {
    if (!currentUser || !file) {
        return null;
    }

    const extension =
        file.name.includes(".")
            ? file.name
                .split(".")
                .pop()
                .toLowerCase()
            : "jpg";

    const filePath =
        `${currentUser.id}/${Date.now()}.${extension}`;

    const {
        error: uploadError
    } = await supabase.storage
        .from("student-profiles")
        .upload(
            filePath,
            file,
            {
                upsert: true,
                contentType: file.type
            }
        );

    if (uploadError) {
        console.error(
            "Profile photo upload error:",
            uploadError
        );

        throw new Error(
            "Profile photo could not be uploaded. Check the student-profiles storage bucket and its policies."
        );
    }

    const {
        data
    } = supabase.storage
        .from("student-profiles")
        .getPublicUrl(filePath);

    if (!data?.publicUrl) {
        throw new Error(
            "Profile photo URL could not be generated."
        );
    }

    return data.publicUrl;
}

async function saveStudentProfile() {
    if (!currentUser) {
        setProfileStatus(
            "Your session has expired. Please sign in again.",
            "error"
        );

        return;
    }

    const saveButton =
        $("saveProfileButton");

    const phoneInput =
        $("profilePhone");

    const courseInput =
        $("profileCourse");

    const levelInput =
        $("profileLevel");

    const photoInput =
        $("profilePhotoInput");

    const phone =
        phoneInput?.value.trim() || "";

    const course =
        courseInput?.value.trim() || "";

    const level =
        levelInput?.value.trim() || "";

    if (!phone) {
        setProfileStatus(
            "Please enter your phone number.",
            "error"
        );

        phoneInput?.focus();
        return;
    }

    if (!course) {
        setProfileStatus(
            "Please enter your course.",
            "error"
        );

        courseInput?.focus();
        return;
    }

    if (!level) {
        setProfileStatus(
            "Please enter your level or year.",
            "error"
        );

        levelInput?.focus();
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    setProfileStatus(
        "Saving profile.",
        ""
    );

    try {
        let photoURL =
            currentStudent?.photo_url || null;

        const selectedFile =
            photoInput?.files?.[0] || null;

        if (selectedFile) {
            photoURL =
                await uploadProfilePhoto(
                    selectedFile
                );
        }

        const updates = {
            phone,
            course,
            level
        };

        if (photoURL) {
            updates.photo_url = photoURL;
        }

        const {
            data,
            error
        } = await supabase
            .from("students")
            .update(updates)
            .eq("id", currentUser.id)
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
            .maybeSingle();

        if (error) {
            console.error(
                "Profile update error:",
                error
            );

            throw new Error(
                error.message ||
                "Profile could not be updated."
            );
        }

        currentStudent =
            data || {
                ...currentStudent,
                ...updates
            };

        updateStudentIdentity();
        updateStudentPhoto();
        updateProfileDetails();

        if (photoInput) {
            photoInput.value = "";
        }

        setProfileStatus(
            "Profile updated successfully.",
            "success"
        );

    } catch (error) {
        console.error(
            "saveStudentProfile failed:",
            error
        );

        setProfileStatus(
            error.message ||
            "Profile could not be updated.",
            "error"
        );

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save Profile";
        }
    }
}

/* =========================================================
   COURSE IMAGE
========================================================= */

function getCourseImage(course) {
    const image =
        course?.image ||
        "";

    if (
        typeof image !== "string" ||
        !image.trim()
    ) {
        return "";
    }

    return image.trim();
}

/* =========================================================
   COURSE URL
========================================================= */

function getCourseURL(course) {
    const courseID =
        course?.id;

    if (
        courseID === null ||
        courseID === undefined
    ) {
        return "./course.html";
    }

    return `./course.html?course_id=${encodeURIComponent(
        courseID
    )}`;
}

/* =========================================================
   OPEN COURSE
========================================================= */

function openCourse(course) {
    if (!course) {
        return;
    }

    localStorage.setItem(
        "selectedCourse",
        String(course.id)
    );

    localStorage.setItem(
        "selectedCourseName",
        course.title || ""
    );

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: course.id,
            title: course.title || "",
            description: course.description || "",
            image: course.image || ""
        })
    );

    window.location.href =
        getCourseURL(course);
}

/* =========================================================
   COURSE CARD
========================================================= */

function createCourseCard(course) {
    const title =
        course?.title ||
        "Untitled Course";

    const description =
        course?.description ||
        "Explore units, notes and quizzes for this course.";

    const image =
        getCourseImage(course);

    let visual = "";

    if (image) {
        visual = `
            <div class="course-card-visual">
                <img
                    class="course-card-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(title)}"
                    loading="lazy"
                    onerror="
                        this.style.display='none';
                        this.parentElement
                            .querySelector('.course-card-placeholder')
                            .style.display='block';
                    "
                >

                <div
                    class="course-card-placeholder"
                    style="display:none;"
                    aria-hidden="true"
                ></div>
            </div>
        `;
    } else {
        visual = `
            <div class="course-card-visual">
                <div
                    class="course-card-placeholder"
                    aria-hidden="true"
                ></div>
            </div>
        `;
    }

    return `
        <article class="course-card">

            ${visual}

            <div class="course-card-body">

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(description)}
                </p>

                <button
                    type="button"
                    class="course-card-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    View Course
                </button>

            </div>

        </article>
    `;
}

/* =========================================================
   RENDER COURSES
========================================================= */

function renderCourses() {
    const grid =
        $("courseGrid");

    if (!grid) {
        return;
    }

    if (!allCourses.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <strong>No courses available.</strong>
                <span>
                    Courses will appear here when they are
                    available in the course library.
                </span>
            </div>
        `;

        return;
    }

    grid.innerHTML =
        allCourses
            .map(createCourseCard)
            .join("");

    grid
        .querySelectorAll("[data-course-id]")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const courseID =
                        Number(
                            button.dataset.courseId
                        );

                    const course =
                        allCourses.find(
                            item =>
                                Number(item.id) ===
                                courseID
                        );

                    if (course) {
                        openCourse(course);
                    }
                }
            );
        });
}

/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCourses() {
    const grid =
        $("courseGrid");

    if (grid) {
        grid.innerHTML = `
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
                    ascending: true
                }
            );

        if (error) {
            console.error(
                "Courses loading error:",
                error
            );

            allCourses = [];

            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state">
                        Unable to load courses.
                        Please refresh and try again.
                    </div>
                `;
            }

            return;
        }

        allCourses =
            Array.isArray(data)
                ? data
                : [];

        const totalCourses =
            $("totalCourses");

        if (totalCourses) {
            totalCourses.textContent =
                allCourses.length;
        }

        renderCourses();
        renderRecommendations();
        loadRecentCourse();

    } catch (error) {
        console.error(
            "loadCourses failed:",
            error
        );

        allCourses = [];
    }
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function renderRecommendations() {
    const grid =
        $("recommendationsGrid");

    if (!grid) {
        return;
    }

    if (!allCourses.length) {
        grid.innerHTML = `
            <div class="empty-state">
                No recommendations available.
            </div>
        `;

        return;
    }

    const recommendations =
        allCourses.slice(0, 3);

    grid.innerHTML =
        recommendations
            .map(course => {
                const image =
                    getCourseImage(course);

                const imageHTML =
                    image
                        ? `
                            <div class="course-card-visual">

                                <img
                                    class="course-card-image"
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(course.title)}"
                                    loading="lazy"
                                >

                            </div>
                        `
                        : `
                            <div class="course-card-visual">
                                <div
                                    class="course-card-placeholder"
                                    aria-hidden="true"
                                ></div>
                            </div>
                        `;

                return `
                    <article class="course-card">

                        ${imageHTML}

                        <div class="course-card-body">

                            <span class="course-label">
                                Recommended
                            </span>

                            <h3>
                                ${escapeHTML(
                                    course.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    course.description ||
                                    "Explore this medical course."
                                )}
                            </p>

                            <button
                                type="button"
                                class="course-card-button"
                                data-recommendation-id="${escapeHTML(
                                    course.id
                                )}"
                            >
                                View Course
                            </button>

                        </div>

                    </article>
                `;
            })
            .join("");

    grid
        .querySelectorAll(
            "[data-recommendation-id]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        Number(
                            button.dataset
                                .recommendationId
                        );

                    const course =
                        allCourses.find(
                            item =>
                                Number(item.id) === id
                        );

                    if (course) {
                        openCourse(course);
                    }
                }
            );
        });
}

/* =========================================================
   RECENT COURSE
========================================================= */

function loadRecentCourse() {
    const card =
        $("recentCourseCard");

    const titleElement =
        $("recentCourseTitle");

    const descriptionElement =
        $("recentCourseDescription");

    const button =
        $("recentCourseButton");

    const imageElement =
        $("recentCourseImage");

    const placeholderElement =
        $("recentCourseImagePlaceholder");

    if (
        !card ||
        !titleElement ||
        !descriptionElement ||
        !button
    ) {
        return;
    }

    let savedCourse = null;

    try {
        const stored =
            localStorage.getItem(
                "mwanikiLastCourse"
            );

        if (stored) {
            savedCourse =
                JSON.parse(stored);
        }

    } catch (error) {
        console.warn(
            "Recent course data could not be read:",
            error
        );
    }

    let course = null;

    if (savedCourse?.id) {
        course =
            allCourses.find(
                item =>
                    Number(item.id) ===
                    Number(savedCourse.id)
            );
    }

    if (!course && savedCourse) {
        course = savedCourse;
    }

    if (!course) {
        titleElement.textContent =
            "No recent course";

        descriptionElement.textContent =
            "Choose a course from the library to begin learning.";

        button.textContent =
            "Explore Courses";

        button.onclick = () => {
            document
                .getElementById("courses")
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        };

        if (imageElement) {
            imageElement.hidden = true;
            imageElement.removeAttribute("src");
        }

        if (placeholderElement) {
            placeholderElement.style.display =
                "block";
        }

        return;
    }

    titleElement.textContent =
        course.title ||
        "Recent Course";

    descriptionElement.textContent =
        course.description ||
        "Continue your medical learning.";

    button.textContent =
        "Continue Course";

    button.onclick = () => {
        openCourse(course);
    };

    const image =
        getCourseImage(course);

    if (
        image &&
        imageElement
    ) {
        imageElement.src = image;

        imageElement.alt =
            course.title ||
            "Course image";

        imageElement.hidden =
            false;

        imageElement.onerror =
            () => {
                imageElement.hidden =
                    true;

                if (placeholderElement) {
                    placeholderElement.style.display =
                        "block";
                }
            };

        if (placeholderElement) {
            placeholderElement.style.display =
                "none";
        }

    } else {
        if (imageElement) {
            imageElement.hidden =
                true;

            imageElement.removeAttribute(
                "src"
            );
        }

        if (placeholderElement) {
            placeholderElement.style.display =
                "block";
        }
    }
}

/* =========================================================
   NOTES
========================================================= */

function createNoteCard(note) {
    const title =
        note?.file_name ||
        note?.unit ||
        "Study Note";

    const course =
        note?.course ||
        "Medical Course";

    const unit =
        note?.unit ||
        "Unit";

    const date =
        note?.created_at
            ? new Date(
                note.created_at
            ).toLocaleDateString(
                "en-KE"
            )
            : "";

    const fileURL =
        note?.file_url ||
        "";

    return `
        <article class="note-card">

            <h3>
                ${escapeHTML(title)}
            </h3>

            <div class="note-card-meta">

                <span class="note-tag">
                    ${escapeHTML(course)}
                </span>

                <span class="note-tag">
                    ${escapeHTML(unit)}
                </span>

            </div>

            <span class="note-card-date">
                ${escapeHTML(date)}
            </span>

            ${
                fileURL
                    ? `
                        <a
                            class="note-card-button"
                            href="${escapeHTML(fileURL)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open Note
                        </a>
                    `
                    : `
                        <span
                            class="note-card-button"
                            aria-disabled="true"
                        >
                            Note Unavailable
                        </span>
                    `
            }

        </article>
    `;
}

/* =========================================================
   RENDER NOTES
========================================================= */

function renderNotes() {
    const grid =
        $("notesGrid");

    if (!grid) {
        return;
    }

    if (!allNotes.length) {
        grid.innerHTML = `
            <div class="empty-state">

                <strong>
                    No published notes yet.
                </strong>

                <span>
                    Notes published by Mwaniki Scholars
                    will appear here.
                </span>

            </div>
        `;

        return;
    }

    grid.innerHTML =
        allNotes
            .map(createNoteCard)
            .join("");
}

/* =========================================================
   LOAD NOTES
========================================================= */

async function loadNotes() {
    const grid =
        $("notesGrid");

    if (grid) {
        grid.innerHTML = `
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
                    ascending: false
                }
            );

        if (error) {
            console.error(
                "Notes loading error:",
                error
            );

            allNotes = [];

            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state">
                        Unable to load notes.
                        Please refresh and try again.
                    </div>
                `;
            }

            return;
        }

        allNotes =
            Array.isArray(data)
                ? data
                : [];

        const totalNotes =
            $("totalNotes");

        if (totalNotes) {
            totalNotes.textContent =
                allNotes.length;
        }

        renderNotes();

    } catch (error) {
        console.error(
            "loadNotes failed:",
            error
        );

        allNotes = [];
    }
}

/* =========================================================
   QUIZZES
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
                    ascending: true
                }
            );

        if (error) {
            console.error(
                "Quiz loading error:",
                error
            );

            allQuizzes = [];

            return;
        }

        allQuizzes =
            Array.isArray(data)
                ? data
                : [];

        const totalQuizzes =
            $("totalQuizzes");

        if (totalQuizzes) {
            totalQuizzes.textContent =
                allQuizzes.length;
        }

        updateQuizProgress();

    } catch (error) {
        console.error(
            "loadQuizzes failed:",
            error
        );

        allQuizzes = [];
    }
}

/* =========================================================
   QUIZ PROGRESS
========================================================= */

function calculateQuizProgress() {
    try {
        const raw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );

        if (!raw) {
            return 0;
        }

        const progress =
            JSON.parse(raw);

        if (
            typeof progress === "number" &&
            Number.isFinite(progress)
        ) {
            return Math.max(
                0,
                Math.min(
                    100,
                    progress
                )
            );
        }

        if (
            progress &&
            typeof progress === "object"
        ) {
            const values =
                Object.values(progress);

            if (!values.length) {
                return 0;
            }

            let completed = 0;

            values.forEach(value => {
                if (
                    typeof value === "number"
                ) {
                    completed += Math.max(
                        0,
                        Math.min(
                            100,
                            value
                        )
                    );

                } else if (
                    value &&
                    typeof value === "object"
                ) {
                    const score =
                        Number(
                            value.score ??
                            value.progress ??
                            0
                        );

                    completed += Math.max(
                        0,
                        Math.min(
                            100,
                            score
                        )
                    );
                }
            });

            return Math.round(
                completed / values.length
            );
        }

    } catch (error) {
        console.warn(
            "Quiz progress could not be calculated:",
            error
        );
    }

    return 0;
}

function updateQuizProgress() {
    const progress =
        calculateQuizProgress();

    const progressText =
        $("learningProgress");

    const progressBar =
        $("learningProgressBar");

    if (progressText) {
        progressText.textContent =
            `${progress}%`;
    }

    if (progressBar) {
        progressBar.style.width =
            `${progress}%`;
    }
}

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {
    const links =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );

    links.forEach(link => {
        link.addEventListener(
            "click",
            event => {
                const targetID =
                    link.dataset.section;

                const target =
                    document.getElementById(
                        targetID
                    );

                if (!target) {
                    return;
                }

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth"
                });

                links.forEach(item => {
                    item.classList.remove(
                        "active"
                    );
                });

                link.classList.add(
                    "active"
                );
            }
        );
    });
}

/* =========================================================
   SCROLL NAVIGATION
========================================================= */

function setupScrollNavigation() {
    const sections = [
        "overview",
        "courses",
        "notes",
        "quizzes"
    ]
        .map(id =>
            document.getElementById(id)
        )
        .filter(Boolean);

    const links =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );

    if (!sections.length) {
        return;
    }

    const observer =
        new IntersectionObserver(
            entries => {
                const visible =
                    entries
                        .filter(
                            entry =>
                                entry.isIntersecting
                        )
                        .sort(
                            (a, b) =>
                                b.intersectionRatio -
                                a.intersectionRatio
                        )[0];

                if (!visible) {
                    return;
                }

                links.forEach(link => {
                    link.classList.toggle(
                        "active",
                        link.dataset.section ===
                        visible.target.id
                    );
                });
            },
            {
                rootMargin:
                    "-110px 0px -55% 0px",

                threshold: [
                    0,
                    0.1,
                    0.25,
                    0.5
                ]
            }
        );

    sections.forEach(section =>
        observer.observe(section)
    );
}

/* =========================================================
   PROFILE PANEL
========================================================= */

function setupProfilePanel() {
    const button =
        $("profileButton");

    const panel =
        $("profilePanel");

    const close =
        $("closeProfilePanel");

    if (!button || !panel) {
        return;
    }

    button.addEventListener(
        "click",
        () => {
            panel.classList.add(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    );

    close?.addEventListener(
        "click",
        () => {
            panel.classList.remove(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    );
}

/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function setupNotificationPanel() {
    const button =
        $("notificationButton");

    const panel =
        $("notificationPanel");

    const close =
        $("closeNotificationPanel");

    if (!button || !panel) {
        return;
    }

    button.addEventListener(
        "click",
        () => {
            panel.classList.add(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    );

    close?.addEventListener(
        "click",
        () => {
            panel.classList.remove(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    );
}

/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {
    const button =
        $("logoutButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {
            button.disabled = true;

            button.textContent =
                "Signing out...";

            try {
                const {
                    error
                } = await supabase.auth.signOut();

                if (error) {
                    throw error;
                }

                localStorage.removeItem(
                    "selectedCourse"
                );

                localStorage.removeItem(
                    "selectedCourseName"
                );

                localStorage.removeItem(
                    "selectedUnit"
                );

                localStorage.removeItem(
                    "selectedUnitTitle"
                );

                window.location.href =
                    "./index.html";

            } catch (error) {
                console.error(
                    "Logout error:",
                    error
                );

                button.disabled = false;

                button.textContent =
                    "Sign Out";

                setProfileStatus(
                    "Unable to sign out. Please try again.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   REFRESH BUTTONS
========================================================= */

function setupRefreshButtons() {
    const coursesButton =
        $("refreshCoursesButton");

    const notesButton =
        $("refreshNotesButton");

    coursesButton?.addEventListener(
        "click",
        async () => {
            coursesButton.disabled =
                true;

            coursesButton.textContent =
                "Refreshing...";

            await loadCourses();

            coursesButton.disabled =
                false;

            coursesButton.textContent =
                "Refresh";
        }
    );

    notesButton?.addEventListener(
        "click",
        async () => {
            notesButton.disabled =
                true;

            notesButton.textContent =
                "Refreshing...";

            await loadNotes();

            notesButton.disabled =
                false;

            notesButton.textContent =
                "Refresh";
        }
    );
}

/* =========================================================
   HASH NAVIGATION
========================================================= */

function handleInitialHash() {
    const hash =
        window.location.hash;

    if (!hash) {
        return;
    }

    const id =
        hash.replace(
            "#",
            ""
        );

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    setTimeout(
        () => {
            element.scrollIntoView({
                behavior: "smooth"
            });
        },
        250
    );
}

/* =========================================================
   TRACK COURSE / UNIT
========================================================= */

window.mwanikiTrackUnit =
function (
    courseId,
    unitId,
    unitTitle
) {
    if (
        courseId !== undefined &&
        courseId !== null
    ) {
        localStorage.setItem(
            "selectedCourse",
            String(courseId)
        );
    }

    if (
        unitId !== undefined &&
        unitId !== null
    ) {
        localStorage.setItem(
            "selectedUnit",
            String(unitId)
        );
    }

    if (unitTitle) {
        localStorage.setItem(
            "selectedUnitTitle",
            String(unitTitle)
        );
    }
};

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

    async refresh() {
        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);
    }
};

/* =========================================================
   AUTH LISTENER
========================================================= */

function setupAuthListener() {
    supabase.auth.onAuthStateChange(
        (event, session) => {
            if (
                event ===
                "SIGNED_OUT"
            ) {
                window.location.href =
                    "./index.html";

                return;
            }

            if (
                event ===
                "SIGNED_IN" &&
                session?.user
            ) {
                currentUser =
                    session.user;
            }
        }
    );
}

/* =========================================================
   INITIALIZE DASHBOARD
========================================================= */

async function initializeDashboard() {
    updateCurrentDate();

    setupNavigation();

    setupScrollNavigation();

    setupProfilePanel();

    setupProfileEditor();

    setupNotificationPanel();

    setupLogout();

    setupRefreshButtons();

    setupAuthListener();

    const authenticated =
        await loadStudentProfile();

    if (!authenticated) {
        return;
    }

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizzes()
    ]);

    updateQuizProgress();

    handleInitialHash();

    dashboardReady = true;

    console.log(
        "Mwaniki Scholars dashboard ready"
    );
}

/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeDashboard
);
