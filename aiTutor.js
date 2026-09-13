```javascript
import { supabase } from "./supabase.js";


/* =========================================================
   MWANIKI SCHOLARS
   AI TUTOR ENGINE

   IMPORTANT ARCHITECTURE

   1. Mwaniki internal retrieval
   2. Google web search
   3. Google image search

   These three operations are INDEPENDENT.

   Google must NEVER depend on Mwaniki having
   an internal answer.
========================================================= */


/* =========================================================
   DOM
========================================================= */

const aiQuestion =
    document.getElementById("aiQuestion");

const askAIButton =
    document.getElementById("askAIButton");

const aiAnswer =
    document.getElementById("aiAnswer");

const aiQuestionDisplay =
    document.getElementById("aiQuestionDisplay");

const aiStatus =
    document.getElementById("aiStatus");

const aiSearchStatus =
    document.getElementById("aiSearchStatus");

const webResults =
    document.getElementById("webResults");

const aiImages =
    document.getElementById("aiImages");

const backToDashboardButton =
    document.getElementById("backToDashboardButton");

const readAnswerButton =
    document.getElementById("readAnswerButton");

const stopAudioButton =
    document.getElementById("stopAudioButton");

const testMeButton =
    document.getElementById("testMeButton");

const testPanel =
    document.getElementById("testPanel");

const testProgress =
    document.getElementById("testProgress");

const testStatus =
    document.getElementById("testStatus");

const testQuestion =
    document.getElementById("testQuestion");

const testOptions =
    document.getElementById("testOptions");

const testFeedback =
    document.getElementById("testFeedback");

const testNext =
    document.getElementById("testNext");

const testExit =
    document.getElementById("testExit");


/* =========================================================
   STATE
========================================================= */

let currentAnswerText = "";

let currentQuestion = "";

let currentTestTopic = "";

let currentTestNumber = 0;

let currentTestLength = 10;

let currentTestScore = 0;

let currentTestUsedIds = [];

let currentTestAnswered = false;

let currentTestCorrectKey = "";

let speechQueue = [];

let speechIndex = 0;

let speechStopped = false;


/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {

    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}


function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function safeURL(value) {

    try {

        const url =
            new URL(
                String(value || ""),
                window.location.href
            );

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return "";
        }

        return url.href;

    } catch {

        return "";
    }
}


function textToHTML(text) {

    if (!text) {
        return "";
    }


    let safe =
        escapeHTML(text);


    safe =
        safe.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    safe =
        safe.replace(
            /^[-•]\s+(.+)$/gm,
            "<li>$1</li>"
        );


    safe =
        safe.replace(
            /(<li>.*<\/li>)/gs,
            "<ul>$1</ul>"
        );


    safe =
        safe.replace(
            /\n{2,}/g,
            "</p><p>"
        );


    safe =
        safe.replace(
            /\n/g,
            "<br>"
        );


    if (!safe.includes("<p>")) {

        safe =
            `<p>${safe}</p>`;
    }


    return safe;
}


function setStatus(
    message,
    type = ""
) {

    if (!aiStatus) {
        return;
    }

    aiStatus.textContent =
        message || "";

    aiStatus.className =
        "ai-status";

    if (type) {
        aiStatus.classList.add(type);
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

if (backToDashboardButton) {

    backToDashboardButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "./dashboard.html";
        }
    );
}


/* =========================================================
   SUGGESTED QUESTIONS
========================================================= */

document
    .querySelectorAll(".suggestion-button")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const question =
                    button.dataset.question ||
                    button.textContent.trim();

                if (aiQuestion) {

                    aiQuestion.value =
                        question;

                    aiQuestion.focus();
                }

                searchAI();
            }
        );

    });


/* =========================================================
   ENTER KEY
========================================================= */

if (aiQuestion) {

    aiQuestion.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                searchAI();
            }

        }
    );
}


/* =========================================================
   MAIN AI SEARCH
========================================================= */

async function searchAI() {

    const query =
        cleanText(
            aiQuestion?.value
        );


    if (!query) {

        setStatus(
            "Enter a medical question first.",
            "error"
        );

        aiQuestion?.focus();

        return;
    }


    currentQuestion =
        query;


    if (aiQuestionDisplay) {

        aiQuestionDisplay.textContent =
            query;
    }


    if (askAIButton) {

        askAIButton.disabled =
            true;

        askAIButton.innerHTML =
            "<span>⏳</span> Researching...";
    }


    setStatus(
        "Searching Mwaniki AI and the web..."
    );


    if (aiSearchStatus) {

        aiSearchStatus.textContent =
            "Searching Google independently...";
    }


    clearResearchPanels();


    try {

        /* =================================================
           AUTH
        ================================================== */

        const {
            data: {
                session
            } = {}
        } =
            await supabase.auth.getSession();


        if (!session) {

            throw new Error(
                "Please log in before using Mwaniki AI."
            );
        }


        /* =================================================
           ONE REQUEST — THREE INDEPENDENT RETRIEVAL PATHS
        ================================================== */

        const response =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {

                        mode: "search",

                        question: query,

                        /*
                         * IMPORTANT
                         *
                         * All three are independently enabled.
                         */

                        searchMwaniki: true,

                        searchWeb: true,

                        searchImages: true
                    }
                }
            );


        if (response.error) {

            throw response.error;
        }


        const data =
            response.data || {};


        /* =================================================
           INTERNAL AI ANSWER
        ================================================== */

        const aiAnswerText =
            cleanText(
                data.answer ||
                data.finalAnswer ||
                data.mwanikiAnswer ||
                ""
            );


        currentAnswerText =
            aiAnswerText;


        /* =================================================
           GOOGLE RESULTS
           
           THESE ARE READ EVEN WHEN AI ANSWER IS EMPTY.
        ================================================== */

        const results =
            Array.isArray(data.webResults)
                ? data.webResults
                : [];


        const images =
            Array.isArray(data.images)
                ? data.images
                : [];


        const primaryImage =
            data.primaryImage ||
            null;


        const googleSearchUrl =
            data.googleSearchUrl ||
            "";


        const googleImagesUrl =
            data.googleImagesUrl ||
            "";


        /* =================================================
           RENDER EVERYTHING INDEPENDENTLY
        ================================================== */

        renderAnswer(
            query,
            aiAnswerText
        );


        renderWebResults(
            results,
            googleSearchUrl
        );


        renderImages(
            images,
            primaryImage,
            googleImagesUrl
        );


        /* =================================================
           STATUS
        ================================================== */

        if (
            aiAnswerText &&
            results.length
        ) {

            setStatus(
                "Mwaniki AI answer and web research are ready.",
                "success"
            );

        } else if (
            aiAnswerText &&
            !results.length
        ) {

            setStatus(
                "Mwaniki AI answered the question. No web results were returned.",
                "success"
            );

        } else if (
            !aiAnswerText &&
            results.length
        ) {

            setStatus(
                "Mwaniki has no strong internal material for this question. Web research is available on the left.",
                "success"
            );

        } else {

            setStatus(
                "No internal answer or web results were returned.",
                "error"
            );
        }


        if (aiSearchStatus) {

            if (results.length) {

                aiSearchStatus.textContent =
                    `${results.length} web result${results.length === 1 ? "" : "s"} found.`;

            } else {

                aiSearchStatus.textContent =
                    "No web results found.";
            }
        }


    } catch (error) {

        console.error(
            "Mwaniki AI error:",
            error
        );


        /*
         * IMPORTANT:
         *
         * If the Edge Function itself failed,
         * we still explain the problem.
         *
         * We do NOT pretend Google results exist.
         */

        setStatus(
            error?.message ||
            "The AI service could not complete the request.",
            "error"
        );


        if (aiAnswer) {

            aiAnswer.innerHTML = `

                <div class="answer-fallback">

                    <div class="fallback-icon">
                        ⚠️
                    </div>

                    <div>

                        <strong>
                            Mwaniki AI could not complete this request.
                        </strong>

                        <p>
                            Please try the question again.
                        </p>

                    </div>

                </div>

            `;
        }


    } finally {

        if (askAIButton) {

            askAIButton.disabled =
                false;

            askAIButton.innerHTML =
                "<span>🤖</span> Ask Mwaniki AI";
        }

    }
}


/* =========================================================
   CLEAR RESEARCH
========================================================= */

function clearResearchPanels() {

    if (webResults) {

        webResults.innerHTML = `

            <div class="research-placeholder">

                <div class="placeholder-icon">
                    ⏳
                </div>

                <strong>
                    Searching Google...
                </strong>

                <p>
                    Web research is running independently.
                </p>

            </div>

        `;
    }


    if (aiImages) {

        aiImages.innerHTML = `

            <div class="research-placeholder">

                <div class="placeholder-icon">
                    ⏳
                </div>

                <strong>
                    Searching images...
                </strong>

                <p>
                    Visual research is running independently.
                </p>

            </div>

        `;
    }
}


/* =========================================================
   RENDER AI ANSWER
========================================================= */

function renderAnswer(
    question,
    answer
) {

    if (!aiAnswer) {
        return;
    }


    if (answer) {

        aiAnswer.innerHTML = `

            <div class="answer-question">
                ${escapeHTML(question)}
            </div>

            <div class="answer-body">
                ${textToHTML(answer)}
            </div>

        `;

        return;
    }


    /*
     * No internal Mwaniki answer.
     *
     * This is NOT an error.
     *
     * Google is still independently available.
     */

    aiAnswer.innerHTML = `

        <div class="answer-question">
            ${escapeHTML(question)}
        </div>

        <div class="answer-fallback">

            <div class="fallback-icon">
                🌐
            </div>

            <div>

                <strong>
                    Mwaniki AI does not have enough internal material for this question.
                </strong>

                <p>
                    Web research has been performed independently.
                    Review the Google results on the left.
                </p>

            </div>

        </div>

    `;
}


/* =========================================================
   GOOGLE WEB RESULTS
========================================================= */

function renderWebResults(
    results = [],
    googleSearchUrl = ""
) {

    if (!webResults) {
        return;
    }


    webResults.innerHTML =
        "";


    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {

        webResults.innerHTML = `

            <div class="research-empty">

                <div class="research-empty-icon">
                    🔎
                </div>

                <strong>
                    No web results found
                </strong>

                <p>
                    Try another wording or search Google directly.
                </p>

                ${
                    safeURL(googleSearchUrl)
                        ? `
                            <a
                                href="${safeURL(googleSearchUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="google-search-link"
                            >
                                Search Google directly →
                            </a>
                        `
                        : ""
                }

            </div>

        `;

        return;
    }


    results.forEach(
        (result) => {

            if (!result) {
                return;
            }


            const title =
                cleanText(
                    result.title ||
                    result.name ||
                    "Web result"
                );


            const snippet =
                cleanText(
                    result.snippet ||
                    result.description ||
                    ""
                );


            const url =
                result.url ||
                result.link ||
                result.displayUrl ||
                "";


            const safe =
                safeURL(url);


            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "web-result-card";


            card.innerHTML = `

                <div class="web-result-label">
                    GOOGLE SEARCH
                </div>

                <h4>
                    ${escapeHTML(title)}
                </h4>

                ${
                    url
                        ? `
                            <div class="web-result-url">
                                ${escapeHTML(url)}
                            </div>
                        `
                        : ""
                }

                ${
                    snippet
                        ? `
                            <p>
                                ${escapeHTML(snippet)}
                            </p>
                        `
                        : ""
                }

                ${
                    safe
                        ? `
                            <a
                                href="${safe}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="web-result-open"
                            >
                                Open result →
                            </a>
                        `
                        : ""
                }

            `;


            webResults.appendChild(
                card
            );

        }
    );


    const safeGoogle =
        safeURL(
            googleSearchUrl
        );


    if (safeGoogle) {

        const moreLink =
            document.createElement("a");


        moreLink.href =
            safeGoogle;


        moreLink.target =
            "_blank";


        moreLink.rel =
            "noopener noreferrer";


        moreLink.className =
            "google-search-link";


        moreLink.textContent =
            "View more Google results →";


        webResults.appendChild(
            moreLink
        );
    }
}


/* =========================================================
   GOOGLE IMAGES
========================================================= */

function renderImages(
    images = [],
    primaryImage = null,
    googleImagesUrl = ""
) {

    if (!aiImages) {
        return;
    }


    aiImages.innerHTML =
        "";


    const imageList = [];


    if (primaryImage) {

        imageList.push(
            primaryImage
        );
    }


    if (Array.isArray(images)) {

        images.forEach(
            (image) => {

                if (image) {

                    imageList.push(
                        image
                    );
                }

            }
        );
    }


    const uniqueUrls =
        new Set();


    const normalizedImages =
        imageList
            .map(
                (image) => {

                    if (
                        typeof image === "string"
                    ) {

                        return {
                            url: image,
                            title: "Medical image"
                        };
                    }


                    return {

                        url:
                            image.imageUrl ||
                            image.url ||
                            image.thumbnail ||
                            "",

                        title:
                            image.title ||
                            image.name ||
                            "Medical image"
                    };

                }
            )
            .filter(
                (image) => {

                    const url =
                        safeURL(
                            image.url
                        );


                    if (!url) {
                        return false;
                    }


                    if (
                        uniqueUrls.has(url)
                    ) {

                        return false;
                    }


                    uniqueUrls.add(url);

                    image.url =
                        url;

                    return true;
                }
            );


    if (
        normalizedImages.length === 0
    ) {

        aiImages.innerHTML = `

            <div class="research-empty">

                <div class="research-empty-icon">
                    🖼️
                </div>

                <strong>
                    No images found
                </strong>

                <p>
                    Try viewing Google Images directly.
                </p>

                ${
                    safeURL(googleImagesUrl)
                        ? `
                            <a
                                href="${safeURL(googleImagesUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="google-search-link"
                            >
                                View Google Images →
                            </a>
                        `
                        : ""
                }

            </div>

        `;

        return;
    }


    normalizedImages
        .slice(0, 12)
        .forEach(
            (image) => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "image-result-card";


                card.innerHTML = `

                    <a
                        href="${image.url}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >

                        <img
                            src="${image.url}"
                            alt="${escapeHTML(image.title)}"
                            loading="lazy"
                        >

                    </a>

                    <div class="image-result-title">
                        ${escapeHTML(image.title)}
                    </div>

                `;


                aiImages.appendChild(
                    card
                );

            }
        );


    const safeGoogle =
        safeURL(
            googleImagesUrl
        );


    if (safeGoogle) {

        const moreLink =
            document.createElement("a");


        moreLink.href =
            safeGoogle;


        moreLink.target =
            "_blank";


        moreLink.rel =
            "noopener noreferrer";


        moreLink.className =
            "google-search-link";


        moreLink.textContent =
            "View more Google Images →";


        aiImages.appendChild(
            moreLink
        );
    }
}


/* =========================================================
   READ ANSWER
========================================================= */

if (readAnswerButton) {

    readAnswerButton.addEventListener(
        "click",
        () => {

            if (!currentAnswerText) {

                speakText(
                    "There is no Mwaniki AI answer to read. Please review the web research results."
                );

                return;
            }


            speakText(
                currentAnswerText
            );

        }
    );
}


/* =========================================================
   STOP AUDIO
========================================================= */

if (stopAudioButton) {

    stopAudioButton.addEventListener(
        "click",
        stopSpeech
    );
}


/* =========================================================
   SPEECH
========================================================= */

function speakText(text) {

    if (
        !("speechSynthesis" in window)
    ) {

        return;
    }


    stopSpeech();


    const cleaned =
        cleanText(text);


    if (!cleaned) {
        return;
    }


    speechQueue =
        splitSpeech(
            cleaned
        );


    speechIndex =
        0;

    speechStopped =
        false;


    speakNextChunk();
}


function splitSpeech(text) {

    const sentences =
        text.match(
            /[^.!?]+[.!?]+/g
        );


    if (
        !sentences ||
        !sentences.length
    ) {

        return [
            text
        ];
    }


    return sentences;
}


function speakNextChunk() {

    if (
        speechStopped ||
        speechIndex >= speechQueue.length
    ) {

        return;
    }


    const utterance =
        new SpeechSynthesisUtterance(
            speechQueue[
                speechIndex
            ]
        );


    utterance.rate =
        0.98;


    utterance.pitch =
        1.0;


    utterance.volume =
        1;


    utterance.onend =
        () => {

            if (speechStopped) {
                return;
            }

            speechIndex++;

            speakNextChunk();
        };


    window.speechSynthesis.speak(
        utterance
    );
}


function stopSpeech() {

    speechStopped =
        true;

    speechQueue =
        [];

    speechIndex =
        0;


    if (
        "speechSynthesis" in window
    ) {

        window.speechSynthesis.cancel();
    }
}


/* =========================================================
   TEST ME
========================================================= */

if (testMeButton) {

    testMeButton.addEventListener(
        "click",
        startTest
    );
}


async function startTest() {

    const topic =
        cleanText(
            aiQuestion?.value ||
            currentQuestion
        );


    if (!topic) {

        setStatus(
            "Ask a question first, then start Test Me.",
            "error"
        );

        return;
    }


    currentTestTopic =
        topic;

    currentTestNumber =
        0;

    currentTestScore =
        0;

    currentTestUsedIds =
        [];

    currentTestAnswered =
        false;

    currentTestCorrectKey =
        "";


    if (testPanel) {

        testPanel.hidden =
            false;

        testPanel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }


    await loadNextTestQuestion();
}


/* =========================================================
   LOAD NEXT TEST QUESTION
========================================================= */

async function loadNextTestQuestion() {

    currentTestNumber++;

    currentTestAnswered =
        false;

    currentTestCorrectKey =
        "";


    if (
        currentTestNumber >
        currentTestLength
    ) {

        finishTest();

        return;
    }


    updateTestProgress();


    if (testQuestion) {

        testQuestion.textContent =
            "Generating your question...";
    }


    if (testOptions) {

        testOptions.innerHTML =
            "";
    }


    if (testFeedback) {

        testFeedback.innerHTML =
            "";
    }


    if (testNext) {

        testNext.disabled =
            true;
    }


    if (testStatus) {

        testStatus.textContent =
            "Preparing a medical question...";
    }


    try {

        const {
            data: {
                session
            } = {}
        } =
            await supabase.auth.getSession();


        if (!session) {

            throw new Error(
                "Please log in before starting a test."
            );
        }


        const response =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {

                        mode: "test",

                        testTopic:
                            currentTestTopic,

                        usedQuestionIds:
                            currentTestUsedIds,

                        questionNumber:
                            currentTestNumber,

                        testLength:
                            currentTestLength,

                        /*
                         * Test retrieval can use both
                         * internal material and web research.
                         */

                        searchMwaniki:
                            true,

                        searchWeb:
                            true,

                        searchImages:
                            false
                    }
                }
            );


        if (response.error) {

            throw response.error;
        }


        const data =
            response.data || {};


        const question =
            data.testQuestion ||
            data.question ||
            null;


        if (!question) {

            throw new Error(
                "A suitable test question could not be created."
            );
        }


        renderTestQuestion(
            question
        );


    } catch (error) {

        console.error(
            "Test question error:",
            error
        );


        if (testQuestion) {

            testQuestion.textContent =
                "Unable to create this test question.";
        }


        if (testStatus) {

            testStatus.textContent =
                error?.message ||
                "Please try again.";
        }

        if (testNext) {

            testNext.disabled =
                true;
        }

    }
}


/* =========================================================
   RENDER TEST QUESTION
========================================================= */

function renderTestQuestion(
    question
) {

    const questionText =
        cleanText(
            question.question ||
            question.text ||
            ""
        );


    const options =
        Array.isArray(
            question.options
        )
            ? question.options
            : [];


    if (
        !questionText ||
        options.length < 4
    ) {

        throw new Error(
            "The test question was incomplete."
        );
    }


    currentTestCorrectKey =
        normalizeCorrectKey(
            question
        );


    if (question.id != null) {

        currentTestUsedIds.push(
            String(question.id)
        );
    }


    if (testQuestion) {

        testQuestion.textContent =
            questionText;
    }


    if (testStatus) {

        testStatus.textContent =
            "";
    }


    if (!testOptions) {
        return;
    }


    testOptions.innerHTML =
        "";


    const letters =
        [
            "A",
            "B",
            "C",
            "D"
        ];


    options
        .slice(0, 4)
        .forEach(
            (option, index) => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "test-option";


                button.dataset.key =
                    letters[index];


                button.innerHTML = `

                    <span class="option-letter">
                        ${letters[index]}
                    </span>

                    <span>
                        ${escapeHTML(
                            typeof option === "string"
                                ? option
                                : (
                                    option.label ||
                                    option.text ||
                                    ""
                                )
                        )}
                    </span>

                `;


                button.addEventListener(
                    "click",
                    () => {

                        handleTestAnswer(
                            button,
                            letters[index],
                            options,
                            question
                        );

                    }
                );


                testOptions.appendChild(
                    button
                );

            }
        );
}


/* =========================================================
   CORRECT ANSWER NORMALIZATION
========================================================= */

function normalizeCorrectKey(
    question
) {

    const raw =
        String(
            question.correctKey ||
            question.correct_answer ||
            question.correctAnswer ||
            ""
        )
            .trim();


    const upper =
        raw.toUpperCase();


    if (
        [
            "A",
            "B",
            "C",
            "D"
        ].includes(upper)
    ) {

        return upper;
    }


    const options =
        Array.isArray(
            question.options
        )
            ? question.options
            : [];


    const normalizedRaw =
        cleanText(
            raw
        ).toLowerCase();


    const index =
        options.findIndex(
            (option) => {

                const text =
                    typeof option === "string"
                        ? option
                        : (
                            option.label ||
                            option.text ||
                            ""
                        );

                return (
                    cleanText(
                        text
                    ).toLowerCase()
                    === normalizedRaw
                );
            }
        );


    if (
        index >= 0 &&
        index < 4
    ) {

        return [
            "A",
            "B",
            "C",
            "D"
        ][index];
    }


    return "";
}


/* =========================================================
   HANDLE TEST ANSWER
========================================================= */

function handleTestAnswer(
    selectedButton,
    selectedKey,
    options,
    question
) {

    if (currentTestAnswered) {
        return;
    }


    currentTestAnswered =
        true;


    const buttons =
        testOptions?.querySelectorAll(
            ".test-option"
        ) || [];


    buttons.forEach(
        (button) => {

            button.disabled =
                true;

        }
    );


    const correctKey =
        currentTestCorrectKey;


    const correctIndex =
        [
            "A",
            "B",
            "C",
            "D"
        ].indexOf(
            correctKey
        );


    const correctOption =
        correctIndex >= 0
            ? options[correctIndex]
            : null;


    const correctText =
        typeof correctOption === "string"
            ? correctOption
            : (
                correctOption?.label ||
                correctOption?.text ||
                question.correctAnswer ||
                ""
            );


    if (
        correctKey &&
        selectedKey === correctKey
    ) {

        currentTestScore++;


        selectedButton.classList.add(
            "correct"
        );


        markCorrectOption(
            correctKey
        );


        showCorrectFeedback(
            question,
            correctText
        );


        playCorrectReaction();


    } else {

        selectedButton.classList.add(
            "wrong"
        );


        markCorrectOption(
            correctKey
        );


        showWrongFeedback(
            question,
            correctText
        );


        playWrongReaction();

    }


    if (testNext) {

        testNext.disabled =
            false;
    }


    updateTestProgress();
}


/* =========================================================
   MARK CORRECT OPTION
========================================================= */

function markCorrectOption(
    correctKey
) {

    if (!correctKey) {
        return;
    }


    const correctButton =
        testOptions?.querySelector(
            `[data-key="${correctKey}"]`
        );


    if (correctButton) {

        correctButton.classList.add(
            "correct"
        );
    }
}


/* =========================================================
   FEEDBACK
========================================================= */

function showCorrectFeedback(
    question,
    correctText
) {

    if (!testFeedback) {
        return;
    }


    const explanation =
        cleanText(
            question.explanation ||
            question.feedback ||
            ""
        );


    testFeedback.className =
        "test-feedback feedback-correct";


    testFeedback.innerHTML = `

        <strong>
            🎉 Correct!
        </strong>

        <div>
            ${escapeHTML(
                explanation ||
                `The correct answer is ${correctText}.`
            )}
        </div>

    `;
}


function showWrongFeedback(
    question,
    correctText
) {

    if (!testFeedback) {
        return;
    }


    const explanation =
        cleanText(
            question.explanation ||
            question.feedback ||
            ""
        );


    testFeedback.className =
        "test-feedback feedback-wrong";


    testFeedback.innerHTML = `

        <strong>
            😅 Not quite!
        </strong>

        <div>
            ${
                explanation
                    ? escapeHTML(
                        explanation
                    )
                    : `
                        The correct answer is
                        ${escapeHTML(correctText)}.
                    `
            }
        </div>

    `;
}


/* =========================================================
   TEST PROGRESS
========================================================= */

function updateTestProgress() {

    if (!testProgress) {
        return;
    }


    const displayNumber =
        Math.min(
            currentTestNumber,
            currentTestLength
        );


    testProgress.textContent =
        `Question ${displayNumber} of ${currentTestLength} • Score ${currentTestScore}`;
}


/* =========================================================
   NEXT QUESTION
========================================================= */

if (testNext) {

    testNext.addEventListener(
        "click",
        () => {

            loadNextTestQuestion();

        }
    );
}


/* =========================================================
   EXIT TEST
========================================================= */

if (testExit) {

    testExit.addEventListener(
        "click",
        exitTest
    );
}


function exitTest() {

    if (testPanel) {

        testPanel.hidden =
            true;
    }


    currentTestNumber =
        0;

    currentTestScore =
        0;

    currentTestUsedIds =
        [];

    currentTestAnswered =
        false;

    currentTestCorrectKey =
        "";


    if (testFeedback) {

        testFeedback.innerHTML =
            "";
    }


    if (testOptions) {

        testOptions.innerHTML =
            "";
    }
}


/* =========================================================
   FINISH TEST
========================================================= */

function finishTest() {

    const percentage =
        Math.round(
            (
                currentTestScore /
                currentTestLength
            ) * 100
        );


    if (testQuestion) {

        testQuestion.innerHTML = `

            <strong>
                Test Complete
            </strong>

            <br><br>

            You scored
            ${currentTestScore}
            /
            ${currentTestLength}

            (${percentage}%).

        `;
    }


    if (testOptions) {

        testOptions.innerHTML =
            "";
    }


    if (testFeedback) {

        testFeedback.className =
            "test-feedback feedback-correct";


        testFeedback.innerHTML = `

            <strong>
                🏆 Test finished!
            </strong>

            <div>
                Keep studying and try another test
                to improve your score.
            </div>

        `;
    }


    if (testNext) {

        testNext.disabled =
            true;
    }


    if (testStatus) {

        testStatus.textContent =
            "";
    }


    currentTestNumber =
        currentTestLength;
}


/* =========================================================
   CARTOON CORRECT REACTION
========================================================= */

function playCorrectReaction() {

    if (
        !("speechSynthesis" in window)
    ) {

        return;
    }


    const phrases = [
        "Yes! That's it!",
        "Excellent!",
        "Brilliant!",
        "You got it!",
        "Fantastic answer!"
    ];


    const phrase =
        phrases[
            Math.floor(
                Math.random() *
                phrases.length
            )
        ];


    const utterance =
        new SpeechSynthesisUtterance(
            phrase
        );


    utterance.rate =
        1.25;


    utterance.pitch =
        1.55;


    utterance.volume =
        0.85;


    window.speechSynthesis.speak(
        utterance
    );
}


/* =========================================================
   CARTOON WRONG REACTION
========================================================= */

function playWrongReaction() {

    if (
        !("speechSynthesis" in window)
    ) {

        return;
    }


    const phrases = [
        "Ooooh! Not quite!",
        "Whoops! Try again!",
        "Almost there!",
        "Aha! That's not it!",
        "Nice try!"
    ];


    const phrase =
        phrases[
            Math.floor(
                Math.random() *
                phrases.length
            )
        ];


    const utterance =
        new SpeechSynthesisUtterance(
            phrase
        );


    utterance.rate =
        1.4;


    utterance.pitch =
        1.8;


    utterance.volume =
        0.9;


    window.speechSynthesis.speak(
        utterance
    );
}


/* =========================================================
   ASK BUTTON
========================================================= */

if (askAIButton) {

    askAIButton.addEventListener(
        "click",
        searchAI
    );
}


/* =========================================================
   GLOBAL API
========================================================= */

window.mwanikiAI = {

    search:
        searchAI,

    startTest:
        startTest,

    speak:
        () => {

            if (currentAnswerText) {

                speakText(
                    currentAnswerText
                );
            }

        },

    stopSpeech:
        stopSpeech

};


/* =========================================================
   INITIAL STATE
========================================================= */

console.log(
    "🚀 Mwaniki AI Tutor loaded."
);


console.log(
    "🌐 Google Search: independent"
);


console.log(
    "🖼️ Google Images: independent"
);


console.log(
    "🧠 Mwaniki internal retrieval: independent"
);
```
