import { supabase } from "./supabase.js";


// ============================================================
// MWANIKI SCHOLARS
// MWANIKI AI FRONTEND ENGINE
// ============================================================

console.log("🚀 Mwaniki AI frontend loading...");


// ============================================================
// DOM
// ============================================================

const questionInput =
    document.getElementById("aiQuestion");

const askButton =
    document.getElementById("askAIButton");

const aiAnswer =
    document.getElementById("aiAnswer");

const aiSources =
    document.getElementById("aiSources");

const webResults =
    document.getElementById("webResults");

const aiImages =
    document.getElementById("aiImages");

const aiStatus =
    document.getElementById("aiStatus");

const aiSearchStatus =
    document.getElementById("aiSearchStatus");

const resultsGrid =
    document.getElementById("resultsGrid");

const mwanikiResultCount =
    document.getElementById("mwanikiResultCount");

const webResultCount =
    document.getElementById("webResultCount");


// TEST ELEMENTS

const testPanel =
    document.getElementById("testPanel");

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

const testProgress =
    document.getElementById("testProgress");


// ============================================================
// STATE
// ============================================================

let currentQuestion = "";

let currentSearchData = null;

let currentTest = null;

let currentTestIndex = 0;

let currentTestScore = 0;

let currentTestAnswered = false;


// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function safeURL(value) {

    try {

        const url =
            new URL(String(value));

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


function shorten(text, max = 420) {

    const value =
        String(text ?? "")
            .replace(/\s+/g, " ")
            .trim();

    if (value.length <= max) {
        return value;
    }

    return (
        value.slice(0, max)
            .replace(/\s+\S*$/, "")
            .trim() +
        "…"
    );
}


function setStatus(text, busy = false) {

    if (aiStatus) {

        aiStatus.innerHTML = busy
            ? `<span class="status-dot"></span> ${escapeHTML(text)}`
            : `<span class="status-dot"></span> ${escapeHTML(text)}`;
    }
}


function setSearchStatus(text) {

    if (aiSearchStatus) {
        aiSearchStatus.textContent = text || "";
    }
}


function speak(text) {

    if (
        !("speechSynthesis" in window)
    ) {
        return false;
    }

    try {

        window.speechSynthesis.cancel();

        const utterance =
            new SpeechSynthesisUtterance(
                String(text || "")
            );

        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        window.speechSynthesis.speak(
            utterance
        );

        return true;

    } catch (error) {

        console.warn(
            "Speech synthesis failed:",
            error
        );

        return false;
    }
}


function stopSpeech() {

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
}


// ============================================================
// AUTH
// ============================================================

async function getAccessToken() {

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    const session =
        data?.session;

    if (!session?.access_token) {

        throw new Error(
            "Your student session has expired. Please sign in again."
        );
    }

    return session.access_token;
}


// ============================================================
// ANSWER NORMALIZATION
// ============================================================

function getAnswerParagraphs(answer) {

    if (!answer) {
        return [];
    }


    if (
        Array.isArray(answer.paragraphs)
    ) {

        return answer.paragraphs
            .map(item =>
                String(item || "").trim()
            )
            .filter(Boolean);
    }


    if (
        typeof answer === "string"
    ) {

        return answer
            .split(/\n+/)
            .map(item =>
                item.trim()
            )
            .filter(Boolean);
    }


    if (
        answer.explanation
    ) {

        return [
            String(
                answer.explanation
            )
        ];
    }


    return [];
}


// ============================================================
// RENDER ANSWER
// ============================================================

function renderMwanikiAnswer(data) {

    if (!aiAnswer) {
        return;
    }


    const answer =
        data?.answer;


    const paragraphs =
        getAnswerParagraphs(
            answer
        );


    const keyPoints =
        Array.isArray(
            answer?.keyPoints
        )
            ? answer.keyPoints
            : [];


    const title =
        answer?.title ||
        "Mwaniki Scholars answer";


    const confidence =
        answer?.confidence ||
        "internal";


    if (
        !paragraphs.length &&
        !keyPoints.length
    ) {

        aiAnswer.innerHTML = `
            <div class="empty">
                Mwaniki AI could not build a reliable
                answer from the returned material.
                The available web search results are
                shown alongside this panel.
            </div>
        `;

        return;
    }


    const sourceLabel =
        confidence === "web"
            ? "Web-backed"
            : "Mwaniki material";


    let html = `

        <div class="answer-meta">

            <span class="answer-tag">
                ${escapeHTML(sourceLabel)}
            </span>

            <span class="answer-tag">
                Source-backed
            </span>

        </div>

        <h3>
            ${escapeHTML(title)}
        </h3>
    `;


    paragraphs.forEach(
        paragraph => {

            html += `
                <p>
                    ${escapeHTML(
                        paragraph
                    )}
                </p>
            `;
        }
    );


    if (keyPoints.length) {

        html += `
            <strong>
                Key points
            </strong>

            <ul>
        `;


        keyPoints.forEach(
            point => {

                html += `
                    <li>
                        ${escapeHTML(point)}
                    </li>
                `;
            }
        );


        html += `
            </ul>
        `;
    }


    html += `

        <div class="audio-controls">

            <button
                type="button"
                class="audio-button"
                id="readAnswerButton"
            >
                🔊 Read answer aloud
            </button>

            <button
                type="button"
                class="audio-button"
                id="stopAudioButton"
            >
                ⏹ Stop audio
            </button>

            <button
                type="button"
                class="test-button"
                id="startTestButton"
            >
                🧠 Test me on this topic
            </button>

        </div>
    `;


    aiAnswer.innerHTML =
        html;


    const readButton =
        document.getElementById(
            "readAnswerButton"
        );


    const stopButton =
        document.getElementById(
            "stopAudioButton"
        );


    const startTestButton =
        document.getElementById(
            "startTestButton"
        );


    readButton?.addEventListener(
        "click",
        () => {

            const text =
                [
                    title,
                    ...paragraphs,
                    ...keyPoints
                ].join(". ");

            speak(text);
        }
    );


    stopButton?.addEventListener(
        "click",
        stopSpeech
    );


    startTestButton?.addEventListener(
        "click",
        () => {

            startGeneratedTest(
                currentQuestion
            );
        }
    );
}


// ============================================================
// RENDER SOURCES
// ============================================================

function renderMwanikiSources(data) {

    if (!aiSources) {
        return;
    }


    const sources =
        Array.isArray(
            data?.mwanikiSources
        )
            ? data.mwanikiSources
            : [];


    if (!sources.length) {

        aiSources.innerHTML = `
            <div class="empty">
                No internal Mwaniki source cards were
                returned for this question.
            </div>
        `;

        return;
    }


    const unique =
        sources.filter(
            (source, index, array) => {

                const key =
                    [
                        source?.type,
                        source?.id,
                        source?.title
                    ]
                    .join("|");

                return (
                    index ===
                    array.findIndex(
                        item =>
                            [
                                item?.type,
                                item?.id,
                                item?.title
                            ]
                            .join("|") === key
                    )
                );
            }
        );


    let html = `

        <div class="result-title">

            <h3>
                Mwaniki Sources
            </h3>

        </div>

        <div class="source-list">
    `;


    unique.slice(0, 12).forEach(
        source => {

            const title =
                source?.title ||
                source?.name ||
                "Mwaniki source";


            const type =
                source?.type ||
                "Learning material";


            const description =
                source?.description ||
                source?.snippet ||
                source?.content ||
                "";


            const url =
                safeURL(
                    source?.url ||
                    source?.file_url
                );


            html += `

                <article class="source-item">

                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <small>
                        ${escapeHTML(type)}
                        ${description
                            ? " • " +
                              escapeHTML(
                                  shorten(
                                      description,
                                      220
                                  )
                              )
                            : ""}
                    </small>

                    ${
                        url
                            ? `
                                <a
                                    href="${escapeHTML(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open source →
                                </a>
                              `
                            : ""
                    }

                </article>
            `;
        }
    );


    html += `
        </div>
    `;


    aiSources.innerHTML =
        html;
}


// ============================================================
// WEB RESULTS
// ============================================================

function renderWebResults(data) {

    if (!webResults) {
        return;
    }


    const results =
        Array.isArray(
            data?.webResults
        )
            ? data.webResults
            : [];


    if (
        webResultCount
    ) {

        webResultCount.textContent =
            `${results.length} result${results.length === 1 ? "" : "s"}`;
    }


    if (!results.length) {

        const googleURL =
            safeURL(
                data?.googleSearchUrl
            );


        webResults.innerHTML = `

            <div class="empty">

                No configured web-search provider returned
                result cards for this question.

                ${
                    googleURL
                        ? `
                            <br><br>

                            <a
                                class="see-more"
                                href="${escapeHTML(googleURL)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                🔎 Search Google directly →
                            </a>
                          `
                        : ""
                }

            </div>
        `;

        return;
    }


    let html = "";


    results.slice(0, 10).forEach(
        result => {

            const title =
                result?.title ||
                result?.name ||
                "Web result";


            const description =
                result?.description ||
                result?.snippet ||
                result?.text ||
                "";


            const url =
                safeURL(
                    result?.url ||
                    result?.link
                );


            html += `

                <article class="web-item">

                    <h4>
                        ${escapeHTML(title)}
                    </h4>

                    ${
                        description
                            ? `
                                <p>
                                    ${escapeHTML(
                                        shorten(
                                            description,
                                            430
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
                                    Read source →
                                </a>
                              `
                            : ""
                    }

                </article>
            `;
        }
    );


    const googleURL =
        safeURL(
            data?.googleSearchUrl
        );


    if (googleURL) {

        html += `

            <a
                class="see-more"
                href="${escapeHTML(googleURL)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                🔎 See more Google results →
            </a>
        `;
    }


    webResults.innerHTML =
        html;
}


// ============================================================
// IMAGE RESULTS
// ============================================================

function renderImages(data) {

    if (!aiImages) {
        return;
    }


    const images =
        Array.isArray(
            data?.images
        )
            ? data.images
            : [];


    if (!images.length) {

        const googleImageURL =
            safeURL(
                data?.googleImageSearchUrl
            );


        aiImages.innerHTML = `

            <div class="empty">

                No configured image-search provider
                returned an image card yet.

                ${
                    googleImageURL
                        ? `
                            <br><br>

                            <a
                                class="see-more"
                                href="${escapeHTML(googleImageURL)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                🖼 See more images on Google →
                            </a>
                          `
                        : ""
                }

            </div>
        `;

        return;
    }


    let html = `

        <div class="image-gallery">
    `;


    images
        .filter(
            image =>
                safeURL(
                    image?.image_url ||
                    image?.url ||
                    image?.thumbnail
                )
        )
        .slice(0, 4)
        .forEach(
            image => {

                const imageURL =
                    safeURL(
                        image?.image_url ||
                        image?.url ||
                        image?.thumbnail
                    );


                const pageURL =
                    safeURL(
                        image?.source_url ||
                        image?.page_url ||
                        image?.link
                    );


                const title =
                    image?.title ||
                    image?.name ||
                    "Medical visual";


                html += `

                    <article class="image-card">

                        <img
                            src="${escapeHTML(imageURL)}"
                            alt="${escapeHTML(title)}"
                            loading="lazy"
                            onerror="this.closest('.image-card').remove();"
                        >

                        <div class="image-card-body">

                            ${
                                pageURL
                                    ? `
                                        <a
                                            href="${escapeHTML(pageURL)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            ${escapeHTML(
                                                shorten(
                                                    title,
                                                    90
                                                )
                                            )}
                                        </a>
                                      `
                                    : `
                                        <span>
                                            ${escapeHTML(
                                                shorten(
                                                    title,
                                                    90
                                                )
                                            )}
                                        </span>
                                      `
                            }

                        </div>

                    </article>
                `;
            }
        );


    html += `
        </div>
    `;


    const googleImageURL =
        safeURL(
            data?.googleImageSearchUrl
        );


    if (googleImageURL) {

        html += `

            <a
                class="see-more"
                href="${escapeHTML(googleImageURL)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                🖼 See more images →
            </a>
        `;
    }


    aiImages.innerHTML =
        html;
}


// ============================================================
// TEST GENERATION
// ============================================================

async function requestGeneratedTest(
    topic
) {

    const token =
        await getAccessToken();


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => controller.abort(),
            25000
        );


    try {

        const {
            data,
            error
        } =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {
                        question: topic,
                        mode: "test",
                        testTopic: topic,
                        searchMwaniki: true,
                        searchWeb: true,
                        searchImages: false
                    },
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (error) {
            throw error;
        }


        return data;

    } finally {

        clearTimeout(timeout);
    }
}


// ============================================================
// START TEST
// ============================================================

async function startGeneratedTest(
    topic
) {

    if (!topic) {
        return;
    }


    stopSpeech();


    testPanel.style.display =
        "block";


    testQuestion.textContent =
        "Building your test from the study material...";


    testOptions.innerHTML =
        "";


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    testStatus.textContent =
        "Generating questions from the retrieved material...";


    try {

        const data =
            await requestGeneratedTest(
                topic
            );


        const questions =
            Array.isArray(
                data?.test?.questions
            )
                ? data.test.questions
                : [];


        if (!questions.length) {

            testQuestion.textContent =
                "I could not generate a reliable test from the retrieved material.";


            testStatus.textContent =
                "Try a more specific medical topic.";


            return;
        }


        currentTest = questions;

        currentTestIndex = 0;

        currentTestScore = 0;

        renderCurrentTestQuestion();

        testPanel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {

        console.error(
            "Test generation failed:",
            error
        );


        testQuestion.textContent =
            "The test could not be generated right now.";


        testStatus.textContent =
            error?.message ||
            "Please try again.";
    }
}


// ============================================================
// RENDER TEST QUESTION
// ============================================================

function renderCurrentTestQuestion() {

    if (
        !currentTest ||
        !currentTest.length
    ) {
        return;
    }


    const item =
        currentTest[
            currentTestIndex
        ];


    currentTestAnswered =
        false;


    testProgress.textContent =
        `Question ${currentTestIndex + 1} of ${currentTest.length}`;


    testQuestion.textContent =
        item.question ||
        "Question unavailable.";


    testOptions.innerHTML =
        "";


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    testStatus.textContent =
        "";


    const options =
        Array.isArray(
            item.options
        )
            ? item.options
            : [];


    options.forEach(
        option => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "test-option";


            button.textContent =
                `${option.key || ""}. ${option.text || ""}`;


            button.addEventListener(
                "click",
                () => {

                    handleTestAnswer(
                        item,
                        option,
                        button
                    );
                }
            );


            testOptions.appendChild(
                button
            );
        }
    );
}


// ============================================================
// ANSWER TEST QUESTION
// ============================================================

function handleTestAnswer(
    item,
    selectedOption,
    selectedButton
) {

    if (currentTestAnswered) {
        return;
    }


    currentTestAnswered =
        true;


    const buttons =
        testOptions.querySelectorAll(
            ".test-option"
        );


    buttons.forEach(
        button => {
            button.disabled = true;
        }
    );


    const correctKey =
        String(
            item.correctKey || ""
        )
            .trim()
            .toUpperCase();


    const selectedKey =
        String(
            selectedOption.key || ""
        )
            .trim()
            .toUpperCase();


    const correct =
        selectedKey === correctKey;


    buttons.forEach(
        button => {

            const key =
                button.textContent
                    .split(".")[0]
                    .trim()
                    .toUpperCase();


            if (key === correctKey) {

                button.classList.add(
                    "correct"
                );
            }
        }
    );


    if (!correct) {

        selectedButton.classList.add(
            "wrong"
        );


        currentTestScore =
            currentTestScore;


        const correctAnswer =
            item.correctAnswer ||
            "the correct answer";


        const explanation =
            item.explanation ||
            "Review the explanation in the study material.";


        testFeedback.innerHTML = `

            <div class="test-feedback-wrong">

                <strong>
                    😂 What the heck did you just say?
                </strong>

                <p>
                    Your answer was not the best choice.
                </p>

                <p>
                    <strong>
                        Correct answer:
                    </strong>

                    ${escapeHTML(
                        correctAnswer
                    )}
                </p>

                <p>
                    ${escapeHTML(
                        explanation
                    )}
                </p>

            </div>
        `;


        speak(
            `What the heck did you just say? The correct answer is ${correctAnswer}. ${explanation}`
        );

    } else {

        currentTestScore++;


        const explanation =
            item.explanation ||
            "That matches the retrieved study material.";


        testFeedback.innerHTML = `

            <div class="test-feedback-correct">

                <strong>
                    ✅ Correct. Well done!
                </strong>

                <p>
                    ${escapeHTML(
                        explanation
                    )}
                </p>

            </div>
        `;


        speak(
            `Correct. Well done. ${explanation}`
        );
    }


    testFeedback.style.display =
        "block";


    if (
        currentTestIndex <
        currentTest.length - 1
    ) {

        testNext.style.display =
            "inline-block";

    } else {

        testNext.style.display =
            "inline-block";

        testNext.textContent =
            "Finish Test →";
    }
}


// ============================================================
// NEXT TEST QUESTION
// ============================================================

testNext?.addEventListener(
    "click",
    () => {

        if (
            !currentTest ||
            !currentTest.length
        ) {
            return;
        }


        if (
            currentTestIndex >=
            currentTest.length - 1
        ) {

            finishTest();

            return;
        }


        currentTestIndex++;

        renderCurrentTestQuestion();
    }
);


// ============================================================
// FINISH TEST
// ============================================================

function finishTest() {

    stopSpeech();


    const total =
        currentTest?.length || 0;


    const percentage =
        total
            ? Math.round(
                (
                    currentTestScore /
                    total
                ) * 100
            )
            : 0;


    testProgress.textContent =
        "Complete";


    testQuestion.innerHTML = `

        <strong>
            Test complete.
        </strong>

        <br><br>

        You scored
        ${currentTestScore}
        out of
        ${total}
        (${percentage}%).

    `;


    testOptions.innerHTML =
        "";


    testFeedback.style.display =
        "block";


    testFeedback.innerHTML = `

        <div class="test-feedback-correct">

            <strong>
                🧠 Mwaniki AI assessment
            </strong>

            <p>
                ${percentage >= 70
                    ? "Good work. Keep strengthening the topic."
                    : "Keep studying the topic and try another test."}
            </p>

        </div>
    `;


    testNext.style.display =
        "none";


    testStatus.textContent =
        "You can close this test and ask Mwaniki AI another question.";
}


// ============================================================
// EXIT TEST
// ============================================================

testExit?.addEventListener(
    "click",
    () => {

        stopSpeech();

        testPanel.style.display =
            "none";

        currentTest =
            null;

        currentTestIndex =
            0;

        currentTestScore =
            0;
    }
);


// ============================================================
// SEARCH
// ============================================================

async function searchMwanikiAI(
    question
) {

    const cleanQuestion =
        String(question || "")
            .trim();


    if (!cleanQuestion) {

        setSearchStatus(
            "Type a medical question first."
        );

        return;
    }


    if (
        cleanQuestion.length >
        2000
    ) {

        setSearchStatus(
            "Please keep the question below 2000 characters."
        );

        return;
    }


    currentQuestion =
        cleanQuestion;


    stopSpeech();


    askButton.disabled =
        true;


    setStatus(
        "Searching...",
        true
    );


    setSearchStatus(
        "Searching Mwaniki Scholars learning material..."
    );


    resultsGrid.style.display =
        "grid";


    aiAnswer.innerHTML = `

        <div class="loading">

            <span class="spinner"></span>

            Building the answer from the retrieved
            medical material...

        </div>
    `;


    aiSources.innerHTML =
        "";


    webResults.innerHTML =
        "";


    aiImages.innerHTML =
        "";


    try {

        const token =
            await getAccessToken();


        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => controller.abort(),
                30000
            );


        let data;


        try {

            const response =
                await supabase.functions.invoke(
                    "mwaniki-ai",
                    {
                        body: {
                            question:
                                cleanQuestion,

                            searchMwaniki:
                                true,

                            searchWeb:
                                true,

                            searchImages:
                                true
                        },

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            if (response.error) {
                throw response.error;
            }


            data =
                response.data;

        } finally {

            clearTimeout(timeout);
        }


        if (!data) {

            throw new Error(
                "Mwaniki AI returned no data."
            );
        }


        currentSearchData =
            data;


        mwanikiResultCount.textContent =
            `${
                data?.mwanikiSources?.length || 0
            } source${
                (
                    data?.mwanikiSources?.length ||
                    0
                ) === 1
                    ? ""
                    : "s"
            }`;


        renderMwanikiAnswer(
            data
        );


        renderMwanikiSources(
            data
        );


        renderWebResults(
            data
        );


        renderImages(
            data
        );


        setStatus(
            "Ready"
        );


        if (
            data?.answer?.confidence ===
            "web"
        ) {

            setSearchStatus(
                "The internal material did not provide a sufficient answer, so Mwaniki AI used the available web results."
            );

        } else {

            setSearchStatus(
                "Answer built from Mwaniki Scholars learning material."
            );
        }


        /*
         * Do not automatically force speech after every search.
         * Browsers can block speech after asynchronous operations.
         * The visible Read answer aloud button gives a reliable
         * user interaction.
         */

    } catch (error) {

        console.error(
            "Mwaniki AI search failed:",
            error
        );


        const message =
            error?.name ===
            "AbortError"

                ? "The AI search took too long. Please try again."

                : (
                    error?.message ||
                    "Mwaniki AI could not complete the search."
                );


        aiAnswer.innerHTML = `

            <div class="error-box">

                <strong>
                    Mwaniki AI could not complete this search.
                </strong>

                <br><br>

                ${escapeHTML(message)}

            </div>
        `;


        setSearchStatus(
            "Search failed. Check the browser console and Edge Function deployment if this continues."
        );


        setStatus(
            "Error"
        );

    } finally {

        /*
         * Critical:
         * ALWAYS unlock the button.
         */

        askButton.disabled =
            false;
    }
}


// ============================================================
// SEARCH BUTTON
// ============================================================

askButton?.addEventListener(
    "click",
    () => {

        searchMwanikiAI(
            questionInput.value
        );
    }
);


// ============================================================
// CTRL/CMD + ENTER
// ============================================================

questionInput?.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            (event.ctrlKey ||
             event.metaKey)
        ) {

            event.preventDefault();

            searchMwanikiAI(
                questionInput.value
            );
        }
    }
);


// ============================================================
// SUGGESTIONS
// ============================================================

document
    .querySelectorAll(
        ".suggestion-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const question =
                        button.dataset.question ||
                        button.textContent.trim();


                    questionInput.value =
                        question;


                    searchMwanikiAI(
                        question
                    );
                }
            );
        }
    );


// ============================================================
// GLOBAL HELPERS
// ============================================================

window.askMwanikiAI =
    searchMwanikiAI;


window.askAI =
    searchMwanikiAI;


window.stopMwanikiAudio =
    stopSpeech;


console.log(
    "✅ Mwaniki AI search interface initialized."
);
