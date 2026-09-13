
import { supabase } from "./supabase.js";


// ============================================================
// MWANIKI AI
// STUDENT MEDICAL SEARCH + TEST ENGINE
// ============================================================


const $ = (id) => document.getElementById(id);


const aiQuestion = $("aiQuestion");
const askAIButton = $("askAIButton");

const aiAnswer = $("aiAnswer");
const aiSearchStatus = $("aiSearchStatus");
const aiStatus = $("aiStatus");

const mwanikiResultCount = $("mwanikiResultCount");
const mwanikiSources = $("mwanikiSources");

const webResults = $("webResults");
const webResultCount = $("webResultCount");

const aiImages = $("aiImages");

const testPanel = $("testPanel");
const testStatus = $("testStatus");
const testQuestion = $("testQuestion");
const testOptions = $("testOptions");
const testFeedback = $("testFeedback");
const testProgress = $("testProgress");

const testNext = $("testNext");
const testExit = $("testExit");

const readAnswerButton = $("readAnswerButton");
const stopAudioButton = $("stopAudioButton");

const readMainAnswerButton = $("readMainAnswerButton");
const stopMainAudioButton = $("stopMainAudioButton");

const testTopic = $("testTopic");
const testLength = $("testLength");
const startTestButton = $("startTestButton");


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
// HELPERS
// ============================================================


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function safeURL(value) {

    try {

        const url = new URL(String(value || ""));

        if (
            url.protocol === "http:" ||
            url.protocol === "https:"
        ) {
            return url.href;
        }

    } catch {
        return "";
    }

    return "";

}


function cleanText(value) {

    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

}


function truncate(value, max = 500) {

    const text = cleanText(value);

    if (text.length <= max) {
        return text;
    }

    return text.slice(0, max).trim() + "...";

}


function speak(text) {

    if (!("speechSynthesis" in window)) {

        return;

    }

    const clean = cleanText(text);

    if (!clean) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(clean);

    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);

}


function stopSpeech() {

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

}


function setStatus(message, type = "normal") {

    if (!aiStatus) {
        return;
    }

    const color =
        type === "error"
            ? "#a32929"
            : type === "success"
                ? "#176b40"
                : "#64758a";

    aiStatus.innerHTML =
        `<span style="color:${color};">${escapeHTML(message)}</span>`;

}


function setSearchStatus(message) {

    if (!aiSearchStatus) {
        return;
    }

    aiSearchStatus.textContent = message;

}


function setBusy(isBusy) {

    if (!askAIButton) {
        return;
    }

    askAIButton.disabled = isBusy;

    askAIButton.textContent =
        isBusy
            ? "Searching..."
            : "Ask Mwaniki AI";

}


// ============================================================
// AUTHENTICATION
// ============================================================


async function getAccessToken() {

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {
        throw new Error(error.message);
    }

    const session = data?.session;

    if (!session?.access_token) {

        throw new Error(
            "Your student session has expired. Please log in again."
        );

    }

    return session.access_token;

}


// ============================================================
// EDGE FUNCTION
// ============================================================


async function invokeMwanikiAI(body) {

    const token = await getAccessToken();

    const {
        data,
        error
    } = await supabase.functions.invoke(
        "mwaniki-ai",
        {
            body,
            headers: {
                Authorization:
                    "Bearer " + token
            }
        }
    );

    if (error) {

        let message =
            error.message ||
            "Mwaniki AI could not complete the request.";

        if (
            error.context &&
            typeof error.context.json === "function"
        ) {

            try {

                const details =
                    await error.context.json();

                if (details?.error) {
                    message = details.error;
                }

            } catch {
                // Keep original message.
            }

        }

        throw new Error(message);

    }

    if (!data) {

        throw new Error(
            "The AI service returned no data."
        );

    }

    if (data.success === false) {

        throw new Error(
            data.error ||
            "Mwaniki AI returned an error."
        );

    }

    return data;

}


// ============================================================
// SEARCH
// ============================================================


async function performSearch(question) {

    const query = cleanText(question);

    if (!query) {

        setStatus(
            "Type a medical question first.",
            "error"
        );

        return;

    }

    setBusy(true);

    setStatus(
        "Searching Mwaniki Scholars and configured web sources..."
    );

    setSearchStatus(
        "Searching Mwaniki material first..."
    );

    aiAnswer.innerHTML =
        `<div class="loading-state">
            Mwaniki AI is searching...
        </div>`;

    mwanikiSources.innerHTML =
        `<div class="loading-state">
            Searching Mwaniki sources...
        </div>`;

    webResults.innerHTML =
        `<div class="loading-state">
            Searching web sources...
        </div>`;

    aiImages.innerHTML =
        `<div class="loading-state">
            Searching visual sources...
        </div>`;

    try {

        const result =
            await invokeMwanikiAI({
                mode: "search",
                question: query,
                searchMwaniki: true,
                searchWeb: true,
                searchImages: true
            });

        lastSearchResponse = result;

        renderSearchResult(result);

    } catch (error) {

        console.error(
            "Mwaniki AI search error:",
            error
        );

        aiAnswer.innerHTML =
            `<div class="empty-state">
                <strong>Search failed.</strong><br><br>
                ${escapeHTML(error.message)}
            </div>`;

        setStatus(
            error.message,
            "error"
        );

    } finally {

        setBusy(false);

    }

}


// ============================================================
// RENDER SEARCH RESULT
// ============================================================


function renderSearchResult(result) {

    const answer =
        result.answer || null;

    const webAnswer =
        result.webAnswer || null;

    const mwanikiSourcesData =
        Array.isArray(result.mwanikiSources)
            ? result.mwanikiSources
            : [];

    const webData =
        Array.isArray(result.webResults)
            ? result.webResults
            : [];

    const imageData =
        Array.isArray(result.images)
            ? result.images
            : [];


    const internalCount =
        Number(
            result.counts?.mwaniki ||
            mwanikiSourcesData.length ||
            0
        );

    const webCount =
        Number(
            result.counts?.web ||
            webData.length ||
            0
        );

    const imageCount =
        Number(
            result.counts?.images ||
            imageData.length ||
            0
        );


    mwanikiResultCount.textContent =
        internalCount +
        " source" +
        (internalCount === 1 ? "" : "s");


    webResultCount.textContent =
        webCount +
        " result" +
        (webCount === 1 ? "" : "s");


    setSearchStatus(
        "Mwaniki: " +
        internalCount +
        " sources • Web: " +
        webCount +
        " results • Images: " +
        imageCount
    );


    renderAnswer(answer);

    renderMwanikiSources(
        mwanikiSourcesData
    );

    renderWebResults(
        webAnswer,
        webData,
        result.googleSearchUrl
    );

    renderImages(
        imageData,
        result.googleImageSearchUrl
    );


    const topic =
        cleanText(
            answer?.title ||
            result.question ||
            ""
        );

    currentTestTopic =
        topic || cleanText(result.question || "");

    if (testTopic) {
        testTopic.value = currentTestTopic;
    }


    setStatus(
        "Mwaniki AI is ready.",
        "success"
    );

}


// ============================================================
// MAIN ANSWER
// ============================================================


function renderAnswer(answer) {

    if (!answer) {

        aiAnswer.innerHTML =
            `<div class="empty-state">
                No direct Mwaniki answer was found.
                Check the separate Google / Web answer below.
            </div>`;

        currentAnswerText = "";

        return;

    }


    const title =
        cleanText(answer.title) ||
        "Medical Answer";


    const paragraphs =
        Array.isArray(answer.paragraphs)
            ? answer.paragraphs
            : [];


    const keyPoints =
        Array.isArray(answer.keyPoints)
            ? answer.keyPoints
            : [];


    const sourceLabel =
        answer.sourceType === "web"
            ? "Web answer"
            : "Mwaniki material";


    let html = `

        <div class="answer-box">

            <div class="answer-header">

                <div>
                    <span class="eyebrow">
                        ${escapeHTML(sourceLabel)}
                    </span>

                    <h2>
                        ${escapeHTML(title)}
                    </h2>
                </div>

                <span class="answer-badge">
                    ${escapeHTML(sourceLabel)}
                </span>

            </div>
    `;


    for (const paragraph of paragraphs) {

        const text = cleanText(paragraph);

        if (!text) {
            continue;
        }

        html +=
            `<p class="answer-paragraph">
                ${escapeHTML(text)}
            </p>`;

    }


    if (keyPoints.length) {

        html +=
            `<div class="key-points">`;

        for (const point of keyPoints) {

            const text =
                cleanText(
                    typeof point === "string"
                        ? point
                        : point.text
                );

            if (!text) {
                continue;
            }

            html +=
                `<div class="key-point">
                    ${escapeHTML(text)}
                </div>`;

        }

        html +=
            `</div>`;

    }


    html += `

            <div class="answer-actions">

                <button
                    type="button"
                    class="primary-button"
                    id="inlineTestButton"
                >
                    🧠 Test Me On This Topic
                </button>

            </div>

        </div>
    `;


    aiAnswer.innerHTML = html;


    const inlineTestButton =
        document.getElementById(
            "inlineTestButton"
        );


    if (inlineTestButton) {

        inlineTestButton.addEventListener(
            "click",
            () => startTest()
        );

    }


    currentAnswerText =
        [
            title,
            ...paragraphs,
            ...keyPoints
                .map((point) =>
                    typeof point === "string"
                        ? point
                        : point?.text || ""
                )
        ]
            .filter(Boolean)
            .join(". ");

}


// ============================================================
// MWANIKI SOURCES
// ============================================================


function renderMwanikiSources(sources) {

    if (!sources.length) {

        mwanikiSources.innerHTML =
            `<div class="empty-state">
                No sufficiently relevant Mwaniki course,
                unit, note or quiz source matched this question.
            </div>`;

        return;

    }


    let html =
        `<div class="source-list">`;


    for (const source of sources.slice(0, 12)) {

        const title =
            cleanText(
                source.title ||
                source.name ||
                source.unit ||
                source.course ||
                "Mwaniki source"
            );


        const meta =
            cleanText(
                [
                    source.course,
                    source.unit,
                    source.type
                ]
                    .filter(Boolean)
                    .join(" • ")
            );


        const description =
            truncate(
                source.description ||
                source.snippet ||
                source.text ||
                "",
                300
            );


        const url =
            safeURL(
                source.url ||
                source.file_url ||
                ""
            );


        if (url) {

            html +=
                `<a
                    class="source-card"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <div class="source-meta">
                        ${escapeHTML(meta)}
                    </div>

                    <div class="source-meta">
                        ${escapeHTML(description)}
                    </div>
                </a>`;

        } else {

            html +=
                `<div class="source-card">

                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <div class="source-meta">
                        ${escapeHTML(meta)}
                    </div>

                    <div class="source-meta">
                        ${escapeHTML(description)}
                    </div>

                </div>`;

        }

    }


    html +=
        `</div>`;


    mwanikiSources.innerHTML = html;

}


// ============================================================
// WEB RESULTS
// ============================================================


function renderWebResults(
    webAnswer,
    results,
    googleURL
) {

    let html = "";


    if (webAnswer) {

        const title =
            cleanText(
                webAnswer.title ||
                "Google / Web Answer"
            );


        const paragraphs =
            Array.isArray(webAnswer.paragraphs)
                ? webAnswer.paragraphs
                : [];


        html +=
            `<div class="web-answer">

                <h3>
                    ${escapeHTML(title)}
                </h3>`;


        for (const paragraph of paragraphs) {

            if (!cleanText(paragraph)) {
                continue;
            }

            html +=
                `<p>
                    ${escapeHTML(
                        cleanText(paragraph)
                    )}
                </p>`;

        }


        html +=
            `</div>`;

    }


    if (results.length) {

        html +=
            `<div class="web-results">`;


        for (const result of results.slice(0, 10)) {

            const title =
                cleanText(
                    result.title ||
                    "Web result"
                );


            const snippet =
                truncate(
                    result.snippet ||
                    result.description ||
                    result.text ||
                    "",
                    500
                );


            const url =
                safeURL(
                    result.url ||
                    result.link ||
                    result.href ||
                    ""
                );


            if (!url) {
                continue;
            }


            html +=
                `<a
                    class="web-result"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >

                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <div class="web-snippet">
                        ${escapeHTML(snippet)}
                    </div>

                </a>`;

        }


        html +=
            `</div>`;

    }


    const googleSearch =
        safeURL(googleURL);


    if (googleSearch) {

        html +=
            `<a
                class="see-more"
                href="${escapeHTML(googleSearch)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                See more on Google Search →
            </a>`;

    }


    if (!html) {

        html =
            `<div class="empty-state">

                Google/web search is available,
                but no configured provider returned
                results for this request.

            </div>`;

    }


    webResults.innerHTML = html;

}


// ============================================================
// IMAGE RESULTS
// ============================================================


function renderImages(
    images,
    googleImageURL
) {

    let html = "";


    if (images.length) {

        html +=
            `<div class="image-grid">`;


        for (const image of images.slice(0, 6)) {

            const imageURL =
                safeURL(
                    image.imageUrl ||
                    image.contentUrl ||
                    image.thumbnailUrl ||
                    image.thumbnail ||
                    image.url ||
                    image.src ||
                    ""
                );


            if (!imageURL) {
                continue;
            }


            const title =
                cleanText(
                    image.title ||
                    image.name ||
                    "Medical visual"
                );


            html +=
                `<div class="image-card">

                    <img
                        src="${escapeHTML(imageURL)}"
                        alt="${escapeHTML(title)}"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                    >

                    <div>
                        ${escapeHTML(title)}
                    </div>

                </div>`;

        }


        html +=
            `</div>`;

    }


    const imageSearch =
        safeURL(googleImageURL);


    if (imageSearch) {

        html +=
            `<a
                class="see-more"
                href="${escapeHTML(imageSearch)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                See more images on Google →
            </a>`;

    }


    if (!html) {

        html =
            `<div class="empty-state">
                Visual search is available, but no configured
                image provider returned an image for this query.
            </div>`;

    }


    aiImages.innerHTML = html;

}


// ============================================================
// TEST
// ============================================================


async function startTest() {

    currentTestTopic =
        cleanText(
            testTopic?.value ||
            currentTestTopic ||
            aiQuestion?.value ||
            "medical topic"
        );


    if (!currentTestTopic) {

        setStatus(
            "Search a topic before starting a test.",
            "error"
        );

        return;

    }


    currentTestLength =
        Number(
            testLength?.value || 10
        );


    currentTestNumber = 0;
    currentTestScore = 0;
    currentTestUsedIds = [];
    currentTestQuestion = null;
    testAnswered = false;


    testPanel.style.display = "block";

    testPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    await loadNextTestQuestion();

}


// ============================================================
// LOAD TEST QUESTION
// ============================================================


async function loadNextTestQuestion() {

    if (
        currentTestNumber >=
        currentTestLength
    ) {

        finishTest();

        return;

    }


    testAnswered = false;

    testFeedback.style.display = "none";
    testFeedback.className = "";

    testNext.style.display = "none";

    testOptions.innerHTML =
        `<div class="loading-state">
            Creating your next question...
        </div>`;


    testQuestion.textContent =
        "Preparing question...";


    testProgress.textContent =
        "Question " +
        (currentTestNumber + 1) +
        " of " +
        currentTestLength;


    testStatus.textContent =
        "Generating a question from your medical study material...";


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

                searchMwaniki: true

            });


        if (!result.testQuestion) {

            finishTest(
                "Mwaniki AI could not generate another unique question."
            );

            return;

        }


        currentTestQuestion =
            result.testQuestion;


        currentTestNumber++;


        const questionId =
            String(
                currentTestQuestion.id ||
                (
                    currentTestTopic +
                    "-" +
                    currentTestNumber
                )
            );


        currentTestUsedIds.push(
            questionId
        );


        renderTestQuestion(
            currentTestQuestion
        );


    } catch (error) {

        console.error(
            "Test generation error:",
            error
        );


        testStatus.textContent =
            error.message;


        testQuestion.textContent =
            "The question could not be generated.";


        testOptions.innerHTML =
            `<div class="empty-state">
                ${escapeHTML(error.message)}
            </div>`;

    }

}


// ============================================================
// RENDER TEST QUESTION
// ============================================================


function renderTestQuestion(question) {

    const options =
        Array.isArray(question.options)
            ? question.options
            : [];


    testQuestion.textContent =
        cleanText(question.question);


    testOptions.innerHTML = "";


    for (const option of options) {

        const button =
            document.createElement("button");


        button.type = "button";

        button.className =
            "test-option";


        button.dataset.key =
            String(option.key || "");


        button.textContent =
            String(
                option.key +
                ". " +
                option.text
            );


        button.addEventListener(
            "click",
            () => answerTestQuestion(
                button.dataset.key
            )
        );


        testOptions.appendChild(
            button
        );

    }


    testStatus.textContent =
        question.sourceType === "quiz"
            ? "Question from the Mwaniki quiz bank."
            : "Question generated from Mwaniki study material.";

}


// ============================================================
// ANSWER TEST QUESTION
// ============================================================


function answerTestQuestion(selectedKey) {

    if (
        testAnswered ||
        !currentTestQuestion
    ) {
        return;
    }


    testAnswered = true;


    const correctKey =
        String(
            currentTestQuestion.correctKey ||
            ""
        );


    const isCorrect =
        selectedKey === correctKey;


    if (isCorrect) {

        currentTestScore++;

    }


    const buttons =
        Array.from(
            testOptions.querySelectorAll(
                ".test-option"
            )
        );


    for (const button of buttons) {

        const key =
            String(
                button.dataset.key
            );


        if (key === correctKey) {

            button.classList.add(
                "correct"
            );

        }


        if (
            key === selectedKey &&
            key !== correctKey
        ) {

            button.classList.add(
                "wrong"
            );

        }


        button.disabled = true;

    }


    const correctAnswer =
        cleanText(
            currentTestQuestion.correctAnswer ||
            ""
        );


    const explanation =
        cleanText(
            currentTestQuestion.explanation ||
            ""
        );


    if (isCorrect) {

        testFeedback.className =
            "feedback-good";


        testFeedback.innerHTML =
            `<strong>
                🎉 Correct!
            </strong>
            <br><br>
            ${escapeHTML(explanation)}`;


        speak(
            "Correct! Well done. " +
            explanation
        );

    } else {

        testFeedback.className =
            "feedback-bad";


        testFeedback.innerHTML =
            `<strong>
                😂😂 Hahaha! Eish! What was that answer?
            </strong>

            <br><br>

            Let's rescue you before the examiner sees it.

            <br><br>

            <strong>
                Correct answer:
            </strong>

            ${escapeHTML(correctAnswer)}

            <br><br>

            ${escapeHTML(explanation)}`;


        speak(
            "Hahaha! Eish! What was that answer? " +
            "Let's rescue you before the examiner sees it. " +
            "The correct answer is " +
            correctAnswer +
            ". " +
            explanation
        );

    }


    testFeedback.style.display =
        "block";


    testNext.style.display =
        "inline-flex";


    testProgress.textContent =
        "Question " +
        currentTestNumber +
        " of " +
        currentTestLength +
        " • Score " +
        currentTestScore;


    testNext.focus();

}


// ============================================================
// NEXT QUESTION
// ============================================================


function nextQuestion() {

    stopSpeech();

    if (
        currentTestNumber >=
        currentTestLength
    ) {

        finishTest();

        return;

    }


    loadNextTestQuestion();

}


// ============================================================
// FINISH TEST
// ============================================================


function finishTest(customMessage = "") {

    stopSpeech();

    const percentage =
        currentTestLength > 0
            ? Math.round(
                (
                    currentTestScore /
                    currentTestLength
                ) * 100
            )
            : 0;


    testQuestion.textContent =
        "Test Complete 🎓";


    testOptions.innerHTML =
        `<div class="empty-state">

            <strong>
                ${currentTestScore}
                /
                ${currentTestLength}
            </strong>

            <br><br>

            Score:
            <strong>
                ${percentage}%
            </strong>

            <br><br>

            ${
                customMessage
                    ? escapeHTML(customMessage)
                    : percentage >= 80
                        ? "Excellent work. Keep going, Scholar."
                        : percentage >= 60
                            ? "Good effort. Review the missed areas and try again."
                            : "Time for another round. Review the material and come back stronger."
            }

        </div>`;


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    testProgress.textContent =
        "Final score: " +
        percentage +
        "%";


    testStatus.textContent =
        "You completed the " +
        currentTestLength +
        "-question test.";


    speak(
        "Test complete. " +
        "You scored " +
        currentTestScore +
        " out of " +
        currentTestLength +
        ". " +
        "That is " +
        percentage +
        " percent."
    );

}


// ============================================================
// EXIT TEST
// ============================================================


function exitTest() {

    stopSpeech();

    testPanel.style.display =
        "none";

    currentTestQuestion = null;

}


// ============================================================
// EVENT LISTENERS
// ============================================================


if (askAIButton) {

    askAIButton.addEventListener(
        "click",
        () => performSearch(
            aiQuestion.value
        )
    );

}


if (aiQuestion) {

    aiQuestion.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey)
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
    .querySelectorAll(".suggestion-button")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const question =
                    button.dataset.question ||
                    button.textContent;


                aiQuestion.value =
                    question;


                performSearch(
                    question
                );

            }
        );

    });


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
        () => speak(
            currentAnswerText
        )
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

            if (
                currentTestQuestion
            ) {

                const text =
                    [
                        currentTestQuestion.correctAnswer,
                        currentTestQuestion.explanation
                    ]
                        .filter(Boolean)
                        .join(". ");


                speak(text);

            }

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
// INITIAL STATE
// ============================================================


const savedQuestion =
    localStorage.getItem(
        "mwanikiAIQuestions"
    );


if (savedQuestion) {

    try {

        const parsed =
            JSON.parse(savedQuestion);


        if (
            Array.isArray(parsed) &&
            parsed.length
        ) {

            currentTestTopic =
                cleanText(
                    parsed[0]
                );

        }

    } catch {
        // Ignore malformed history.
    }

}


console.log(
    "🤖 Mwaniki AI frontend loaded."
);

