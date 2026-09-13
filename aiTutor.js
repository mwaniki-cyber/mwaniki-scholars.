```javascript
import { supabase } from "./supabase.js";

/*
============================================================
 MWANIKI SCHOLARS
 MWANIKI AI — STUDENT INTERFACE
============================================================

 PAGE ARCHITECTURE

 LEFT
 ├── Google Search
 └── Google Images

 RIGHT
 └── Mwaniki AI synthesized answer

 BELOW
 ├── Read Answer
 ├── Stop Audio
 └── Test Me

 SMART TEST
 ├── Question
 ├── Four options
 ├── Cartoon feedback
 ├── Voice reaction
 ├── Next Question
 └── Exit Test

 INTERNAL MWANIKI SOURCES
 └── NEVER DISPLAYED TO STUDENT
============================================================
*/


/* =========================================================
   ELEMENTS
========================================================= */

const questionInput =
    document.getElementById("aiQuestion");

const askButton =
    document.getElementById("askAIButton");

const answerArea =
    document.getElementById("aiAnswer");

const webResults =
    document.getElementById("webResults");

const imageArea =
    document.getElementById("aiImages");

const searchStatus =
    document.getElementById("aiSearchStatus");

const aiStatus =
    document.getElementById("aiStatus");

const liveStatusText =
    document.getElementById("aiLiveStatusText");

const googleSearchLink =
    document.getElementById("googleSearchLink");

const googleImagesLink =
    document.getElementById("googleImagesLink");

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

const testFeedbackCharacter =
    document.getElementById(
        "testFeedbackCharacter"
    );

const testFeedbackTitle =
    document.getElementById(
        "testFeedbackTitle"
    );

const testFeedbackText =
    document.getElementById(
        "testFeedbackText"
    );

const testNext =
    document.getElementById("testNext");

const testExit =
    document.getElementById("testExit");

const readAnswerButton =
    document.getElementById(
        "readAnswerButton"
    );

const stopAudioButton =
    document.getElementById(
        "stopAudioButton"
    );

const startTestButton =
    document.getElementById(
        "startTestButton"
    );

const backButton =
    document.getElementById(
        "backToDashboardButton"
    );



/* =========================================================
   STATE
========================================================= */

let latestAnswerText = "";

let currentTestTopic = "";

let currentTestNumber = 0;

let currentTestLength = 10;

let currentTestScore = 0;

let currentTestUsedIds = [];

let currentTestQuestion = null;

let testWaitingForAnswer = false;

let speechQueue = [];



/* =========================================================
   BASIC HELPERS
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function cleanText(value) {

    return String(value ?? "")
        .replace(/\r/g, "")
        .replace(/\u0000/g, "")
        .trim();

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

    } catch (_) {}

    return "#";

}


function showElement(element) {

    if (!element) return;

    element.classList.remove("hidden");

}


function hideElement(element) {

    if (!element) return;

    element.classList.add("hidden");

}


function setLiveStatus(text) {

    if (liveStatusText) {
        liveStatusText.textContent = text;
    }

}


function setStatus(
    element,
    message,
    visible = true
) {

    if (!element) return;

    if (!message) {

        element.innerHTML = "";

        hideElement(element);

        return;
    }

    element.innerHTML =
        `<div class="status-line">${escapeHTML(message)}</div>`;

    if (visible) {
        showElement(element);
    }

}



/* =========================================================
   TEXT → SAFE HTML
========================================================= */

function textToHTML(text) {

    const cleaned =
        cleanText(text);

    if (!cleaned) {
        return "";
    }

    let html =
        escapeHTML(cleaned);

    /*
    Headings
    */

    html = html.replace(
        /^###\s+(.+)$/gm,
        "<h4>$1</h4>"
    );

    html = html.replace(
        /^##\s+(.+)$/gm,
        "<h3>$1</h3>"
    );

    html = html.replace(
        /^#\s+(.+)$/gm,
        "<h2>$1</h2>"
    );

    /*
    Bold
    */

    html = html.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
    );

    /*
    Bullet lines
    */

    html = html.replace(
        /^[•*-]\s+(.+)$/gm,
        "<li>$1</li>"
    );

    html = html.replace(
        /(<li>.*?<\/li>)(?:\s*<li>)/gs,
        "$1<li>"
    );

    /*
    Paragraphs
    */

    const blocks =
        html
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean);

    return blocks
        .map(block => {

            if (
                block.startsWith("<h2>") ||
                block.startsWith("<h3>") ||
                block.startsWith("<h4>")
            ) {
                return block;
            }

            if (block.startsWith("<li>")) {
                return `<ul>${block}</ul>`;
            }

            return `<p>${block.replace(/\n/g, "<br>")}</p>`;

        })
        .join("");

}



/* =========================================================
   RENDER AI ANSWER
========================================================= */

function renderAnswer(data) {

    if (!answerArea) return;

    const answer =
        cleanText(
            data?.answer ||
            data?.finalAnswer ||
            data?.mwanikiAnswer ||
            data?.webAnswer ||
            ""
        );

    latestAnswerText =
        answer;

    if (!answer) {

        answerArea.innerHTML = `
            <div class="answer-welcome">
                <div class="answer-avatar">
                    🤖
                </div>

                <div>
                    <h3>
                        I could not generate an answer yet.
                    </h3>

                    <p>
                        Try asking the question in another way.
                    </p>
                </div>
            </div>
        `;

        return;
    }


    answerArea.innerHTML = `

        <div class="ai-answer-label">
            🤖 Mwaniki AI Answer
        </div>

        <div class="ai-response-content">
            ${textToHTML(answer)}
        </div>

    `;

}



/* =========================================================
   GOOGLE SEARCH RESULTS
========================================================= */

function renderWebResults(results) {

    if (!webResults) return;

    const list =
        Array.isArray(results)
            ? results
            : [];

    if (!list.length) {

        webResults.innerHTML = `
            <div class="research-empty">
                <span>🔎</span>
                <p>
                    No relevant web results were found.
                </p>
            </div>
        `;

        return;
    }


    webResults.innerHTML =
        list
            .slice(0, 8)
            .map(result => {

                const title =
                    cleanText(
                        result?.title ||
                        "Medical result"
                    );

                const snippet =
                    cleanText(
                        result?.snippet ||
                        result?.description ||
                        ""
                    );

                const url =
                    safeURL(
                        result?.url ||
                        result?.link ||
                        result?.displayUrl ||
                        ""
                    );

                return `

                    <article class="web-result">

                        <a
                            href="${url}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <div class="web-result-title">
                                ${escapeHTML(title)}
                            </div>

                            ${
                                url !== "#"
                                ?
                                `
                                <span class="web-result-url">
                                    ${escapeHTML(url)}
                                </span>
                                `
                                :
                                ""
                            }

                            ${
                                snippet
                                ?
                                `
                                <div class="web-result-snippet">
                                    ${escapeHTML(snippet)}
                                </div>
                                `
                                :
                                ""
                            }

                        </a>

                    </article>
                `;

            })
            .join("");

}



/* =========================================================
   GOOGLE IMAGES
========================================================= */

function renderImages(images) {

    if (!imageArea) return;

    const list =
        Array.isArray(images)
            ? images
            : [];

    if (!list.length) {

        imageArea.innerHTML = `
            <div class="research-empty">
                <span>🖼️</span>
                <p>
                    No relevant images were found.
                </p>
            </div>
        `;

        return;
    }


    const cards =
        list
            .slice(0, 8)
            .map(image => {

                const imageURL =
                    safeURL(
                        image?.imageUrl ||
                        image?.url ||
                        image?.thumbnail ||
                        image?.src ||
                        ""
                    );

                const pageURL =
                    safeURL(
                        image?.pageUrl ||
                        image?.sourceUrl ||
                        image?.contextLink ||
                        image?.link ||
                        imageURL
                    );

                const title =
                    cleanText(
                        image?.title ||
                        image?.caption ||
                        "Medical image"
                    );

                if (imageURL === "#") {
                    return "";
                }

                return `

                    <article class="ai-image-card">

                        <a
                            href="${pageURL}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <img
                                src="${imageURL}"
                                alt="${escapeHTML(title)}"
                                loading="lazy"
                                referrerpolicy="no-referrer"
                                onerror="this.closest('.ai-image-card').remove();"
                            >

                            <div class="ai-image-caption">
                                ${escapeHTML(title)}
                            </div>

                        </a>

                    </article>

                `;

            })
            .filter(Boolean)
            .join("");


    if (!cards) {

        imageArea.innerHTML = `
            <div class="research-empty">
                <span>🖼️</span>
                <p>
                    Images could not be displayed.
                </p>
            </div>
        `;

        return;
    }


    imageArea.innerHTML = `

        <div class="image-results-grid">
            ${cards}
        </div>

    `;

}



/* =========================================================
   GOOGLE LINKS
========================================================= */

function updateGoogleLinks(data, question) {

    const searchURL =
        data?.googleSearchUrl ||
        data?.googleSearchURL ||
        data?.searchUrl ||
        "";

    const imagesURL =
        data?.googleImagesUrl ||
        data?.googleImagesURL ||
        data?.imagesUrl ||
        "";


    if (
        googleSearchLink &&
        searchURL
    ) {

        googleSearchLink.href =
            safeURL(searchURL);

        showElement(
            googleSearchLink
        );

    } else if (googleSearchLink) {

        const query =
            encodeURIComponent(
                question
            );

        googleSearchLink.href =
            `https://www.google.com/search?q=${query}`;

        showElement(
            googleSearchLink
        );

    }


    if (
        googleImagesLink &&
        imagesURL
    ) {

        googleImagesLink.href =
            safeURL(imagesURL);

        showElement(
            googleImagesLink
        );

    } else if (googleImagesLink) {

        const query =
            encodeURIComponent(
                question
            );

        googleImagesLink.href =
            `https://www.google.com/search?tbm=isch&q=${query}`;

        showElement(
            googleImagesLink
        );

    }

}



/* =========================================================
   INVOKE EDGE FUNCTION
========================================================= */

async function invokeAI(body) {

    const {
        data,
        error
    } = await supabase.functions.invoke(
        "mwaniki-ai",
        {
            body
        }
    );


    if (error) {

        console.error(
            "Mwaniki AI error:",
            error
        );

        throw error;
    }


    return data;
}



/* =========================================================
   SEARCH
========================================================= */

async function searchAI() {

    if (!questionInput) return;

    const question =
        cleanText(
            questionInput.value
        );

    if (!question) {

        questionInput.focus();

        return;
    }


    askButton.disabled =
        true;

    setLiveStatus(
        "Researching..."
    );


    setStatus(
        searchStatus,
        "Researching your medical question...",
        true
    );


    setStatus(
        aiStatus,
        "",
        false
    );


    answerArea.innerHTML = `

        <div class="answer-welcome">

            <div class="answer-avatar">
                🔬
            </div>

            <div>

                <h3>
                    Researching...
                </h3>

                <p>
                    Mwaniki AI is preparing your answer.
                </p>

            </div>

        </div>

    `;


    webResults.innerHTML = `
        <div class="research-empty">
            <span>🔎</span>
            <p>
                Searching the web...
            </p>
        </div>
    `;


    imageArea.innerHTML = `
        <div class="research-empty">
            <span>🖼️</span>
            <p>
                Searching medical images...
            </p>
        </div>
    `;


    try {

        const data =
            await invokeAI({

                mode:
                    "search",

                question,

                searchWeb:
                    true,

                searchMwaniki:
                    true,

                searchImages:
                    true

            });


        console.log(
            "Mwaniki AI response:",
            data
        );


        renderAnswer(
            data
        );


        renderWebResults(
            data?.webResults
        );


        renderImages(
            data?.images
        );


        updateGoogleLinks(
            data,
            question
        );


        setStatus(
            searchStatus,
            "",
            false
        );


        setLiveStatus(
            "Ready"
        );


    } catch (error) {

        console.error(
            error
        );


        answerArea.innerHTML = `

            <div class="answer-welcome">

                <div class="answer-avatar">
                    ⚠️
                </div>

                <div>

                    <h3>
                        Mwaniki AI could not complete the request.
                    </h3>

                    <p>
                        Please check your connection and try again.
                    </p>

                </div>

            </div>

        `;


        setStatus(
            searchStatus,
            error?.message ||
            "Unable to contact Mwaniki AI.",
            true
        );


        setLiveStatus(
            "Connection problem"
        );

    } finally {

        askButton.disabled =
            false;

    }

}



/* =========================================================
   SPEECH
========================================================= */

function stopSpeech() {

    if (
        "speechSynthesis"
        in window
    ) {

        window.speechSynthesis.cancel();

    }

    speechQueue = [];

    setLiveStatus(
        "Ready"
    );

}


function speak(text) {

    stopSpeech();

    const cleaned =
        cleanText(text);

    if (!cleaned) {
        return;
    }


    if (
        !("speechSynthesis" in window)
    ) {

        setStatus(
            aiStatus,
            "Voice playback is not supported by this browser.",
            true
        );

        return;
    }


    const utterance =
        new SpeechSynthesisUtterance(
            cleaned
        );


    utterance.rate =
        0.94;

    utterance.pitch =
        1.0;

    utterance.volume =
        1.0;


    utterance.onstart =
        () => {

            setLiveStatus(
                "Reading..."
            );

        };


    utterance.onend =
        () => {

            setLiveStatus(
                "Ready"
            );

        };


    utterance.onerror =
        () => {

            setLiveStatus(
                "Ready"
            );

        };


    window.speechSynthesis.speak(
        utterance
    );

}



/* =========================================================
   CARTOON VOICES
========================================================= */

function cartoonWrongAnswer() {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }


    const phrases = [

        "Oops! Not quite! Try again, Scholar!",

        "Almost! That one needs another look!",

        "Not this time! Think carefully, Scholar!",

        "Oops! Your medical detective work needs another clue!",

        "Close one! Let's sharpen that knowledge!"

    ];


    const phrase =
        phrases[
            Math.floor(
                Math.random() *
                phrases.length
            )
        ];


    const voice =
        new SpeechSynthesisUtterance(
            phrase
        );


    voice.rate =
        1.25;

    voice.pitch =
        1.65;

    voice.volume =
        1;


    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(
        voice
    );

}


function cartoonCorrectAnswer() {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }


    const phrases = [

        "Excellent! That is correct!",

        "Brilliant work, Scholar!",

        "Correct! Mwaniki Scholar power!",

        "Well done! You got it!",

        "Outstanding! Keep going!"

    ];


    const phrase =
        phrases[
            Math.floor(
                Math.random() *
                phrases.length
            )
        ];


    const voice =
        new SpeechSynthesisUtterance(
            phrase
        );


    voice.rate =
        1.18;

    voice.pitch =
        1.55;

    voice.volume =
        1;


    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(
        voice
    );

}



/* =========================================================
   TEST HELPERS
========================================================= */

function normalizeCorrectKey(
    question
) {

    const raw =
        cleanText(
            question?.correctKey ||
            question?.correct_answer ||
            question?.correctAnswer ||
            ""
        );


    if (
        /^[ABCD]$/i.test(raw)
    ) {

        return raw.toUpperCase();

    }


    const options =
        Array.isArray(
            question?.options
        )
            ? question.options
            : [];


    const index =
        options.findIndex(
            option =>
                cleanText(
                    option
                ).toLowerCase() ===
                raw.toLowerCase()
        );


    if (index >= 0) {

        return String.fromCharCode(
            65 + index
        );

    }


    return null;

}



function normalizeTestQuestion(
    question
) {

    if (!question) {
        return null;
    }


    const options =
        Array.isArray(
            question.options
        )
            ? question.options
                .map(
                    option =>
                        cleanText(option)
                )
                .filter(Boolean)
            : [];


    if (
        options.length !== 4
    ) {

        return null;

    }


    const correctKey =
        normalizeCorrectKey(
            question
        );


    if (
        !correctKey
    ) {

        return null;

    }


    return {

        id:
            String(
                question.id ||
                question.questionId ||
                Date.now()
            ),

        question:
            cleanText(
                question.question
            ),

        options,

        correctKey,

        correctAnswer:
            cleanText(
                question.correctAnswer ||
                options[
                    correctKey.charCodeAt(0) - 65
                ]
            ),

        explanation:
            cleanText(
                question.explanation ||
                ""
            )

    };

}



/* =========================================================
   TEST FEEDBACK
========================================================= */

function showTestFeedback(
    correct,
    question
) {

    showElement(
        testFeedback
    );


    if (correct) {

        testFeedbackCharacter.textContent =
            "🎉";

        testFeedbackTitle.textContent =
            "Excellent work!";

        testFeedbackText.textContent =
            question.explanation ||
            "Your answer is correct.";

        testFeedback.style.background =
            "rgba(60,190,130,.18)";


        cartoonCorrectAnswer();

    } else {

        testFeedbackCharacter.textContent =
            "🤖";

        testFeedbackTitle.textContent =
            "Not quite!";

        testFeedbackText.textContent =
            question.explanation ||
            `The correct answer is ${question.correctAnswer}.`;

        testFeedback.style.background =
            "rgba(220,80,80,.18)";


        cartoonWrongAnswer();

    }

}



/* =========================================================
   RENDER TEST QUESTION
========================================================= */

function renderTestQuestion(
    question
) {

    currentTestQuestion =
        question;

    testWaitingForAnswer =
        true;


    hideElement(
        testFeedback
    );


    testQuestion.innerHTML =
        `<div>${textToHTML(question.question)}</div>`;


    testOptions.innerHTML =
        question.options
            .map(
                (option, index) => {

                    const key =
                        String.fromCharCode(
                            65 + index
                        );

                    return `

                        <button
                            type="button"
                            class="test-option"
                            data-key="${key}"
                        >

                            <strong>
                                ${key}.
                            </strong>

                            ${escapeHTML(option)}

                        </button>

                    `;

                }
            )
            .join("");


    testProgress.textContent =
        `Question ${currentTestNumber} of ${currentTestLength}`;


    testOptions
        .querySelectorAll(
            ".test-option"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        answerTestQuestion(
                            button.dataset.key
                        );

                    }
                );

            }
        );

}



/* =========================================================
   ANSWER TEST QUESTION
========================================================= */

function answerTestQuestion(
    selectedKey
) {

    if (
        !currentTestQuestion ||
        !testWaitingForAnswer
    ) {
        return;
    }


    testWaitingForAnswer =
        false;


    const correctKey =
        currentTestQuestion.correctKey;


    const correct =
        selectedKey ===
        correctKey;


    if (correct) {

        currentTestScore++;

    }


    currentTestUsedIds.push(
        currentTestQuestion.id
    );


    testOptions
        .querySelectorAll(
            ".test-option"
        )
        .forEach(
            button => {

                button.disabled =
                    true;


                if (
                    button.dataset.key ===
                    correctKey
                ) {

                    button.classList.add(
                        "correct"
                    );

                }


                if (
                    button.dataset.key ===
                    selectedKey &&
                    selectedKey !==
                    correctKey
                ) {

                    button.classList.add(
                        "wrong"
                    );

                }

            }
        );


    showTestFeedback(
        correct,
        currentTestQuestion
    );


    if (
        currentTestNumber >=
        currentTestLength
    ) {

        testStatus.textContent =
            `Test complete — score: ${currentTestScore}/${currentTestLength}`;

        testNext.textContent =
            "Finish Test";

    } else {

        testStatus.textContent =
            correct
                ? "Correct answer."
                : "Review the explanation and continue.";

    }

}



/* =========================================================
   LOAD TEST QUESTION
========================================================= */

async function loadNextTestQuestion() {

    testWaitingForAnswer =
        false;


    testQuestion.innerHTML = `
        <div class="research-empty">
            <span>🧠</span>
            <p>
                Preparing your question...
            </p>
        </div>
    `;


    testOptions.innerHTML =
        "";


    hideElement(
        testFeedback
    );


    testNext.disabled =
        true;


    try {

        const data =
            await invokeAI({

                mode:
                    "test",

                testTopic:
                    currentTestTopic,

                usedQuestionIds:
                    currentTestUsedIds,

                questionNumber:
                    currentTestNumber,

                testLength:
                    currentTestLength,

                searchMwaniki:
                    true,

                searchWeb:
                    true,

                searchImages:
                    false

            });


        const question =
            normalizeTestQuestion(
                data?.testQuestion
            );


        if (!question) {

            testQuestion.innerHTML = `
                <div class="test-question">
                    I could not create a reliable question
                    for this topic yet.
                </div>
            `;

            testStatus.textContent =
                "Try another topic or ask Mwaniki AI first.";

            testNext.disabled =
                false;

            testNext.textContent =
                "Try Again";

            return;

        }


        currentTestNumber++;

        renderTestQuestion(
            question
        );


        testStatus.textContent =
            "Choose the best answer.";


    } catch (error) {

        console.error(
            "Test question error:",
            error
        );


        testQuestion.innerHTML = `
            <div class="test-question">
                The test question could not be loaded.
            </div>
        `;


        testStatus.textContent =
            error?.message ||
            "Unable to load the next question.";

    } finally {

        testNext.disabled =
            false;

    }

}



/* =========================================================
   START TEST
========================================================= */

async function startTest() {

    const topic =
        cleanText(
            questionInput.value ||
            latestAnswerText
        );


    if (!topic) {

        questionInput.focus();

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

    currentTestQuestion =
        null;


    showElement(
        testPanel
    );


    testStatus.textContent =
        "Preparing your medical test...";


    testProgress.textContent =
        `Question 0 of ${currentTestLength}`;


    testQuestion.innerHTML =
        "";


    testOptions.innerHTML =
        "";


    hideElement(
        testFeedback
    );


    testNext.textContent =
        "Next Question →";


    testPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    await loadNextTestQuestion();

}



/* =========================================================
   NEXT QUESTION
========================================================= */

async function nextTestQuestion() {

    if (
        currentTestNumber >=
        currentTestLength &&
        !testWaitingForAnswer
    ) {

        testStatus.textContent =
            `Final score: ${currentTestScore}/${currentTestLength}`;

        testNext.textContent =
            "Restart Test";

        testNext.onclick =
            () => {

                testNext.onclick =
                    null;

                startTest();

            };

        return;

    }


    if (
        testWaitingForAnswer
    ) {

        testStatus.textContent =
            "Choose an answer before continuing.";

        return;

    }


    await loadNextTestQuestion();

}



/* =========================================================
   EXIT TEST
========================================================= */

function exitTest() {

    stopSpeech();


    hideElement(
        testPanel
    );


    currentTestTopic =
        "";

    currentTestNumber =
        0;

    currentTestScore =
        0;

    currentTestUsedIds =
        [];

    currentTestQuestion =
        null;

    testQuestion.innerHTML =
        "";

    testOptions.innerHTML =
        "";

    testStatus.textContent =
        "";

    hideElement(
        testFeedback
    );


    setLiveStatus(
        "Ready"
    );

}



/* =========================================================
   SUGGESTION BUTTONS
========================================================= */

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
                        "";

                    questionInput.value =
                        question;

                    questionInput.focus();

                }
            );

        }
    );



/* =========================================================
   EVENT LISTENERS
========================================================= */

if (askButton) {

    askButton.addEventListener(
        "click",
        searchAI
    );

}


if (questionInput) {

    questionInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey)
            ) {

                event.preventDefault();

                searchAI();

            }

        }
    );

}


if (readAnswerButton) {

    readAnswerButton.addEventListener(
        "click",
        () => {

            speak(
                latestAnswerText
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


if (startTestButton) {

    startTestButton.addEventListener(
        "click",
        startTest
    );

}


if (testNext) {

    testNext.addEventListener(
        "click",
        nextTestQuestion
    );

}


if (testExit) {

    testExit.addEventListener(
        "click",
        exitTest
    );

}


if (backButton) {

    backButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "./dashboard.html";

        }
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
        () =>
            speak(
                latestAnswerText
            ),

    stopSpeech:
        stopSpeech,

    exitTest:
        exitTest

};



/* =========================================================
   INITIAL STATE
========================================================= */

setLiveStatus(
    "Ready"
);

console.log(
    "🤖 Mwaniki AI interface loaded."
);
```
