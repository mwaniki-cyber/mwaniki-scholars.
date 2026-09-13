import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// MWANIKI AI SEARCH ENGINE
// ============================================================
//
// IMPORTANT:
//
// Recommended questions are ONLY shortcuts.
// Users can type ANY question.
//
// Search flow:
//
// 1. Mwaniki Scholars database
// 2. Optional public web search
// 3. Optional public image search
// 4. Google fallback when provider is unavailable
//
// ============================================================


let searchInProgress = false;


// ============================================================
// ELEMENT HELPERS
// ============================================================

function getQuestionInput() {

    return (
        document.getElementById("aiQuestion") ||
        document.getElementById("aiInput") ||
        document.getElementById("studentQuestion") ||
        document.getElementById("tutorQuestion") ||
        document.getElementById("aiTutorQuestion")
    );

}


function getAskButton() {

    return (
        document.getElementById("askAIButton") ||
        document.querySelector(
            '[onclick="askAI()"]'
        )
    );

}


function getAnswerBox() {

    return document.getElementById(
        "aiAnswer"
    );

}


function getStatusBox() {

    return document.getElementById(
        "aiSearchStatus"
    );

}


function getSourcesArea() {

    return document.getElementById(
        "aiSources"
    );

}


function getImagesArea() {

    return document.getElementById(
        "aiImages"
    );

}


function getMainStatus() {

    return document.getElementById(
        "aiStatus"
    );

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(
            value ?? ""
        );

    return div.innerHTML;

}


// ============================================================
// CLEAR RESULTS
// ============================================================

function clearResults() {

    const answerBox =
        getAnswerBox();

    const sourcesArea =
        getSourcesArea();

    const imagesArea =
        getImagesArea();


    if (
        answerBox
    ) {

        answerBox.innerHTML =
            "";

    }


    if (
        sourcesArea
    ) {

        sourcesArea.innerHTML =
            "";

    }


    if (
        imagesArea
    ) {

        imagesArea.innerHTML =
            "";

    }

}


// ============================================================
// STATUS
// ============================================================

function setSearchStatus(
    message,
    type = "normal"
) {

    const statusBox =
        getStatusBox();

    if (
        !statusBox
    ) {

        return;

    }


    statusBox.textContent =
        message;


    statusBox.className =
        "";


    statusBox.classList.add(
        `search-status-${type}`
    );

}


function clearSearchStatus() {

    const statusBox =
        getStatusBox();

    if (
        statusBox
    ) {

        statusBox.textContent =
            "";

        statusBox.className =
            "";

    }

}


// ============================================================
// MAIN STATUS BADGE
// ============================================================

function setMainStatus(
    message
) {

    const status =
        getMainStatus();

    if (
        status
    ) {

        const textNodes =
            Array.from(
                status.childNodes
            )
            .filter(
                node =>
                    node.nodeType ===
                    Node.TEXT_NODE
            );


        if (
            textNodes.length > 0
        ) {

            textNodes[
                textNodes.length - 1
            ].textContent =
                ` ${message}`;

        } else {

            status.append(
                document.createTextNode(
                    ` ${message}`
                )
            );

        }

    }

}


// ============================================================
// LOADING
// ============================================================

function displayAILoading() {

    const answerBox =
        getAnswerBox();

    if (
        !answerBox
    ) {

        return;

    }


    answerBox.innerHTML = `
        <div class="ai-loading">
            <div class="ai-loading-spinner"></div>

            <div>
                <strong>Searching Mwaniki Scholars...</strong>

                <p>
                    Checking courses, units, notes and quizzes.
                </p>
            </div>
        </div>
    `;

}


// ============================================================
// ERROR
// ============================================================

function displayAIError(
    message
) {

    const answerBox =
        getAnswerBox();

    if (
        !answerBox
    ) {

        return;

    }


    answerBox.innerHTML = `
        <div class="ai-error">
            <strong>Search could not be completed.</strong>

            <p>
                ${escapeHTML(message)}
            </p>

            <p>
                You can try the search again.
            </p>
        </div>
    `;

}


// ============================================================
// ANSWER
// ============================================================

function displayAIAnswer(
    answer
) {

    const answerBox =
        getAnswerBox();

    if (
        !answerBox
    ) {

        return;

    }


    if (
        !answer
    ) {

        answerBox.innerHTML = `
            <div class="ai-empty">
                No search summary was returned.
            </div>
        `;

        return;

    }


    const paragraphs =
        String(answer)
            .split(/\n\s*\n/)
            .map(
                paragraph =>
                    paragraph.trim()
            )
            .filter(Boolean);


    answerBox.innerHTML =
        paragraphs
            .map(
                paragraph => `
                    <p>
                        ${escapeHTML(
                            paragraph
                        )}
                    </p>
                `
            )
            .join("");

}


// ============================================================
// SOURCE HELPERS
// ============================================================

function getSourceTitle(
    source
) {

    return (
        source?.title ||
        source?.name ||
        source?.file_name ||
        "Mwaniki Scholars resource"
    );

}


function getSourceURL(
    source
) {

    return (
        source?.url ||
        source?.file_url ||
        source?.link ||
        null
    );

}


function getSourceType(
    source
) {

    return (
        source?.type ||
        source?.source ||
        "Resource"
    );

}


// ============================================================
// SOURCE ELEMENT
// ============================================================

function createSourceElement(
    source,
    isMwaniki = false
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        isMwaniki
            ? "ai-source mwaniki-source"
            : "ai-source web-source";


    const title =
        getSourceTitle(
            source
        );


    const url =
        getSourceURL(
            source
        );


    const type =
        getSourceType(
            source
        );


    const description =
        source?.description ||
        "";


    wrapper.innerHTML = `
        <div class="ai-source-type">
            ${escapeHTML(type)}
        </div>

        <div class="ai-source-title">
            ${escapeHTML(title)}
        </div>

        ${
            description
                ? `
                    <div class="ai-source-description">
                        ${escapeHTML(
                            description
                        )}
                    </div>
                `
                : ""
        }

        ${
            url
                ? `
                    <a
                        class="ai-source-link"
                        href="${escapeHTML(url)}"
                        ${
                            String(url)
                                .startsWith(
                                    "http"
                                )
                                ? `
                                    target="_blank"
                                    rel="noopener noreferrer"
                                `
                                : ""
                        }
                    >
                        Open source
                    </a>
                `
                : ""
        }
    `;


    return wrapper;

}


// ============================================================
// DISPLAY SOURCES
// ============================================================

function displaySources(
    mwanikiSources = [],
    webResults = []
) {

    const area =
        getSourcesArea();

    if (
        !area
    ) {

        return;

    }


    area.innerHTML =
        "";


    const total =
        mwanikiSources.length +
        webResults.length;


    if (
        total === 0
    ) {

        return;

    }


    const heading =
        document.createElement(
            "h3"
        );


    heading.textContent =
        "Sources";


    area.appendChild(
        heading
    );


    if (
        mwanikiSources.length > 0
    ) {

        const sectionTitle =
            document.createElement(
                "div"
            );


        sectionTitle.className =
            "ai-source-section-title";


        sectionTitle.textContent =
            "Mwaniki Scholars";


        area.appendChild(
            sectionTitle
        );


        mwanikiSources.forEach(
            source => {

                area.appendChild(
                    createSourceElement(
                        source,
                        true
                    )
                );

            }
        );

    }


    if (
        webResults.length > 0
    ) {

        const sectionTitle =
            document.createElement(
                "div"
            );


        sectionTitle.className =
            "ai-source-section-title";


        sectionTitle.textContent =
            "Web results";


        area.appendChild(
            sectionTitle
        );


        webResults.forEach(
            source => {

                area.appendChild(
                    createSourceElement(
                        source,
                        false
                    )
                );

            }
        );

    }

}


// ============================================================
// IMAGE HELPERS
// ============================================================

function getImageURL(
    image
) {

    return (
        image?.url ||
        image?.image_url ||
        image?.thumbnail ||
        image?.thumbnail_url ||
        null
    );

}


function getImageTitle(
    image
) {

    return (
        image?.title ||
        image?.name ||
        "Medical image"
    );

}


function getImageLink(
    image
) {

    return (
        image?.source_url ||
        image?.link ||
        image?.page_url ||
        getImageURL(
            image
        )
    );

}


// ============================================================
// DISPLAY IMAGES
// ============================================================

function displayImages(
    images = []
) {

    const area =
        getImagesArea();

    if (
        !area
    ) {

        return;

    }


    area.innerHTML =
        "";


    if (
        images.length === 0
    ) {

        return;

    }


    const heading =
        document.createElement(
            "h3"
        );


    heading.textContent =
        "Visual results";


    area.appendChild(
        heading
    );


    const grid =
        document.createElement(
            "div"
        );


    grid.className =
        "ai-image-grid";


    images.forEach(
        image => {

            const imageURL =
                getImageURL(
                    image
                );


            if (
                !imageURL
            ) {

                return;

            }


            const title =
                getImageTitle(
                    image
                );


            const link =
                getImageLink(
                    image
                );


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "ai-image-card";


            card.innerHTML = `
                ${
                    link
                        ? `
                            <a
                                href="${escapeHTML(link)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img
                                    src="${escapeHTML(imageURL)}"
                                    alt="${escapeHTML(title)}"
                                    loading="lazy"
                                >
                            </a>
                        `
                        : `
                            <img
                                src="${escapeHTML(imageURL)}"
                                alt="${escapeHTML(title)}"
                                loading="lazy"
                            >
                        `
                }

                <div class="ai-image-title">
                    ${escapeHTML(title)}
                </div>
            `;


            grid.appendChild(
                card
            );

        }
    );


    if (
        grid.children.length > 0
    ) {

        area.appendChild(
            grid
        );

    }

}


// ============================================================
// GOOGLE SEARCH FALLBACK
// ============================================================

function displayGoogleSearchFallback(
    googleSearchUrl,
    question
) {

    const area =
        getSourcesArea();

    if (
        !area ||
        !googleSearchUrl
    ) {

        return;

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "google-fallback";


    wrapper.innerHTML = `
        <div class="ai-source-section-title">
            Public web search
        </div>

        <div class="ai-source google-source">

            <div class="ai-source-title">
                Search Google for:
                ${escapeHTML(question)}
            </div>

            <a
                class="ai-source-link"
                href="${escapeHTML(
                    googleSearchUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
            >
                Open Google Search
            </a>

        </div>
    `;


    area.appendChild(
        wrapper
    );

}


// ============================================================
// GOOGLE IMAGE FALLBACK
// ============================================================

function displayGoogleImageFallback(
    googleImageSearchUrl,
    question
) {

    const area =
        getImagesArea();

    if (
        !area ||
        !googleImageSearchUrl
    ) {

        return;

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "google-image-fallback";


    wrapper.innerHTML = `
        <div class="ai-source-section-title">
            Image search
        </div>

        <div class="ai-source">

            <div class="ai-source-title">
                Search medical images for:
                ${escapeHTML(question)}
            </div>

            <a
                class="ai-source-link"
                href="${escapeHTML(
                    googleImageSearchUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
            >
                Open Google Images
            </a>

        </div>
    `;


    area.appendChild(
        wrapper
    );

}


// ============================================================
// SAVE QUESTION
// ============================================================

function saveAIQuestion(
    question
) {

    try {

        const key =
            "mwanikiAIQuestions";


        const existing =
            JSON.parse(
                localStorage.getItem(
                    key
                ) || "[]"
            );


        const updated =
            [
                {
                    question,
                    timestamp:
                        new Date()
                            .toISOString()
                },

                ...existing.filter(
                    item =>
                        item?.question !==
                        question
                )
            ]
            .slice(
                0,
                20
            );


        localStorage.setItem(
            key,
            JSON.stringify(
                updated
            )
        );

    } catch (error) {

        console.warn(
            "Could not save AI question:",
            error
        );

    }

}


// ============================================================
// NORMALIZE RESPONSE
// ============================================================

function normalizeResponse(
    data
) {

    return {

        answer:
            data?.answer ||
            data?.summary ||
            "",

        mwanikiSources:
            Array.isArray(
                data?.mwanikiSources
            )
                ? data.mwanikiSources
                : Array.isArray(
                    data?.sources
                )
                    ? data.sources
                    : [],

        webResults:
            Array.isArray(
                data?.webResults
            )
                ? data.webResults
                : Array.isArray(
                    data?.web_sources
                )
                    ? data.web_sources
                    : [],

        images:
            Array.isArray(
                data?.images
            )
                ? data.images
                : Array.isArray(
                    data?.imageResults
                )
                    ? data.imageResults
                    : [],

        googleSearchUrl:
            data?.googleSearchUrl ||
            data?.google_search_url ||
            null,

        googleImageSearchUrl:
            data?.googleImageSearchUrl ||
            data?.google_image_search_url ||
            null,

        searchStatus:
            data?.searchStatus ||
            data?.search_status ||
            null,

        counts:
            data?.counts ||
            null

    };

}


// ============================================================
// TIMEOUT
// ============================================================

function timeoutPromise(
    milliseconds
) {

    return new Promise(
        (_, reject) => {

            setTimeout(
                () => {

                    reject(
                        new Error(
                            "Mwaniki AI search timed out. Please try again."
                        )
                    );

                },
                milliseconds
            );

        }
    );

}


// ============================================================
// MAIN SEARCH
// ============================================================

async function askAI(
    questionFromDashboard = null
) {

    if (
        searchInProgress
    ) {

        return;

    }


    const input =
        getQuestionInput();

    const button =
        getAskButton();


    const question =
        (
            questionFromDashboard ||
            input?.value ||
            ""
        )
        .trim();


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
        !question
    ) {

        setSearchStatus(
            "Type a question or search topic first.",
            "error"
        );

        input?.focus();

        return;

    }


    if (
        question.length < 2
    ) {

        setSearchStatus(
            "Please enter at least two characters.",
            "error"
        );

        input?.focus();

        return;

    }


    if (
        question.length > 2000
    ) {

        setSearchStatus(
            "Your search is too long. Please shorten it.",
            "error"
        );

        return;

    }


    // --------------------------------------------------------
    // LOCK SEARCH
    // --------------------------------------------------------

    searchInProgress =
        true;


    if (
        button
    ) {

        button.disabled =
            true;

        button.textContent =
            "Searching...";

    }


    clearResults();


    setSearchStatus(
        "Searching Mwaniki Scholars material...",
        "loading"
    );


    setMainStatus(
        "Searching"
    );


    displayAILoading();


    try {

        // ----------------------------------------------------
        // GET SESSION
        // ----------------------------------------------------

        const {
            data: sessionData,
            error: sessionError
        } =
            await supabase.auth.getSession();


        if (
            sessionError
        ) {

            throw new Error(
                "Unable to read your login session."
            );

        }


        const session =
            sessionData?.session;


        if (
            !session?.access_token
        ) {

            throw new Error(
                "You are not signed in. Please log in again."
            );

        }


        // ----------------------------------------------------
        // EDGE FUNCTION REQUEST
        // ----------------------------------------------------

        const functionPromise =
            supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {

                        question,

                        searchMwaniki:
                            true,

                        searchWeb:
                            true,

                        searchImages:
                            true

                    }
                }
            );


        // ----------------------------------------------------
        // HARD FRONTEND TIMEOUT
        // ----------------------------------------------------

        const result =
            await Promise.race([
                functionPromise,
                timeoutPromise(
                    25000
                )
            ]);


        const {
            data,
            error
        } =
            result;


        if (
            error
        ) {

            throw new Error(
                error.message ||
                "Mwaniki AI search failed."
            );

        }


        if (
            !data
        ) {

            throw new Error(
                "Mwaniki AI returned no data."
            );

        }


        // ----------------------------------------------------
        // NORMALIZE
        // ----------------------------------------------------

        const response =
            normalizeResponse(
                data
            );


        // ----------------------------------------------------
        // ANSWER
        // ----------------------------------------------------

        displayAIAnswer(
            response.answer
        );


        // ----------------------------------------------------
        // SOURCES
        // ----------------------------------------------------

        displaySources(
            response.mwanikiSources,
            response.webResults
        );


        // ----------------------------------------------------
        // IMAGES
        // ----------------------------------------------------

        displayImages(
            response.images
        );


        // ----------------------------------------------------
        // GOOGLE FALLBACK
        // ----------------------------------------------------

        if (
            response.googleSearchUrl &&
            response.webResults.length === 0
        ) {

            displayGoogleSearchFallback(
                response.googleSearchUrl,
                question
            );

        }


        if (
            response.googleImageSearchUrl &&
            response.images.length === 0
        ) {

            displayGoogleImageFallback(
                response.googleImageSearchUrl,
                question
            );

        }


        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------

        const mwanikiCount =
            response.counts?.mwaniki ??
            response.mwanikiSources.length;


        const webCount =
            response.counts?.web ??
            response.webResults.length;


        const imageCount =
            response.counts?.images ??
            response.images.length;


        setSearchStatus(
            `Search complete — ${mwanikiCount} Mwaniki result${
                mwanikiCount === 1
                    ? ""
                    : "s"
            }, ${webCount} web result${
                webCount === 1
                    ? ""
                    : "s"
            }, ${imageCount} image result${
                imageCount === 1
                    ? ""
                    : "s"
            }.`,
            "success"
        );


        setMainStatus(
            "Ready"
        );


        saveAIQuestion(
            question
        );


    } catch (error) {

        console.error(
            "Mwaniki AI error:",
            error
        );


        const message =
            error?.message ||
            "Something went wrong while searching.";


        displayAIError(
            message
        );


        setSearchStatus(
            message,
            "error"
        );


        setMainStatus(
            "Ready"
        );

    } finally {

        // ----------------------------------------------------
        // ALWAYS UNLOCK UI
        // ----------------------------------------------------

        searchInProgress =
            false;


        if (
            button
        ) {

            button.disabled =
                false;

            button.textContent =
                "Search Mwaniki AI";

        }

    }

}


// ============================================================
// SUGGESTION BUTTONS
// ============================================================

function setupSuggestionButtons() {

    const buttons =
        document.querySelectorAll(
            ".suggestion-button"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const question =
                        button.dataset.question ||
                        button.textContent.trim();


                    const input =
                        getQuestionInput();


                    if (
                        input
                    ) {

                        input.value =
                            question;

                        input.focus();

                    }


                    askAI(
                        question
                    );

                }
            );

        }
    );

}


// ============================================================
// KEYBOARD SHORTCUT
// ============================================================

function setupKeyboardShortcuts() {

    const input =
        getQuestionInput();


    if (
        !input
    ) {

        return;

    }


    input.addEventListener(
        "keydown",
        event => {

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key === "Enter"
            ) {

                event.preventDefault();

                askAI();

            }

        }
    );

}


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSuggestionButtons();

        setupKeyboardShortcuts();

        setMainStatus(
            "Ready"
        );

    }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.askAI =
    askAI;

window.askMwanikiAI =
    askAI;
