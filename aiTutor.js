````javascript
import { supabase } from "./supabase.js";

console.log("🚀 Mwaniki AI Tutor loaded");

// =====================================================
// ELEMENTS
// =====================================================

const aiQuestion =
    document.getElementById("aiQuestion");

const askAIButton =
    document.getElementById("askAIButton");

const aiAnswer =
    document.getElementById("aiAnswer");

const aiSearchStatus =
    document.getElementById("aiSearchStatus");

const aiStatus =
    document.getElementById("aiStatus");

const aiImages =
    document.getElementById("aiImages");

const mwanikiSources =
    document.getElementById("mwanikiSources");

const webResults =
    document.getElementById("webResults");

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

const backToDashboardButton =
    document.getElementById("backToDashboardButton");


// =====================================================
// STATE
// =====================================================

let currentAnswerText = "";

let currentTestTopic = "";

let currentTestQuestion = null;

let currentTestNumber = 0;

let currentTestLength = 10;

let currentTestScore = 0;

let currentTestUsedIds = [];

let testAnswered = false;

let currentSpeech = null;


// =====================================================
// HTML ESCAPING
// =====================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// URL SAFETY
// =====================================================

function safeURL(value) {

    try {

        const url =
            new URL(
                String(value || ""),
                window.location.href
            );

        if (
            url.protocol === "http:" ||
            url.protocol === "https:"
        ) {
            return url.href;
        }

    } catch (_) {
        return "";
    }

    return "";
}


// =====================================================
// CLEAN AI TEXT
// =====================================================

function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    let text =
        String(value);

    text =
        text.replace(
            /```(?:markdown|md|text)?/gi,
            ""
        );

    text =
        text.replace(
            /```/g,
            ""
        );

    text =
        text.replace(
            /^#{1,6}\s*/gm,
            ""
        );

    text =
        text.replace(
            /\*\*(.*?)\*\*/g,
            "$1"
        );

    text =
        text.replace(
            /__(.*?)__/g,
            "$1"
        );

    text =
        text.replace(
            /\s+\n/g,
            "\n"
        );

    text =
        text.replace(
            /\n{3,}/g,
            "\n\n"
        );

    return text.trim();
}


// =====================================================
// TEXT → SAFE HTML
// =====================================================

function textToHTML(value) {

    const text =
        cleanText(value);

    if (!text) {
        return "";
    }

    const paragraphs =
        text
            .split(/\n{2,}/)
            .map(
                item =>
                    item
                        .trim()
                        .replace(/\n/g, " ")
            )
            .filter(Boolean);

    return paragraphs
        .map(
            paragraph =>
                `<p>${escapeHTML(paragraph)}</p>`
        )
        .join("");
}


// =====================================================
// STATUS
// =====================================================

function setSearchStatus(message) {

    if (!aiSearchStatus) {
        return;
    }

    if (!message) {

        aiSearchStatus.classList.add(
            "hidden"
        );

        aiSearchStatus.innerHTML = "";

        return;
    }

    aiSearchStatus.classList.remove(
        "hidden"
    );

    aiSearchStatus.innerHTML = `
        <div class="status-line">
            ${escapeHTML(message)}
        </div>
    `;
}


function setStatus(message) {

    if (!aiStatus) {
        return;
    }

    if (!message) {

        aiStatus.classList.add(
            "hidden"
        );

        aiStatus.innerHTML = "";

        return;
    }

    aiStatus.classList.remove(
        "hidden"
    );

    aiStatus.innerHTML = `
        <div class="status-line">
            ${escapeHTML(message)}
        </div>
    `;
}


// =====================================================
// BUTTON STATE
// =====================================================

function setBusy(busy) {

    if (!askAIButton) {
        return;
    }

    askAIButton.disabled =
        busy;

    askAIButton.innerHTML =
        busy
            ? `
                <span>Researching...</span>
                <span>⌛</span>
              `
            : `
                <span>Ask Mwaniki AI</span>
                <span>➤</span>
              `;
}


// =====================================================
// SPEECH
// =====================================================

function stopSpeech() {

    if (
        "speechSynthesis" in window
    ) {
        window.speechSynthesis.cancel();
    }

    currentSpeech = null;
}


function speak(text) {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }

    const clean =
        cleanText(text);

    if (!clean) {
        return;
    }

    stopSpeech();

    currentSpeech =
        new SpeechSynthesisUtterance(
            clean
        );

    currentSpeech.lang =
        "en-US";

    currentSpeech.rate =
        0.95;

    currentSpeech.pitch =
        1.0;

    currentSpeech.volume =
        1.0;

    window.speechSynthesis.speak(
        currentSpeech
    );
}


// =====================================================
// VERY LARGE CARTOON LAUGH
// =====================================================

const hugeLaughChunks = [

    "HEE HEE HEE HEE!",

    "AHAHAHAHAHAHAHAHA!",

    "HAHAHAHAHAHAHAHAHAHAHAHA!",

    "HEEEEEHEHEHEHEHEHEHEHE!",

    "AHAHAHAHAHAHAHAHAHAHAHAHAHAHA!",

    "HEE HEE HEE HEE HEE HEE!",

    "AHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHA!"
];


const funnyWrongAnswerReactions = [

    "Oops! That answer took a wrong turn.",

    "Oof! That one missed the mark.",

    "Whoops! The neurons disagreed with that one.",

    "Aha! Nice attempt, but not quite.",

    "Plot twist! That wasn't the answer.",

    "The brain says: try again!",

    "That answer wandered off the syllabus.",

    "Close! But the textbook isn't celebrating yet.",

    "Oops! That one needs a little resuscitation.",

    "Not quite! Let's correct that one.",

    "The neurons have filed an objection.",

    "Almost! Your answer took the scenic route.",

    "That one needs another trip through the lecture notes.",

    "Interesting choice! Let's fix that one.",

    "Nearly there! Let's see what happened."

];


let funnyReactionPool =
    [
        ...funnyWrongAnswerReactions
    ];


function getRandomFunnyReaction() {

    if (
        funnyReactionPool.length === 0
    ) {

        funnyReactionPool =
            [
                ...funnyWrongAnswerReactions
            ];
    }

    const index =
        Math.floor(
            Math.random() *
            funnyReactionPool.length
        );

    return funnyReactionPool
        .splice(index, 1)[0];
}


function speakHugeSqueakyLaugh(
    reaction
) {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }

    stopSpeech();

    let index = 0;

    const speakNextLaugh =
        () => {

            if (
                index >=
                hugeLaughChunks.length
            ) {

                const reactionUtterance =
                    new SpeechSynthesisUtterance(
                        reaction
                    );

                reactionUtterance.lang =
                    "en-US";

                reactionUtterance.rate =
                    1.18;

                reactionUtterance.pitch =
                    1.65;

                reactionUtterance.volume =
                    1.0;

                window.speechSynthesis.speak(
                    reactionUtterance
                );

                return;
            }

            const laugh =
                hugeLaughChunks[index++];

            const utterance =
                new SpeechSynthesisUtterance(
                    laugh
                );

            utterance.lang =
                "en-US";

            utterance.rate =
                index % 2 === 0
                    ? 1.48
                    : 1.38;

            utterance.pitch =
                2.0;

            utterance.volume =
                1.0;

            utterance.onend =
                speakNextLaugh;

            window.speechSynthesis.speak(
                utterance
            );
        };

    speakNextLaugh();
}


// =====================================================
// RENDER WEB IMAGE DIRECTLY
// =====================================================

function renderDirectImage(
    image
) {

    if (
        !aiImages ||
        !image
    ) {
        return;
    }

    const imageURL =
        safeURL(
            image.url ||
            image.imageUrl ||
            image.src
        );

    if (!imageURL) {
        return;
    }

    const title =
        image.title ||
        "Medical visual";

    const source =
        image.source ||
        image.provider ||
        "Web image source";

    const sourceURL =
        safeURL(
            image.sourceUrl ||
            image.pageUrl ||
            image.link
        );

    aiImages.classList.remove(
        "hidden"
    );

    aiImages.innerHTML = `

        <div class="ai-image-card">

            <img
                src="${escapeHTML(imageURL)}"
                alt="${escapeHTML(title)}"
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror="this.closest('.ai-image-card').remove();"
            >

            <div class="ai-image-caption">

                <strong>
                    Medical visual
                </strong>

                <br>

                ${
                    sourceURL
                        ? `
                            Source:
                            <a
                                href="${escapeHTML(sourceURL)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ${escapeHTML(source)}
                            </a>
                          `
                        : `
                            Source:
                            ${escapeHTML(source)}
                          `
                }

            </div>

        </div>
    `;
}


// =====================================================
// RENDER WEB EVIDENCE
// =====================================================

function renderWebResults(
    results
) {

    if (
        !webResults
    ) {
        return;
    }

    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {

        webResults.classList.add(
            "hidden"
        );

        webResults.innerHTML = "";

        return;
    }

    const items =
        results
            .slice(0, 8)
            .map(
                result => {

                    const title =
                        result.title ||
                        "Web source";

                    const url =
                        safeURL(
                            result.url ||
                            result.link
                        );

                    const displayURL =
                        result.displayUrl ||
                        result.url ||
                        "";

                    const snippet =
                        cleanText(
                            result.snippet ||
                            result.description ||
                            ""
                        );

                    return `

                        <div class="web-result">

                            ${
                                url
                                    ? `
                                        <a
                                            class="web-result-title"
                                            href="${escapeHTML(url)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            ${escapeHTML(title)}
                                        </a>
                                      `
                                    : `
                                        <div class="web-result-title">
                                            ${escapeHTML(title)}
                                        </div>
                                      `
                            }

                            ${
                                displayURL
                                    ? `
                                        <span class="web-result-url">
                                            ${escapeHTML(displayURL)}
                                        </span>
                                      `
                                    : ""
                            }

                            ${
                                snippet
                                    ? `
                                        <div class="web-result-snippet">
                                            ${escapeHTML(snippet)}
                                        </div>
                                      `
                                    : ""
                            }

                        </div>
                    `;
                }
            )
            .join("");

    webResults.classList.remove(
        "hidden"
    );

    webResults.innerHTML = `

        <div class="evidence-card">

            <h3>
                Web evidence used
            </h3>

            ${items}

        </div>
    `;
}


// =====================================================
// RENDER MWANIKI SOURCES
// =====================================================

function renderMwanikiSources(
    sources
) {

    if (
        !mwanikiSources
    ) {
        return;
    }

    if (
        !Array.isArray(sources) ||
        sources.length === 0
    ) {

        mwanikiSources.classList.add(
            "hidden"
        );

        mwanikiSources.innerHTML = "";

        return;
    }

    const items =
        sources
            .slice(0, 10)
            .map(
                source => {

                    const title =
                        source.title ||
                        source.unit ||
                        source.course ||
                        "Mwaniki Scholars";

                    const detail =
                        source.detail ||
                        source.description ||
                        source.unit ||
                        "";

                    return `

                        <div
                            style="
                                padding:10px 0;
                                border-bottom:1px solid #e4edf1;
                            "
                        >

                            <strong>
                                ${escapeHTML(title)}
                            </strong>

                            ${
                                detail
                                    ? `
                                        <div
                                            style="
                                                margin-top:4px;
                                                color:#6a7c89;
                                                font-size:13px;
                                            "
                                        >
                                            ${escapeHTML(detail)}
                                        </div>
                                      `
                                    : ""
                            }

                        </div>
                    `;
                }
            )
            .join("");

    mwanikiSources.classList.remove(
        "hidden"
    );

    mwanikiSources.innerHTML = `

        <div class="evidence-card">

            <h3>
                Mwaniki Scholars material
            </h3>

            ${items}

        </div>
    `;
}


// =====================================================
// RENDER MAIN ANSWER
// =====================================================

function renderAnswer(
    response
) {

    if (!aiAnswer) {
        return;
    }

    const answer =
        response.answer ||
        response.mwanikiAnswer ||
        response.finalAnswer ||
        response.webAnswer ||
        "";

    const cleaned =
        cleanText(
            typeof answer === "string"
                ? answer
                : JSON.stringify(answer)
        );

    currentAnswerText =
        cleaned;

    const title =
        response.answerTitle ||
        "Mwaniki AI Answer";

    const sourceCount =
        Number(
            response.webResultCount ||
            0
        );

    const mwanikiCount =
        Number(
            response.mwanikiSourceCount ||
            (
                Array.isArray(
                    response.mwanikiSources
                )
                    ? response.mwanikiSources.length
                    : 0
            )
        );

    const paragraphs =
        textToHTML(
            cleaned
        );

    const webLabel =
        sourceCount > 0
            ? `${sourceCount} web sources`
            : "Web research";

    const mwanikiLabel =
        mwanikiCount > 0
            ? `${mwanikiCount} Mwaniki sources`
            : "Mwaniki content";

    aiAnswer.innerHTML = `

        <div class="answer-card">

            <div class="answer-header">

                <h2>
                    ${escapeHTML(title)}
                </h2>

                <span class="answer-badge">
                    Research synthesis
                </span>

            </div>


            <div class="answer-body">

                ${paragraphs}

            </div>


            <div class="answer-actions">

                <button
                    type="button"
                    class="small-button"
                    id="readMainAnswerButton"
                >
                    🔊 Read Answer
                </button>


                <button
                    type="button"
                    class="small-button"
                    id="stopMainAudioButton"
                >
                    ⏹ Stop
                </button>

            </div>


            <div
                class="evidence-grid"
                style="padding:0 22px 22px;"
            >

                <div class="evidence-card">

                    <h3>
                        Web research
                    </h3>

                    <p>
                        ${escapeHTML(webLabel)}
                    </p>

                </div>


                <div class="evidence-card">

                    <h3>
                        Mwaniki Scholars
                    </h3>

                    <p>
                        ${escapeHTML(mwanikiLabel)}
                    </p>

                </div>

            </div>

        </div>
    `;


    const readButton =
        document.getElementById(
            "readMainAnswerButton"
        );

    const stopButton =
        document.getElementById(
            "stopMainAudioButton"
        );


    if (readButton) {

        readButton.addEventListener(
            "click",
            () => {

                speak(
                    currentAnswerText
                );

            }
        );
    }


    if (stopButton) {

        stopButton.addEventListener(
            "click",
            stopSpeech
        );
    }
}


// =====================================================
// AUTH
// =====================================================

async function getAccessToken() {

    const {
        data,
        error
    } =
        await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    const session =
        data?.session;

    if (!session?.access_token) {

        throw new Error(
            "Your student session has expired. Please log in again."
        );
    }

    return session.access_token;
}


// =====================================================
// CALL EDGE FUNCTION
// =====================================================

async function callMwanikiAI(
    payload
) {

    const token =
        await getAccessToken();

    const {
        data,
        error
    } =
        await supabase.functions.invoke(
            "mwaniki-ai",
            {
                body: payload,
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    if (error) {
        throw error;
    }

    if (!data) {

        throw new Error(
            "The AI service returned no response."
        );
    }

    if (data.error) {

        throw new Error(
            data.error
        );
    }

    return data;
}


// =====================================================
// SEARCH
// =====================================================

async function searchAI(
    query
) {

    setBusy(true);

    setSearchStatus(
        "Searching Google/web first, then checking Mwaniki Scholars..."
    );

    setStatus("");

    if (aiAnswer) {
        aiAnswer.innerHTML = "";
    }

    if (aiImages) {

        aiImages.classList.add(
            "hidden"
        );

        aiImages.innerHTML = "";
    }

    if (mwanikiSources) {

        mwanikiSources.classList.add(
            "hidden"
        );

        mwanikiSources.innerHTML = "";
    }

    if (webResults) {

        webResults.classList.add(
            "hidden"
        );

        webResults.innerHTML = "";
    }


    try {

        const response =
            await callMwanikiAI({

                mode: "search",

                question: query,

                searchWeb: true,

                searchMwaniki: true,

                searchImages: true

            });


        renderAnswer(
            response
        );


        renderDirectImage(
            response.primaryImage ||
            (
                Array.isArray(
                    response.images
                )
                    ? response.images[0]
                    : null
            )
        );


        renderMwanikiSources(
            response.mwanikiSources
        );


        renderWebResults(
            response.webResults
        );


        setSearchStatus(
            "Research complete."
        );


        setStatus(
            "Mwaniki AI combined web evidence with Mwaniki Scholars material."
        );


    } catch (error) {

        console.error(
            "Mwaniki AI search error:",
            error
        );

        if (aiAnswer) {

            aiAnswer.innerHTML = `

                <div class="answer-card">

                    <div class="answer-header">

                        <h2>
                            Unable to complete research
                        </h2>

                    </div>

                    <div class="answer-body">

                        <p>
                            Mwaniki AI could not complete the
                            research request right now.
                        </p>

                        <p>
                            Please try the question again.
                        </p>

                    </div>

                </div>
            `;
        }

        setSearchStatus(
            ""
        );

        setStatus(
            error.message ||
            "AI research failed."
        );

    } finally {

        setBusy(false);
    }
}


// =====================================================
// WRONG ANSWER LAUGH
// =====================================================

function handleWrongAnswer(
    question
) {

    const reaction =
        getRandomFunnyReaction();

    speakHugeSqueakyLaugh(
        reaction
    );

    if (
        testFeedback &&
        question
    ) {

        testFeedback.innerHTML = `

            <strong>
                ${escapeHTML(reaction)}
            </strong>

            <br><br>

            The correct answer is:
            <strong>
                ${escapeHTML(
                    question.correctAnswer ||
                    ""
                )}
            </strong>

            ${
                question.explanation
                    ? `
                        <br><br>
                        ${escapeHTML(
                            cleanText(
                                question.explanation
                            )
                        )}
                      `
                    : ""
            }
        `;
    }
}


// =====================================================
// TEST QUESTION
// =====================================================

function renderTestQuestion(
    question
) {

    if (!question) {
        return;
    }

    currentTestQuestion =
        question;

    testAnswered =
        false;

    if (testProgress) {

        testProgress.textContent =
            `Question ${currentTestNumber} of ${currentTestLength}`;
    }

    if (testStatus) {
        testStatus.textContent = "";
    }

    if (testFeedback) {
        testFeedback.innerHTML = "";
    }

    if (testQuestion) {

        testQuestion.innerHTML = `

            <div
                style="
                    margin-top:16px;
                    font-size:19px;
                    line-height:1.55;
                    font-weight:800;
                "
            >
                ${escapeHTML(
                    question.question
                )}
            </div>
        `;
    }

    if (!testOptions) {
        return;
    }

    const options =
        Array.isArray(
            question.options
        )
            ? question.options
            : [];

    testOptions.innerHTML =
        options
            .map(
                option => `

                    <button
                        type="button"
                        class="test-option"
                        data-key="${escapeHTML(
                            option.key
                        )}"
                    >

                        <strong>
                            ${escapeHTML(
                                option.key
                            )}
                        </strong>

                        &nbsp;

                        ${escapeHTML(
                            option.text
                        )}

                    </button>
                `
            )
            .join("");


    testOptions
        .querySelectorAll(
            ".test-option"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        if (
                            testAnswered
                        ) {
                            return;
                        }

                        testAnswered =
                            true;

                        const selected =
                            button.dataset.key;

                        const correct =
                            String(
                                question.correctKey ||
                                ""
                            ).toUpperCase();

                        if (
                            selected ===
                            correct
                        ) {

                            currentTestScore++;

                            testFeedback.innerHTML = `

                                <strong>
                                    ✅ Correct!
                                </strong>

                                <br><br>

                                ${
                                    question.explanation
                                        ? escapeHTML(
                                            cleanText(
                                                question.explanation
                                            )
                                          )
                                        : "Good work."
                                }
                            `;

                            speak(
                                "Correct. " +
                                cleanText(
                                    question.explanation ||
                                    "Good work."
                                )
                            );

                        } else {

                            handleWrongAnswer(
                                question
                            );
                        }

                        testOptions
                            .querySelectorAll(
                                ".test-option"
                            )
                            .forEach(
                                optionButton => {

                                    optionButton.disabled =
                                        true;

                                    if (
                                        optionButton
                                            .dataset
                                            .key ===
                                        correct
                                    ) {

                                        optionButton.style.background =
                                            "rgba(56,190,120,.28)";
                                    }

                                }
                            );
                    }
                );
            }
        );
}


// =====================================================
// LOAD NEXT TEST QUESTION
// =====================================================

async function loadNextTestQuestion() {

    if (
        currentTestNumber >
        currentTestLength
    ) {

        finishTest();

        return;
    }

    if (testStatus) {

        testStatus.textContent =
            "Researching the next question...";
    }

    try {

        const response =
            await callMwanikiAI({

                mode: "test",

                testTopic:
                    currentTestTopic,

                usedQuestionIds:
                    currentTestUsedIds,

                questionNumber:
                    currentTestNumber,

                testLength:
                    currentTestLength,

                searchMwaniki: true,

                searchWeb: true,

                searchImages: false

            });


        const question =
            response.testQuestion;

        if (!question) {
            throw new Error(
                "No test question was returned."
            );
        }


        if (
            question.id !== undefined &&
            question.id !== null
        ) {

            currentTestUsedIds.push(
                String(question.id)
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

        if (testStatus) {

            testStatus.textContent =
                "The next question could not be loaded. Please try again.";
        }
    }
}


// =====================================================
// FINISH TEST
// =====================================================

function finishTest() {

    if (testQuestion) {

        testQuestion.innerHTML = `

            <div
                style="
                    font-size:24px;
                    font-weight:900;
                    margin-top:20px;
                "
            >
                Test completed
            </div>
        `;
    }

    if (testOptions) {
        testOptions.innerHTML = "";
    }

    if (testFeedback) {

        testFeedback.innerHTML = `

            <strong>
                Score: ${currentTestScore}/${currentTestLength}
            </strong>

            <br><br>

            ${
                Math.round(
                    (
                        currentTestScore /
                        currentTestLength
                    ) * 100
                )
            }%
        `;
    }

    if (testProgress) {
        testProgress.textContent =
            "Completed";
    }

    if (testStatus) {
        testStatus.textContent =
            "Well done. Start another test whenever you're ready.";
    }

    if (testNext) {
        testNext.disabled = true;
    }
}


// =====================================================
// START TEST
// =====================================================

async function startTest(
    topic,
    length = 10
) {

    currentTestTopic =
        topic;

    currentTestLength =
        Math.max(
            1,
            Math.min(
                Number(length) || 10,
                20
            )
        );

    currentTestNumber =
        1;

    currentTestScore =
        0;

    currentTestUsedIds =
        [];

    testAnswered =
        false;

    if (testPanel) {

        testPanel.classList.remove(
            "hidden"
        );
    }

    if (testNext) {
        testNext.disabled = false;
    }

    await loadNextTestQuestion();
}


// =====================================================
// EVENTS
// =====================================================

if (askAIButton) {

    askAIButton.addEventListener(
        "click",
        async () => {

            const query =
                aiQuestion
                    ?.value
                    ?.trim();

            if (!query) {

                setStatus(
                    "Please enter a medical question."
                );

                return;
            }

            await searchAI(
                query
            );
        }
    );
}


if (aiQuestion) {

    aiQuestion.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                askAIButton?.click();
            }
        }
    );
}


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

                    if (aiQuestion) {
                        aiQuestion.value =
                            question;
                    }

                    askAIButton?.click();
                }
            );
        }
    );


if (backToDashboardButton) {

    backToDashboardButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "./dashboard.html";
        }
    );
}


if (testNext) {

    testNext.addEventListener(
        "click",
        async () => {

            if (
                !testAnswered
            ) {
                return;
            }

            currentTestNumber++;

            if (
                currentTestNumber >
                currentTestLength
            ) {

                finishTest();

                return;
            }

            await loadNextTestQuestion();
        }
    );
}


if (testExit) {

    testExit.addEventListener(
        "click",
        () => {

            stopSpeech();

            testPanel?.classList.add(
                "hidden"
            );
        }
    );
}


// =====================================================
// GLOBAL ACCESS
// =====================================================

window.mwanikiAI = {
    search: searchAI,
    startTest,
    speak,
    stopSpeech
};
````
