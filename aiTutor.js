import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// AI SEARCH ENGINE
// ============================================================
//
// Browser
//    |
//    v
// Supabase Edge Function: mwaniki-ai
//    |
//    +---- Mwaniki Scholars database
//    |
//    +---- Public web search
//    |
//    +---- Web image search
//    |
//    v
// Structured search results
//    |
//    v
// Mwaniki AI interface
//
// IMPORTANT
// No search API key or secret is stored in this browser file.
// ============================================================


// ============================================================
// STATE
// ============================================================

let searchInProgress = false;


// ============================================================
// ELEMENT HELPERS
// ============================================================

function getQuestionInput() {

    const ids = [
        "aiQuestion",
        "aiInput",
        "studentQuestion",
        "tutorQuestion",
        "aiTutorQuestion"
    ];

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {
            return element;
        }

    }

    return null;
}


// ============================================================
// GET ASK BUTTON
// ============================================================

function getAskButton() {

    return (
        document.getElementById("askAIButton") ||
        document.querySelector('[onclick="askAI()"]')
    );

}


// ============================================================
// GET ANSWER BOX
// ============================================================

function getAnswerBox() {

    return document.getElementById(
        "aiAnswer"
    );

}


// ============================================================
// GET STATUS BOX
// ============================================================

function getStatusBox() {

    return document.getElementById(
        "aiSearchStatus"
    );

}


// ============================================================
// GET SOURCES AREA
// ============================================================

function getSourcesArea() {

    return document.getElementById(
        "aiSources"
    );

}


// ============================================================
// GET IMAGES AREA
// ============================================================

function getImagesArea() {

    return document.getElementById(
        "aiImages"
    );

}


// ============================================================
// SAFE TEXT
// ============================================================

function safeText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value);

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


    if (answerBox) {
        answerBox.innerHTML = "";
    }


    if (sourcesArea) {
        sourcesArea.innerHTML = "";
    }


    if (imagesArea) {
        imagesArea.innerHTML = "";
    }

}


// ============================================================
// SEARCH STATUS
// ============================================================

function setSearchStatus(
    message,
    type = "normal"
) {

    const status =
        getStatusBox();

    if (!status) {
        return;
    }


    status.textContent =
        safeText(message);


    status.className =
        "visible";


    if (type === "error") {

        status.classList.add(
            "error"
        );

    }

}


// ============================================================
// CLEAR SEARCH STATUS
// ============================================================

function clearSearchStatus() {

    const status =
        getStatusBox();

    if (!status) {
        return;
    }


    status.textContent =
        "";

    status.className =
        "";

}


// ============================================================
// DISPLAY LOADING
// ============================================================

function displayAILoading() {

    const answerBox =
        getAnswerBox();

    if (!answerBox) {
        return;
    }


    answerBox.innerHTML =
        "";


    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "mwaniki-ai-loading";


    const title =
        document.createElement(
            "strong"
        );

    title.textContent =
        "Searching Mwaniki Scholars and the web";


    const text =
        document.createElement(
            "p"
        );

    text.textContent =
        "Checking available learning material and preparing the search results.";


    wrapper.appendChild(
        title
    );

    wrapper.appendChild(
        text
    );


    answerBox.appendChild(
        wrapper
    );

}


// ============================================================
// DISPLAY ERROR
// ============================================================

function displayAIError(message) {

    const answerBox =
        getAnswerBox();

    if (!answerBox) {
        return;
    }


    answerBox.innerHTML =
        "";


    const error =
        document.createElement(
            "div"
        );

    error.className =
        "mwaniki-ai-error";


    error.textContent =
        safeText(message);


    answerBox.appendChild(
        error
    );

}


// ============================================================
// DISPLAY ANSWER
// ============================================================

function displayAIAnswer(answer) {

    const answerBox =
        getAnswerBox();

    if (!answerBox) {
        return;
    }


    answerBox.innerHTML =
        "";


    if (
        !answer ||
        !String(answer).trim()
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-search";


        empty.textContent =
            "No direct answer was returned. Review the available search results below.";


        answerBox.appendChild(
            empty
        );

        return;

    }


    const content =
        document.createElement(
            "div"
        );

    content.className =
        "mwaniki-ai-answer-content";


    const paragraphs =
        String(answer)
            .split(/\n\s*\n/)
            .map(
                paragraph =>
                    paragraph.trim()
            )
            .filter(Boolean);


    if (
        paragraphs.length === 0
    ) {

        content.textContent =
            String(answer);

    } else {

        paragraphs.forEach(
            paragraph => {

                const p =
                    document.createElement(
                        "p"
                    );

                p.textContent =
                    paragraph;


                content.appendChild(
                    p
                );

            }
        );

    }


    answerBox.appendChild(
        content
    );

}


// ============================================================
// SOURCE TITLE
// ============================================================

function getSourceTitle(source) {

    return (
        source?.title ||
        source?.name ||
        source?.unit ||
        source?.course ||
        source?.file_name ||
        source?.fileName ||
        "Educational material"
    );

}


// ============================================================
// SOURCE URL
// ============================================================

function getSourceURL(source) {

    return (
        source?.url ||
        source?.href ||
        source?.link ||
        source?.file_url ||
        source?.fileUrl ||
        null
    );

}


// ============================================================
// SOURCE TYPE
// ============================================================

function getSourceType(source) {

    return (
        source?.type ||
        source?.source_type ||
        source?.sourceType ||
        source?.table ||
        source?.source ||
        "Mwaniki Scholars"
    );

}


// ============================================================
// CREATE SOURCE ELEMENT
// ============================================================

function createSourceElement(
    source,
    isMwaniki
) {

    const url =
        getSourceURL(source);


    const title =
        getSourceTitle(source);


    const type =
        isMwaniki
            ? getSourceType(source)
            : (
                source?.domain ||
                source?.source ||
                "Web"
            );


    const item =
        document.createElement(
            url
                ? "a"
                : "div"
        );


    item.className =
        "source-item";


    if (url) {

        item.href =
            url;

        item.target =
            "_blank";

        item.rel =
            "noopener noreferrer";

    }


    const titleElement =
        document.createElement(
            "span"
        );

    titleElement.className =
        "source-title";


    titleElement.textContent =
        title;


    const typeElement =
        document.createElement(
            "span"
        );

    typeElement.className =
        "source-url";


    typeElement.textContent =
        type;


    item.appendChild(
        titleElement
    );

    item.appendChild(
        typeElement
    );


    return item;

}


// ============================================================
// DISPLAY SOURCES
// ============================================================

function displaySources(
    mwanikiSources = [],
    webResults = []
) {

    const sourcesArea =
        getSourcesArea();

    if (!sourcesArea) {
        return;
    }


    sourcesArea.innerHTML =
        "";


    const hasMwaniki =
        Array.isArray(
            mwanikiSources
        ) &&
        mwanikiSources.length > 0;


    const hasWeb =
        Array.isArray(
            webResults
        ) &&
        webResults.length > 0;


    if (
        !hasMwaniki &&
        !hasWeb
    ) {

        return;

    }


    if (hasMwaniki) {

        const section =
            document.createElement(
                "div"
            );

        section.className =
            "source-group";


        const heading =
            document.createElement(
                "h4"
            );

        heading.textContent =
            "Mwaniki Scholars material";


        section.appendChild(
            heading
        );


        const list =
            document.createElement(
                "div"
            );

        list.className =
            "source-list";


        mwanikiSources
            .slice(0, 20)
            .forEach(
                source => {

                    const item =
                        createSourceElement(
                            source,
                            true
                        );

                    list.appendChild(
                        item
                    );

                }
            );


        section.appendChild(
            list
        );


        sourcesArea.appendChild(
            section
        );

    }


    if (hasWeb) {

        const section =
            document.createElement(
                "div"
            );

        section.className =
            "source-group";


        const heading =
            document.createElement(
                "h4"
            );

        heading.textContent =
            "Web results";


        section.appendChild(
            heading
        );


        const list =
            document.createElement(
                "div"
            );

        list.className =
            "source-list";


        webResults
            .slice(0, 20)
            .forEach(
                source => {

                    const item =
                        createSourceElement(
                            source,
                            false
                        );

                    list.appendChild(
                        item
                    );

                }
            );


        section.appendChild(
            list
        );


        sourcesArea.appendChild(
            section
        );

    }

}


// ============================================================
// IMAGE URL
// ============================================================

function getImageURL(image) {

    return (
        image?.image_url ||
        image?.imageUrl ||
        image?.thumbnail ||
        image?.thumbnail_url ||
        image?.thumbnailUrl ||
        image?.url ||
        null
    );

}


// ============================================================
// IMAGE TITLE
// ============================================================

function getImageTitle(image) {

    return (
        image?.title ||
        image?.name ||
        image?.description ||
        "Medical image"
    );

}


// ============================================================
// IMAGE LINK
// ============================================================

function getImageLink(image) {

    return (
        image?.source_url ||
        image?.sourceUrl ||
        image?.page_url ||
        image?.pageUrl ||
        image?.link ||
        image?.url ||
        null
    );

}


// ============================================================
// DISPLAY IMAGES
// ============================================================

function displayImages(images = []) {

    const imagesArea =
        getImagesArea();

    if (!imagesArea) {
        return;
    }


    imagesArea.innerHTML =
        "";


    if (
        !Array.isArray(images) ||
        images.length === 0
    ) {

        return;

    }


    const section =
        document.createElement(
            "div"
        );

    section.className =
        "source-group";


    const heading =
        document.createElement(
            "h4"
        );

    heading.textContent =
        "Visual results";


    section.appendChild(
        heading
    );


    const grid =
        document.createElement(
            "div"
        );

    grid.className =
        "image-results";


    images
        .slice(0, 12)
        .forEach(
            image => {

                const imageURL =
                    getImageURL(
                        image
                    );


                if (!imageURL) {
                    return;
                }


                const linkURL =
                    getImageLink(
                        image
                    );


                const card =
                    document.createElement(
                        linkURL
                            ? "a"
                            : "div"
                    );


                card.className =
                    "image-result";


                if (linkURL) {

                    card.href =
                        linkURL;

                    card.target =
                        "_blank";

                    card.rel =
                        "noopener noreferrer";

                }


                const img =
                    document.createElement(
                        "img"
                    );


                img.src =
                    imageURL;


                img.alt =
                    getImageTitle(
                        image
                    );


                img.loading =
                    "lazy";


                img.addEventListener(
                    "error",
                    () => {

                        card.remove();

                    }
                );


                const title =
                    document.createElement(
                        "div"
                    );


                title.className =
                    "image-result-title";


                title.textContent =
                    getImageTitle(
                        image
                    );


                card.appendChild(
                    img
                );


                card.appendChild(
                    title
                );


                grid.appendChild(
                    card
                );

            }
        );


    if (
        grid.children.length === 0
    ) {

        return;

    }


    section.appendChild(
        grid
    );


    imagesArea.appendChild(
        section
    );

}


// ============================================================
// SAVE SEARCH HISTORY
// ============================================================

function saveAIQuestion(question) {

    try {

        const existing =
            JSON.parse(
                localStorage.getItem(
                    "mwanikiAIQuestions"
                ) || "[]"
            );


        existing.unshift({

            question:
                String(question),

            timestamp:
                new Date()
                    .toISOString()

        });


        localStorage.setItem(
            "mwanikiAIQuestions",
            JSON.stringify(
                existing.slice(0, 20)
            )
        );


    } catch (error) {

        console.warn(
            "Could not save search history.",
            error
        );

    }

}


// ============================================================
// NORMALIZE EDGE FUNCTION RESPONSE
// ============================================================

function normalizeResponse(data) {

    const response =
        data &&
        typeof data === "object"
            ? data
            : {};


    const mwanikiSources =
        Array.isArray(
            response.mwanikiSources
        )
            ? response.mwanikiSources
            : (
                Array.isArray(
                    response.sources
                )
                    ? response.sources
                    : []
            );


    const webResults =
        Array.isArray(
            response.webResults
        )
            ? response.webResults
            : (
                Array.isArray(
                    response.web_sources
                )
                    ? response.web_sources
                    : (
                        Array.isArray(
                            response.webResults
                        )
                            ? response.webResults
                            : []
                    )
            );


    const images =
        Array.isArray(
            response.images
        )
            ? response.images
            : (
                Array.isArray(
                    response.imageResults
                )
                    ? response.imageResults
                    : []
            );


    return {

        answer:
            response.answer ||
            response.summary ||
            "",

        mwanikiSources,

        webResults,

        images,

        googleSearchUrl:
            response.googleSearchUrl ||
            response.google_search_url ||
            null,

        searchStatus:
            response.searchStatus ||
            response.search_status ||
            null

    };

}


// ============================================================
// DISPLAY GOOGLE SEARCH LINK
// ============================================================
//
// This is a safe fallback while the server-side web-search
// provider is being connected.
//
// It does NOT pretend that a Google result was retrieved.
// ============================================================

function displayGoogleSearchFallback(
    googleSearchUrl,
    question
) {

    if (!googleSearchUrl) {
        return;
    }


    const sourcesArea =
        getSourcesArea();

    if (!sourcesArea) {
        return;
    }


    const section =
        document.createElement(
            "div"
        );

    section.className =
        "source-group";


    const heading =
        document.createElement(
            "h4"
        );

    heading.textContent =
        "Public web search";


    section.appendChild(
        heading
    );


    const link =
        document.createElement(
            "a"
        );


    link.className =
        "source-item";


    link.href =
        googleSearchUrl;


    link.target =
        "_blank";


    link.rel =
        "noopener noreferrer";


    const title =
        document.createElement(
            "span"
        );


    title.className =
        "source-title";


    title.textContent =
        "Search Google for this topic";


    const description =
        document.createElement(
            "span"
        );


    description.className =
        "source-url";


    description.textContent =
        question;


    link.appendChild(
        title
    );


    link.appendChild(
        description
    );


    section.appendChild(
        link
    );


    sourcesArea.appendChild(
        section
    );

}


// ============================================================
// ASK MWANIKI AI
// ============================================================

async function askAI(
    questionFromDashboard = null
) {

    if (searchInProgress) {
        return;
    }


    const input =
        getQuestionInput();


    const button =
        getAskButton();


    let question =
        questionFromDashboard;


    if (
        !question &&
        input
    ) {

        question =
            input.value.trim();

    }


    if (!question) {

        if (!input) {

            displayAIError(
                "The Mwaniki AI search box could not be found."
            );

            return;

        }


        displayAIError(
            "Please enter a medical question or search topic."
        );


        input.focus();

        return;

    }


    question =
        String(question)
            .trim();


    if (
        question.length < 2
    ) {

        displayAIError(
            "Please enter a longer search question."
        );

        return;

    }


    if (
        question.length > 2000
    ) {

        displayAIError(
            "Your question is too long. Please shorten it and try again."
        );

        return;

    }


    searchInProgress =
        true;


    const originalButtonText =
        button
            ? button.textContent
            : "";


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Searching...";

        button.style.opacity =
            "0.7";

        button.style.cursor =
            "wait";

    }


    clearResults();


    setSearchStatus(
        "Searching Mwaniki Scholars material..."
    );


    displayAILoading();


    try {

        // ----------------------------------------------------
        // CALL SUPABASE EDGE FUNCTION
        // ----------------------------------------------------

        const {
            data,
            error
        } =
            await supabase.functions.invoke(
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


        if (error) {

            console.error(
                "Mwaniki AI Edge Function error:",
                error
            );


            throw new Error(
                error.message ||
                "The Mwaniki AI search service could not be reached."
            );

        }


        if (!data) {

            throw new Error(
                "The Mwaniki AI search service returned no data."
            );

        }


        console.log(
            "Mwaniki AI response received.",
            data
        );


        const result =
            normalizeResponse(
                data
            );


        // ----------------------------------------------------
        // DISPLAY ANSWER
        // ----------------------------------------------------

        displayAIAnswer(
            result.answer
        );


        // ----------------------------------------------------
        // DISPLAY MWANIKI + WEB SOURCES
        // ----------------------------------------------------

        displaySources(

            result.mwanikiSources,

            result.webResults

        );


        // ----------------------------------------------------
        // DISPLAY IMAGES
        // ----------------------------------------------------

        displayImages(
            result.images
        );


        // ----------------------------------------------------
        // GOOGLE FALLBACK
        // ----------------------------------------------------

        if (
            result.googleSearchUrl &&
            result.webResults.length === 0
        ) {

            displayGoogleSearchFallback(
                result.googleSearchUrl,
                question
            );

        }


        // ----------------------------------------------------
        // COUNTS
        // ----------------------------------------------------

        const totalMwaniki =
            result.mwanikiSources.length;


        const totalWeb =
            result.webResults.length;


        const totalImages =
            result.images.length;


        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------

        if (
            result.searchStatus &&
            typeof result.searchStatus === "object"
        ) {

            const statusParts = [];


            if (
                result.searchStatus.mwaniki !== undefined
            ) {

                statusParts.push(
                    `Mwaniki: ${result.searchStatus.mwaniki}`
                );

            }


            if (
                result.searchStatus.web !== undefined
            ) {

                statusParts.push(
                    `Web: ${result.searchStatus.web}`
                );

            }


            if (
                result.searchStatus.images !== undefined
            ) {

                statusParts.push(
                    `Images: ${result.searchStatus.images}`
                );

            }


            if (
                statusParts.length > 0
            ) {

                setSearchStatus(
                    statusParts.join(" | ")
                );

            } else {

                setSearchStatus(
                    `Search complete. ${totalMwaniki} Mwaniki result${totalMwaniki === 1 ? "" : "s"}, ${totalWeb} web result${totalWeb === 1 ? "" : "s"}, ${totalImages} image${totalImages === 1 ? "" : "s"} found.`
                );

            }

        } else {

            setSearchStatus(
                `Search complete. ${totalMwaniki} Mwaniki result${totalMwaniki === 1 ? "" : "s"}, ${totalWeb} web result${totalWeb === 1 ? "" : "s"}, ${totalImages} image${totalImages === 1 ? "" : "s"} found.`
            );

        }


        // ----------------------------------------------------
        // SAVE SEARCH HISTORY
        // ----------------------------------------------------

        saveAIQuestion(
            question
        );


    } catch (error) {

        console.error(
            "Mwaniki AI search error:",
            error
        );


        clearSearchStatus();


        setSearchStatus(

            error?.message ||
            "Mwaniki AI could not complete the search.",

            "error"

        );


        displayAIError(

            error?.message ||
            "Mwaniki AI could not complete the search right now."

        );

    } finally {

        searchInProgress =
            false;


        if (button) {

            button.disabled =
                false;


            button.textContent =
                originalButtonText ||
                "Search Mwaniki AI";


            button.style.opacity =
                "1";


            button.style.cursor =
                "pointer";

        }

    }

}


// ============================================================
// QUICK SEARCH BUTTONS
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


                    if (input) {

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
// ENTER / CTRL+ENTER
// ============================================================

function setupKeyboardShortcuts() {

    const input =
        getQuestionInput();


    if (!input) {
        return;
    }


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                (
                    event.ctrlKey ||
                    event.metaKey
                )
            ) {

                event.preventDefault();

                askAI();

            }

        }
    );

}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSuggestionButtons();

        setupKeyboardShortcuts();


        console.log(
            "Mwaniki AI search interface initialized."
        );

    }
);


// ============================================================
// GLOBAL ACCESS
// ============================================================

window.askAI =
    askAI;


window.askMwanikiAI =
    askAI;
