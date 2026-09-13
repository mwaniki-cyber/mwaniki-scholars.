
import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS
// AI TUTOR FRONTEND
// ============================================================

console.log("🚀 Mwaniki AI Tutor loaded");


// ============================================================
// DOM
// ============================================================

const aiQuestion = document.getElementById("aiQuestion");
const askAIButton = document.getElementById("askAIButton");

const aiSearchStatus = document.getElementById("aiSearchStatus");
const aiStatus = document.getElementById("aiStatus");

const aiAnswer = document.getElementById("aiAnswer");
const mwanikiResultCount =
    document.getElementById("mwanikiResultCount");

const mwanikiSources =
    document.getElementById("mwanikiSources");

const aiImages =
    document.getElementById("aiImages");

const webResults =
    document.getElementById("webResults");

const webResultCount =
    document.getElementById("webResultCount");

const readMainAnswerButton =
    document.getElementById("readMainAnswerButton");

const stopMainAudioButton =
    document.getElementById("stopMainAudioButton");

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

const readAnswerButton =
    document.getElementById("readAnswerButton");

const stopAudioButton =
    document.getElementById("stopAudioButton");

const testTopic =
    document.getElementById("testTopic");

const testLength =
    document.getElementById("testLength");

const startTestButton =
    document.getElementById("startTestButton");


// ============================================================
// STATE
// ============================================================

let currentAnswerText = "";

let currentTestTopic = "";

let currentTestQuestion = null;

let currentTestNumber = 0;

let currentTestLength = 10;

let currentTestScore = 0;

let currentTestUsedIds = [];

let testAnswered = false;

let lastSearchResponse = null;


// ============================================================
// TEXT CLEANING
// ============================================================

function cleanDisplayText(value) {

    if (value === null || value === undefined) {
        return "";
    }

    let text = String(value);

    text = text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

    return text;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function safeURL(value) {

    const url = String(value ?? "").trim();

    if (!url) {
        return "";
    }

    try {

        const parsed = new URL(url);

        if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        ) {
            return parsed.href;
        }

    } catch {
        return "";
    }

    return "";
}


function truncate(value, max = 400) {

    const text = cleanDisplayText(value);

    if (text.length <= max) {
        return text;
    }

    return text.slice(0, max).trim() + "...";
}


// ============================================================
// SPEECH
// ============================================================

function stopSpeech() {

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

}


function speak(text, options = {}) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    stopSpeech();

    const utterance =
        new SpeechSynthesisUtterance(
            cleanDisplayText(text)
        );

    utterance.rate =
        options.rate ?? 0.95;

    utterance.pitch =
        options.pitch ?? 1;

    utterance.volume = 1;

    utterance.lang = "en-US";

    window.speechSynthesis.speak(
        utterance
    );

}


function speakFunnyReaction(text) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    stopSpeech();

    const utterance =
        new SpeechSynthesisUtterance(
            cleanDisplayText(text)
        );

    utterance.rate = 1.25;
    utterance.pitch = 1.8;
    utterance.volume = 1;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(
        utterance
    );

}


// ============================================================
// FUNNY WRONG-ANSWER REACTIONS
// ============================================================

const funnyWrongAnswerReactions = [

    "Oops! That answer took a wrong turn.",

    "Oof! That one missed the mark.",

    "Whoops! The neurons disagreed with that one.",

    "Aha! Nice attempt, but not quite.",

    "Plot twist! That wasn't the answer.",

    "The brain says: try again!",

    "That answer just wandered off the syllabus.",

    "Close! But the textbook isn't celebrating yet.",

    "Oops! That one needs a little resuscitation.",

    "Not quite! The correct answer is hiding nearby.",

    "The neurons have filed an objection.",

    "Almost! Your answer took the scenic route.",

    "That one needs another trip through the lecture notes.",

    "The exam gods are not convinced.",

    "Interesting choice! Let's fix that one.",

    "The medical detective in you needs one more clue.",

    "That answer needs a tiny dose of revision.",

    "Nearly there! Your reasoning is warming up.",

    "The cortex has requested a second attempt.",

    "Close call! Let's see why."

];

let funnyReactionPool =
    [...funnyWrongAnswerReactions];


function getRandomFunnyReaction() {

    if (!funnyReactionPool.length) {
        funnyReactionPool =
            [...funnyWrongAnswerReactions];
    }

    const index =
        Math.floor(
            Math.random() *
            funnyReactionPool.length
        );

    return funnyReactionPool.splice(
        index,
        1
    )[0];

}


// ============================================================
// STATUS
// ============================================================

function setStatus(message, type = "") {

    if (!aiStatus) {
        return;
    }

    aiStatus.textContent =
        cleanDisplayText(message);

    aiStatus.className =
        type
            ? `ai-status ${type}`
            : "ai-status";

}


function setSearchStatus(message) {

    if (!aiSearchStatus) {
        return;
    }

    aiSearchStatus.textContent =
        cleanDisplayText(message);

}


function setBusy(isBusy) {

    if (!askAIButton) {
        return;
    }

    askAIButton.disabled =
        Boolean(isBusy);

    askAIButton.textContent =
        isBusy
            ? "🔎 Searching..."
            : "🤖 Ask AI Tutor";

}


// ============================================================
// AUTHENTICATION
// ============================================================

async function getAccessToken() {

    const {
        data,
        error
    } =
        await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    const token =
        data?.session?.access_token;

    if (!token) {
        throw new Error(
            "Your student session has expired. Please log in again."
        );
    }

    return token;

}


// ============================================================
// EDGE FUNCTION
// ============================================================

async function invokeMwanikiAI(body) {

    const token =
        await getAccessToken();

    const {
        data,
        error
    } =
        await supabase.functions.invoke(
            "mwaniki-ai",
            {
                body,

                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    if (error) {

        let message =
            error.message ||
            "Mwaniki AI request failed.";

        if (
            error.context &&
            typeof error.context.json === "function"
        ) {

            try {

                const details =
                    await error.context.json();

                if (details?.error) {
                    message =
                        details.error;
                }

            } catch {
                // Ignore malformed error body.
            }

        }

        throw new Error(message);

    }

    if (!data) {
        throw new Error(
            "Mwaniki AI returned an empty response."
        );
    }

    if (data.success === false) {
        throw new Error(
            data.error ||
            "Mwaniki AI could not complete the request."
        );
    }

    return data;

}


// ============================================================
// ANSWER EXTRACTION
// ============================================================

function getAnswerParts(answer) {

    if (!answer) {
        return {
            title: "",
            paragraphs: [],
            keyPoints: []
        };
    }

    if (typeof answer === "string") {

        return {
            title: "Medical Answer",
            paragraphs: [
                cleanDisplayText(answer)
            ],
            keyPoints: []
        };

    }

    return {

        title:
            cleanDisplayText(
                answer.title ||
                "Medical Answer"
            ),

        paragraphs:
            Array.isArray(answer.paragraphs)
                ? answer.paragraphs
                    .map(cleanDisplayText)
                    .filter(Boolean)
                : [],

        keyPoints:
            Array.isArray(answer.keyPoints)
                ? answer.keyPoints
                    .map(cleanDisplayText)
                    .filter(Boolean)
                : []

    };

}


// ============================================================
// RENDER ANSWER
// ============================================================

function renderAnswer(answer) {

    if (!aiAnswer) {
        return;
    }

    const parts =
        getAnswerParts(answer);

    currentAnswerText =
        [
            parts.title,
            ...parts.paragraphs,
            ...parts.keyPoints
        ]
            .filter(Boolean)
            .join(". ");

    let html = "";

    html += `
        <div class="answer-source-badge">
            Medical Answer
        </div>
    `;

    if (parts.title) {

        html += `
            <h3>
                ${escapeHTML(parts.title)}
            </h3>
        `;

    }

    for (
        const paragraph of parts.paragraphs
    ) {

        html += `
            <p>
                ${escapeHTML(paragraph)}
            </p>
        `;

    }

    if (parts.keyPoints.length) {

        html += `
            <div class="answer-key-points">
                <h4>Key Points</h4>
                <ul>
        `;

        for (
            const point of parts.keyPoints
        ) {

            html += `
                <li>
                    ${escapeHTML(point)}
                </li>
            `;

        }

        html += `
                </ul>
            </div>
        `;

    }

    if (currentTestTopic) {

        html += `
            <div class="answer-test-action">
                <button
                    type="button"
                    class="primary-button inline-test-button"
                    id="inlineTestButton"
                >
                    🧠 Test Me On This Topic
                </button>
            </div>
        `;

    }

    aiAnswer.innerHTML =
        html ||
        `
            <div class="empty-state">
                No direct medical answer was returned.
            </div>
        `;


    const inlineTestButton =
        document.getElementById(
            "inlineTestButton"
        );

    if (inlineTestButton) {

        inlineTestButton.addEventListener(
            "click",
            () => {

                if (testTopic) {
                    testTopic.value =
                        currentTestTopic;
                }

                startTest();

            }
        );

    }

}


// ============================================================
// SOURCE CARDS
// ============================================================

function renderMwanikiSources(
    sources
) {

    if (!mwanikiSources) {
        return;
    }

    if (
        !Array.isArray(sources) ||
        !sources.length
    ) {

        mwanikiSources.innerHTML = `
            <div class="empty-state">
                No directly relevant Mwaniki source was found.
            </div>
        `;

        return;

    }


    mwanikiSources.innerHTML =
        sources
            .map(
                (source) => {

                    const title =
                        cleanDisplayText(
                            source.title ||
                            source.name ||
                            "Mwaniki source"
                        );

                    const course =
                        cleanDisplayText(
                            source.course
                        );

                    const unit =
                        cleanDisplayText(
                            source.unit
                        );

                    const description =
                        truncate(
                            source.description ||
                            source.snippet ||
                            source.text ||
                            "",
                            320
                        );

                    const url =
                        safeURL(
                            source.url ||
                            source.file_url
                        );

                    return `
                        <article class="source-card">

                            <div class="source-card-type">
                                ${escapeHTML(
                                    cleanDisplayText(
                                        source.type ||
                                        "Mwaniki"
                                    )
                                )}
                            </div>

                            <h4>
                                ${escapeHTML(title)}
                            </h4>

                            ${
                                course || unit
                                    ? `
                                        <div class="source-meta">
                                            ${
                                                course
                                                    ? escapeHTML(course)
                                                    : ""
                                            }
                                            ${
                                                course && unit
                                                    ? " • "
                                                    : ""
                                            }
                                            ${
                                                unit
                                                    ? escapeHTML(unit)
                                                    : ""
                                            }
                                        </div>
                                    `
                                    : ""
                            }

                            ${
                                description
                                    ? `
                                        <p>
                                            ${escapeHTML(
                                                description
                                            )}
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                url
                                    ? `
                                        <a
                                            href="${escapeHTML(url)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Open source
                                        </a>
                                    `
                                    : ""
                            }

                        </article>
                    `;

                }
            )
            .join("");

}


// ============================================================
// WEB RESULTS
// ============================================================

function renderWebResults(
    webAnswer,
    results,
    googleURL
) {

    if (!webResults) {
        return;
    }

    const answerParts =
        getAnswerParts(webAnswer);

    let html = "";

    if (
        answerParts.paragraphs.length
    ) {

        html += `
            <div class="web-direct-answer">

                <div class="answer-source-badge">
                    Web Evidence
                </div>

                <h3>
                    ${escapeHTML(
                        answerParts.title ||
                        "Web Answer"
                    )}
                </h3>
        `;

        for (
            const paragraph of
            answerParts.paragraphs
        ) {

            html += `
                <p>
                    ${escapeHTML(paragraph)}
                </p>
            `;

        }

        html += `
            </div>
        `;

    }


    if (
        Array.isArray(results) &&
        results.length
    ) {

        html += `
            <div class="web-result-list">
        `;

        for (
            const result of results
        ) {

            const title =
                cleanDisplayText(
                    result.title ||
                    "Web result"
                );

            const snippet =
                cleanDisplayText(
                    result.snippet ||
                    result.description ||
                    ""
                );

            const url =
                safeURL(
                    result.url ||
                    result.link
                );

            html += `
                <article class="web-result-card">

                    <h4>
                        ${escapeHTML(title)}
                    </h4>

                    ${
                        snippet
                            ? `
                                <p>
                                    ${escapeHTML(
                                        truncate(
                                            snippet,
                                            500
                                        )
                                    )}
                                </p>
                            `
                            : ""
                    }

                    ${
                        url
                            ? `
                                <a
                                    href="${escapeHTML(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open source
                                </a>
                            `
                            : ""
                    }

                </article>
            `;

        }

        html += `
            </div>
        `;

    }


    if (googleURL) {

        const url =
            safeURL(googleURL);

        if (url) {

            html += `
                <div class="google-search-link">
                    <a
                        href="${escapeHTML(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🔎 Open Google Search
                    </a>
                </div>
            `;

        }

    }


    webResults.innerHTML =
        html ||
        `
            <div class="empty-state">
                No web results were returned.
            </div>
        `;

}


// ============================================================
// IMAGE RESULTS
// ============================================================

function renderImages(
    images,
    googleImageURL
) {

    if (!aiImages) {
        return;
    }

    let html = "";

    if (
        Array.isArray(images) &&
        images.length
    ) {

        html += `
            <div class="image-grid">
        `;

        for (
            const image of images
        ) {

            const imageURL =
                safeURL(
                    image.imageUrl ||
                    image.contentUrl ||
                    image.thumbnailUrl ||
                    image.src
                );

            if (!imageURL) {
                continue;
            }

            const pageURL =
                safeURL(
                    image.url ||
                    image.pageUrl ||
                    ""
                );

            const title =
                cleanDisplayText(
                    image.title ||
                    "Medical visual"
                );

            html += `
                <figure class="ai-image-card">

                    <img
                        src="${escapeHTML(imageURL)}"
                        alt="${escapeHTML(title)}"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                    >

                    <figcaption>
                        ${escapeHTML(title)}
                    </figcaption>

                    ${
                        pageURL
                            ? `
                                <a
                                    href="${escapeHTML(pageURL)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View source
                                </a>
                            `
                            : ""
                    }

                </figure>
            `;

        }

        html += `
            </div>
        `;

    }


    const googleURL =
        safeURL(googleImageURL);

    if (googleURL) {

        html += `
            <div class="google-search-link">
                <a
                    href="${escapeHTML(googleURL)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    🖼️ Open Google Images
                </a>
            </div>
        `;

    }


    aiImages.innerHTML =
        html ||
        `
            <div class="empty-state">
                No direct images are currently available.
            </div>
        `;

}


// ============================================================
// SEARCH
// ============================================================

async function performSearch(
    question
) {

    const query =
        cleanDisplayText(question);

    if (!query) {
        return;
    }

    setBusy(true);

    setStatus("");

    setSearchStatus(
        "Searching the web for current medical evidence..."
    );

    if (aiAnswer) {
        aiAnswer.innerHTML = `
            <div class="loading-state">
                Searching reliable web sources first...
            </div>
        `;
    }

    try {

        const result =
            await invokeMwanikiAI({

                mode: "search",

                question: query,

                searchWeb: true,

                searchMwaniki: true,

                searchImages: true

            });


        lastSearchResponse =
            result;


        const answer =
            result.answer ||
            result.webAnswer;


        currentTestTopic =
            cleanDisplayText(
                answer?.title ||
                result.question ||
                query
            );


        if (testTopic) {
            testTopic.value =
                currentTestTopic;
        }


        if (
            mwanikiResultCount
        ) {

            mwanikiResultCount.textContent =
                `${Number(
                    result.counts?.mwaniki || 0
                )} sources`;

        }


        if (
            webResultCount
        ) {

            webResultCount.textContent =
                `${Number(
                    result.counts?.web || 0
                )} results`;

        }


        renderAnswer(answer);

        renderMwanikiSources(
            result.mwanikiSources || []
        );

        renderWebResults(
            result.webAnswer,
            result.webResults || [],
            result.googleSearchUrl
        );

        renderImages(
            result.images || [],
            result.googleImageSearchUrl
        );


        const webCount =
            Number(
                result.counts?.web || 0
            );

        const mwanikiCount =
            Number(
                result.counts?.mwaniki || 0
            );


        if (
            webCount &&
            mwanikiCount
        ) {

            setSearchStatus(
                "Web evidence checked first, then compared with Mwaniki Scholars material."
            );

        } else if (webCount) {

            setSearchStatus(
                "Web evidence found. Mwaniki material was also checked."
            );

        } else if (mwanikiCount) {

            setSearchStatus(
                "No configured web results were returned, so relevant Mwaniki material is shown."
            );

        } else {

            setSearchStatus(
                "No sufficiently relevant source was found."
            );

        }


        setStatus(
            "Medical research completed.",
            "success"
        );


        localStorage.setItem(
            "mwanikiAIQuestions",
            JSON.stringify([
                {
                    question: query,
                    createdAt:
                        new Date().toISOString()
                }
            ])
        );


    } catch (error) {

        console.error(
            "Mwaniki AI search error:",
            error
        );

        setSearchStatus(
            "The medical search could not be completed."
        );

        setStatus(
            error?.message ||
            "Something went wrong while searching.",
            "error"
        );

        if (aiAnswer) {

            aiAnswer.innerHTML = `
                <div class="empty-state error-state">
                    ${escapeHTML(
                        error?.message ||
                        "Unable to complete the search."
                    )}
                </div>
            `;

        }

    } finally {

        setBusy(false);

    }

}


// ============================================================
// TEST
// ============================================================

function resetTest() {

    currentTestQuestion = null;

    currentTestNumber = 0;

    currentTestScore = 0;

    currentTestUsedIds = [];

    testAnswered = false;

}


async function startTest() {

    const topic =
        cleanDisplayText(
            testTopic?.value ||
            currentTestTopic ||
            aiQuestion?.value ||
            ""
        );

    if (!topic) {

        setStatus(
            "Enter a topic before starting the test.",
            "error"
        );

        return;

    }


    currentTestTopic = topic;

    currentTestLength =
        Math.max(
            1,
            Number(
                testLength?.value || 10
            )
        );


    resetTest();


    if (testTopic) {
        testTopic.value = topic;
    }


    if (testPanel) {
        testPanel.hidden = false;
    }


    await loadNextTestQuestion();

}


async function loadNextTestQuestion() {

    testAnswered = false;


    if (
        currentTestNumber >=
        currentTestLength
    ) {

        finishTest();

        return;

    }


    if (testQuestion) {

        testQuestion.innerHTML = `
            <div class="loading-state">
                Preparing your next medical question...
            </div>
        `;

    }


    if (testOptions) {
        testOptions.innerHTML = "";
    }

    if (testFeedback) {
        testFeedback.innerHTML = "";
    }


    if (testNext) {
        testNext.style.display =
            "none";
    }


    if (testProgress) {

        testProgress.textContent =
            `Question ${
                currentTestNumber + 1
            } of ${
                currentTestLength
            }`;

    }


    try {

        const result =
            await invokeMwanikiAI({

                mode: "test",

                testTopic:
                    currentTestTopic,

                usedQuestionIds:
                    currentTestUsedIds,

                questionNumber:
                    currentTestNumber + 1,

                testLength:
                    currentTestLength,

                searchMwaniki:
                    true,

                searchWeb:
                    true

            });


        const question =
            result.testQuestion;


        if (!question) {

            if (testQuestion) {

                testQuestion.innerHTML = `
                    <div class="empty-state">
                        Mwaniki AI could not generate another unique question for this topic.
                    </div>
                `;

            }

            if (testStatus) {

                testStatus.textContent =
                    "The available evidence has been exhausted for this topic.";

            }

            if (testNext) {
                testNext.style.display =
                    "none";
            }

            return;

        }


        currentTestQuestion =
            question;

        currentTestNumber++;

        currentTestUsedIds.push(
            String(question.id)
        );


        renderTestQuestion(
            question
        );


    } catch (error) {

        console.error(
            "Test question error:",
            error
        );

        if (testQuestion) {

            testQuestion.innerHTML = `
                <div class="empty-state error-state">
                    ${escapeHTML(
                        error?.message ||
                        "Unable to generate the question."
                    )}
                </div>
            `;

        }

    }

}


// ============================================================
// RENDER TEST QUESTION
// ============================================================

function renderTestQuestion(
    question
) {

    if (!testQuestion || !testOptions) {
        return;
    }


    const questionText =
        cleanDisplayText(
            question.question
        );


    testQuestion.innerHTML = `
        <h3>
            ${escapeHTML(questionText)}
        </h3>
    `;


    testOptions.innerHTML =
        (question.options || [])
            .map(
                (option) => `
                    <button
                        type="button"
                        class="quiz-option"
                        data-option-key="${escapeHTML(
                            option.key
                        )}"
                    >
                        <span class="quiz-option-key">
                            ${escapeHTML(
                                option.key
                            )}
                        </span>

                        <span>
                            ${escapeHTML(
                                cleanDisplayText(
                                    option.text
                                )
                            )}
                        </span>
                    </button>
                `
            )
            .join("");


    testOptions
        .querySelectorAll(
            ".quiz-option"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        answerTestQuestion(
                            button.dataset.optionKey
                        );

                    }
                );

            }
        );


    if (testStatus) {

        testStatus.textContent =
            question.sourceType === "web"
                ? "Question generated from researched web evidence."
                : question.sourceType === "quiz"
                    ? "Question selected from the Mwaniki Scholars quiz bank."
                    : "Question generated from relevant medical study material.";

    }

}


// ============================================================
// ANSWER TEST QUESTION
// ============================================================

function answerTestQuestion(
    selectedKey
) {

    if (
        testAnswered ||
        !currentTestQuestion
    ) {
        return;
    }


    testAnswered = true;


    const correctKey =
        String(
            currentTestQuestion.correctKey
        );


    const isCorrect =
        selectedKey === correctKey;


    const optionButtons =
        testOptions
            ? testOptions.querySelectorAll(
                ".quiz-option"
            )
            : [];


    optionButtons.forEach(
        (button) => {

            const key =
                button.dataset.optionKey;

            button.disabled = true;

            if (key === correctKey) {

                button.classList.add(
                    "correct"
                );

            }

            if (
                key === selectedKey &&
                !isCorrect
            ) {

                button.classList.add(
                    "wrong"
                );

            }

        }
    );


    if (isCorrect) {

        currentTestScore++;


        if (testFeedback) {

            testFeedback.innerHTML = `
                <div class="quiz-feedback correct-feedback">

                    <strong>
                        Correct!
                    </strong>

                    <p>
                        ${escapeHTML(
                            cleanDisplayText(
                                currentTestQuestion.explanation ||
                                "That answer matches the verified source material."
                            )
                        )}
                    </p>

                </div>
            `;

        }

        speak(
            `Correct. ${
                cleanDisplayText(
                    currentTestQuestion.explanation || ""
                )
            }`
        );


    } else {

        const reaction =
            getRandomFunnyReaction();


        if (testFeedback) {

            testFeedback.innerHTML = `
                <div class="quiz-feedback wrong-feedback">

                    <strong>
                        Review this one.
                    </strong>

                    <p>
                        The correct answer is
                        <strong>
                            ${escapeHTML(
                                cleanDisplayText(
                                    currentTestQuestion.correctAnswer
                                )
                            )}
                        </strong>.
                    </p>

                    <p>
                        ${escapeHTML(
                            cleanDisplayText(
                                currentTestQuestion.explanation ||
                                "Review the explanation and try the next question."
                            )
                        )}
                    </p>

                </div>
            `;

        }


        speakFunnyReaction(
            reaction
        );


        setTimeout(
            () => {

                speak(
                    `The correct answer is ${
                        cleanDisplayText(
                            currentTestQuestion.correctAnswer
                        )
                    }. ${
                        cleanDisplayText(
                            currentTestQuestion.explanation || ""
                        )
                    }`
                );

            },
            1100
        );

    }


    if (testNext) {

        testNext.style.display =
            currentTestNumber <
            currentTestLength
                ? "inline-flex"
                : "none";

    }


    if (
        currentTestNumber >=
        currentTestLength
    ) {

        setTimeout(
            finishTest,
            800
        );

    }

}


// ============================================================
// NEXT QUESTION
// ============================================================

async function nextQuestion() {

    if (
        currentTestNumber >=
        currentTestLength
    ) {

        finishTest();

        return;

    }

    await loadNextTestQuestion();

}


// ============================================================
// FINISH TEST
// ============================================================

function finishTest() {

    stopSpeech();

    const total =
        currentTestNumber;

    const percentage =
        total
            ? Math.round(
                (
                    currentTestScore /
                    total
                ) * 100
            )
            : 0;


    if (testQuestion) {

        testQuestion.innerHTML = `
            <div class="test-finished">

                <h3>
                    Test Complete
                </h3>

                <div class="test-score">
                    ${currentTestScore}/${total}
                </div>

                <p>
                    Score: ${percentage}%
                </p>

            </div>
        `;

    }


    if (testOptions) {
        testOptions.innerHTML = "";
    }


    if (testFeedback) {

        testFeedback.innerHTML = `
            <div class="quiz-feedback">

                <p>
                    You completed the test on
                    <strong>
                        ${escapeHTML(
                            currentTestTopic
                        )}
                    </strong>.
                </p>

            </div>
        `;

    }


    if (testProgress) {

        testProgress.textContent =
            `Final score: ${percentage}%`;

    }


    if (testStatus) {

        testStatus.textContent =
            "Test completed.";

    }


    if (testNext) {
        testNext.style.display =
            "none";
    }


    speak(
        `Test complete. You scored ${
            currentTestScore
        } out of ${
            total
        }, which is ${
            percentage
        } percent.`
    );

}


// ============================================================
// EXIT TEST
// ============================================================

function exitTest() {

    stopSpeech();

    if (testPanel) {
        testPanel.hidden = true;
    }

    resetTest();

}


// ============================================================
// EVENT LISTENERS
// ============================================================

if (askAIButton) {

    askAIButton.addEventListener(
        "click",
        () => {

            performSearch(
                aiQuestion?.value || ""
            );

        }
    );

}


if (aiQuestion) {

    aiQuestion.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                performSearch(
                    aiQuestion.value
                );

            }

        }
    );

}


document
    .querySelectorAll(
        ".suggestion-button"
    )
    .forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const question =
                        button.dataset.question ||
                        button.textContent ||
                        "";

                    if (aiQuestion) {
                        aiQuestion.value =
                            cleanDisplayText(
                                question
                            );
                    }

                    performSearch(
                        question
                    );

                }
            );

        }
    );


if (startTestButton) {

    startTestButton.addEventListener(
        "click",
        startTest
    );

}


if (testNext) {

    testNext.addEventListener(
        "click",
        nextQuestion
    );

}


if (testExit) {

    testExit.addEventListener(
        "click",
        exitTest
    );

}


if (readMainAnswerButton) {

    readMainAnswerButton.addEventListener(
        "click",
        () => {

            speak(
                currentAnswerText
            );

        }
    );

}


if (stopMainAudioButton) {

    stopMainAudioButton.addEventListener(
        "click",
        stopSpeech
    );

}


if (readAnswerButton) {

    readAnswerButton.addEventListener(
        "click",
        () => {

            if (!currentTestQuestion) {
                return;
            }

            speak(
                [
                    currentTestQuestion.question,
                    ...(
                        currentTestQuestion.options ||
                    []).map(
                        option =>
                            `${option.key}. ${option.text}`
                    )
                ].join(". ")
            );

        }
    );

}


if (stopAudioButton) {

    stopAudioButton.addEventListener(
        "click",
        stopSpeech
    );

}


// ============================================================
// RESTORE LAST QUESTION
// ============================================================

try {

    const stored =
        JSON.parse(
            localStorage.getItem(
                "mwanikiAIQuestions"
            ) || "[]"
        );


    if (
        Array.isArray(stored) &&
        stored.length &&
        testTopic
    ) {

        testTopic.value =
            cleanDisplayText(
                stored[0]?.question || ""
            );

    }

} catch {
    // Ignore invalid localStorage.
}


// ============================================================
// INITIAL STATE
// ============================================================

if (testPanel) {
    testPanel.hidden = true;
}

setSearchStatus(
    "Search the web first, then compare the evidence with Mwaniki Scholars material."
);

