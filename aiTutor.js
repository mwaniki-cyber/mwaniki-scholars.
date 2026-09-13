import { supabase } from "./supabase.js";


// =========================================================
// MWANIKI SCHOLARS
// AI TUTOR / ANSWER ENGINE / TEST ENGINE
// =========================================================

console.log(
    "🚀 Mwaniki AI interface loading..."
);


// =========================================================
// DOM
// =========================================================

const questionInput =
    document.getElementById("aiQuestion");

const askButton =
    document.getElementById("askAIButton");

const aiStatus =
    document.getElementById("aiStatus");

const searchStatus =
    document.getElementById("aiSearchStatus");

const answerArea =
    document.getElementById("aiAnswer");

const webResultsArea =
    document.getElementById("webResults");

const imageResultsArea =
    document.getElementById("aiImages");

const webResultCount =
    document.getElementById("webResultCount");

const testBody =
    document.getElementById("testBody");

const testProgress =
    document.getElementById("testProgress");

const startTestButton =
    document.getElementById("startTestButton");


// =========================================================
// STATE
// =========================================================

let lastSearchData = null;

let currentTest = null;

let testIndex = 0;

let testScore = 0;

let testLocked = false;


// =========================================================
// HTML SAFETY
// =========================================================

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
            new URL(String(value || ""));

        if (
            url.protocol === "http:" ||
            url.protocol === "https:"
        ) {

            return url.href;
        }

    } catch (_) {}

    return "#";
}


// =========================================================
// TEXT CLEANING
// =========================================================

function cleanText(value) {

    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}


function shortenText(
    value,
    maxLength = 420
) {

    const text =
        cleanText(value);

    if (
        text.length <= maxLength
    ) {

        return text;
    }

    return (
        text.slice(0, maxLength)
        + "…"
    );
}


// =========================================================
// STATUS
// =========================================================

function setStatus(
    message,
    busy = false
) {

    if (!aiStatus) {
        return;
    }

    aiStatus.innerHTML = `

        <span
            class="status-dot"
            style="
                background:
                ${busy ? "#d99a25" : "#1aaa83"};
            "
        ></span>

        ${escapeHTML(message)}

    `;
}


function setSearchStatus(message) {

    if (!searchStatus) {
        return;
    }

    searchStatus.textContent =
        message || "";
}


// =========================================================
// LOADING
// =========================================================

function showLoading() {

    answerArea.innerHTML = `

        <div class="loading-state">

            <div class="spinner"></div>

            <strong>
                Mwaniki AI is searching...
            </strong>

            <p>
                Checking Mwaniki Scholars learning
                material first.
            </p>

        </div>

    `;

    webResultsArea.innerHTML = `

        <div class="loading-state">

            Checking web results...

        </div>

    `;

    imageResultsArea.innerHTML = `

        <div
            class="loading-state"
            style="grid-column:1/-1;"
        >

            Searching visual material...

        </div>

    `;
}


// =========================================================
// INVOKE WITH TIMEOUT
// =========================================================

async function invokeWithTimeout(
    promise,
    timeoutMs
) {

    let timeoutId;

    const timeoutPromise =
        new Promise(
            (_, reject) => {

                timeoutId =
                    setTimeout(
                        () => {

                            reject(
                                new Error(
                                    "The search timed out."
                                )
                            );

                        },
                        timeoutMs
                    );

            }
        );

    try {

        return await Promise.race([
            promise,
            timeoutPromise
        ]);

    } finally {

        clearTimeout(timeoutId);
    }
}


// =========================================================
// ANSWER RENDERING
// =========================================================

function renderMwanikiAnswer(data) {

    const answer =
        data?.answer;

    if (
        !answer ||
        !cleanText(
            typeof answer === "string"
                ? answer
                : answer.text
        )
    ) {

        answerArea.innerHTML = `

            <div class="empty-state">

                Mwaniki Scholars does not currently
                contain a usable answer for this question.

                <br><br>

                The web search has been opened on the
                right-hand side instead.

            </div>

        `;

        return;
    }


    const answerText =
        typeof answer === "string"
            ? answer
            : answer.text;


    const title =
        typeof answer === "object"
            ? answer.title
            : "Answer";


    const sourceLabel =
        typeof answer === "object"
            ? answer.sourceLabel
            : "Mwaniki Scholars";


    const paragraphs =
        String(answerText)
            .split(/\n+/)
            .map(
                part => cleanText(part)
            )
            .filter(Boolean);


    answerArea.innerHTML = `

        <span class="source-badge">

            ${escapeHTML(sourceLabel)}

        </span>

        <h2 class="answer-title">

            ${escapeHTML(
                title || "Medical Answer"
            )}

        </h2>

        <p class="answer-subtitle">

            Retrieved from Mwaniki Scholars
            learning material.

        </p>

        <div class="answer-content">

            ${paragraphs
                .map(
                    paragraph =>
                        `<p>${escapeHTML(
                            paragraph
                        )}</p>`
                )
                .join("")}

        </div>

    `;
}


// =========================================================
// WEB RESULTS
// =========================================================

function renderWebResults(
    data,
    question
) {

    const results =
        Array.isArray(
            data?.webResults
        )
            ? data.webResults
            : [];


    const googleURL =
        safeURL(
            data?.googleSearchUrl
            || (
                "https://www.google.com/search?q="
                + encodeURIComponent(question)
            )
        );


    if (webResultCount) {

        webResultCount.textContent =
            results.length
                ? `${results.length} results`
                : "Google fallback";
    }


    if (!results.length) {

        webResultsArea.innerHTML = `

            <div class="empty-state">

                <strong>
                    Search results are available.
                </strong>

                <p>
                    Mwaniki Scholars did not return a
                    usable internal answer, so continue
                    with Google search for:
                </p>

                <strong>
                    ${escapeHTML(question)}
                </strong>

                <div class="google-fallback">

                    <p>
                        Open the full Google results
                        directly for this question.
                    </p>

                    <a
                        class="google-button"
                        href="${googleURL}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🔎 Search Google
                    </a>

                </div>

            </div>

        `;

        return;
    }


    webResultsArea.innerHTML = `

        ${results
            .map(
                result => {

                    const title =
                        cleanText(
                            result?.title
                            || result?.name
                            || "Web result"
                        );

                    const url =
                        safeURL(
                            result?.url
                            || result?.link
                            || result?.href
                        );

                    const snippet =
                        shortenText(
                            result?.snippet
                            || result?.description
                            || result?.text
                            || "",
                            500
                        );


                    return `

                        <article
                            class="web-result"
                        >

                            <a
                                href="${url}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ${escapeHTML(title)}
                            </a>

                            <div
                                class="web-result-url"
                            >
                                ${escapeHTML(
                                    url === "#"
                                        ? ""
                                        : url
                                )}
                            </div>

                            <div
                                class="web-result-snippet"
                            >
                                ${escapeHTML(
                                    snippet
                                )}
                            </div>

                        </article>

                    `;
                }
            )
            .join("")}

        <div class="google-fallback">

            <p>
                Want the complete Google search?
            </p>

            <a
                class="google-button"
                href="${googleURL}"
                target="_blank"
                rel="noopener noreferrer"
            >
                🔎 Open Google Results
            </a>

        </div>

    `;
}


// =========================================================
// IMAGE RESULTS
// =========================================================

function renderImages(data) {

    const images =
        Array.isArray(
            data?.images
        )
            ? data.images
            : [];


    if (!images.length) {

        imageResultsArea.innerHTML = `

            <div
                class="empty-state"
                style="grid-column:1/-1;"
            >

                No visual results were returned yet.

            </div>

        `;

        return;
    }


    imageResultsArea.innerHTML =
        images
            .slice(0, 12)
            .map(
                image => {

                    const imageURL =
                        safeURL(
                            image?.url
                            || image?.image
                            || image?.thumbnail
                        );

                    const title =
                        cleanText(
                            image?.title
                            || "Medical visual"
                        );


                    if (
                        imageURL === "#"
                    ) {

                        return "";
                    }


                    return `

                        <a
                            class="image-result"
                            href="${imageURL}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <img
                                src="${imageURL}"
                                alt="${escapeHTML(title)}"
                                loading="lazy"
                                onerror="
                                    this.parentElement
                                        .remove();
                                "
                            >

                            <span>
                                ${escapeHTML(title)}
                            </span>

                        </a>

                    `;
                }
            )
            .join("");
}


// =========================================================
// QUIZ DATA
// =========================================================

function getQuizQuestions(data) {

    const quizzes =
        Array.isArray(
            data?.quizQuestions
        )
            ? data.quizQuestions
            : [];


    return quizzes
        .map(
            quiz => {

                const options = {

                    A:
                        cleanText(
                            quiz?.option_a
                        ),

                    B:
                        cleanText(
                            quiz?.option_b
                        ),

                    C:
                        cleanText(
                            quiz?.option_c
                        ),

                    D:
                        cleanText(
                            quiz?.option_d
                        )

                };


                let correct =
                    cleanText(
                        quiz?.correct_answer
                    );


                correct =
                    correct
                        .toUpperCase()
                        .replace(
                            /OPTION\s+/,
                            ""
                        )
                        .trim();


                if (
                    !["A","B","C","D"]
                        .includes(correct)
                ) {

                    const matching =
                        Object.entries(options)
                            .find(
                                ([, value]) =>
                                    value &&
                                    value.toLowerCase()
                                        ===
                                    correct.toLowerCase()
                            );

                    if (matching) {

                        correct =
                            matching[0];
                    }
                }


                if (
                    !quiz?.question ||
                    !options.A ||
                    !options.B ||
                    !options.C ||
                    !options.D ||
                    !["A","B","C","D"]
                        .includes(correct)
                ) {

                    return null;
                }


                return {

                    question:
                        cleanText(
                            quiz.question
                        ),

                    options,

                    correct,

                    explanation:
                        cleanText(
                            quiz.explanation
                            || quiz.answer_explanation
                            || ""
                        )

                };
            }
        )
        .filter(Boolean);
}


// =========================================================
// TEST ENGINE
// =========================================================

function startTest() {

    if (!lastSearchData) {

        testBody.innerHTML = `

            <div class="empty-state">

                Ask Mwaniki AI a question first.
                Then I can build a test from the
                relevant material.

            </div>

        `;

        return;
    }


    const questions =
        getQuizQuestions(
            lastSearchData
        );


    if (!questions.length) {

        testBody.innerHTML = `

            <div class="empty-state">

                I found the study material, but there
                are no compatible quiz questions for
                this topic yet.

                <br><br>

                Add questions to the Supabase
                <strong>quizzes</strong> table and
                Mwaniki AI will use them here.

            </div>

        `;

        return;
    }


    currentTest =
        questions
            .sort(
                () => Math.random() - 0.5
            );


    testIndex = 0;

    testScore = 0;

    testLocked = false;

    renderCurrentQuestion();
}


function renderCurrentQuestion() {

    if (
        !currentTest ||
        testIndex >= currentTest.length
    ) {

        finishTest();

        return;
    }


    const question =
        currentTest[testIndex];


    testLocked = false;


    if (testProgress) {

        testProgress.textContent =
            `Question ${
                testIndex + 1
            } of ${
                currentTest.length
            }`;
    }


    testBody.innerHTML = `

        <div class="quiz-question">

            ${escapeHTML(
                question.question
            )}

        </div>


        <div class="quiz-options">

            ${["A","B","C","D"]
                .map(
                    letter => `

                        <button
                            type="button"
                            class="quiz-option"
                            data-answer="${letter}"
                        >

                            <span
                                class="option-letter"
                            >
                                ${letter}
                            </span>

                            <span>
                                ${escapeHTML(
                                    question.options[
                                        letter
                                    ]
                                )}
                            </span>

                        </button>

                    `
                )
                .join("")}

        </div>

    `;


    testBody
        .querySelectorAll(
            ".quiz-option"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        checkAnswer(
                            button.dataset.answer
                        );

                    }
                );

            }
        );
}


// =========================================================
// CHECK ANSWER
// =========================================================

function checkAnswer(selected) {

    if (testLocked) {
        return;
    }


    testLocked = true;


    const question =
        currentTest[testIndex];


    const isCorrect =
        selected === question.correct;


    const buttons =
        testBody.querySelectorAll(
            ".quiz-option"
        );


    buttons.forEach(
        button => {

            button.disabled = true;


            if (
                button.dataset.answer
                ===
                question.correct
            ) {

                button.classList.add(
                    "correct"
                );
            }


            if (
                button.dataset.answer
                ===
                selected &&
                !isCorrect
            ) {

                button.classList.add(
                    "wrong"
                );
            }

        }
    );


    if (isCorrect) {

        testScore++;


        testBody.insertAdjacentHTML(
            "beforeend",
            `

                <div class="quiz-feedback correct">

                    🎉 <strong>Correct!</strong>

                    Nice work, Scholar.

                </div>

                <button
                    type="button"
                    class="next-question-button"
                    id="nextQuestionButton"
                >
                    Next Question →
                </button>

            `
        );

        speak(
            "Correct! Nice work, Scholar."
        );

    } else {

        const correctText =
            question.options[
                question.correct
            ];


        const joke =
            "What the heck did you just say? 😄";


        testBody.insertAdjacentHTML(
            "beforeend",
            `

                <div class="quiz-feedback wrong">

                    😄 <strong>
                        ${escapeHTML(joke)}
                    </strong>

                    <div class="quiz-answer">

                        <strong>
                            Correct answer:
                        </strong>

                        ${question.correct} —
                        ${escapeHTML(
                            correctText
                        )}

                        ${
                            question.explanation
                                ? `
                                    <br><br>
                                    <strong>
                                        Explanation:
                                    </strong>
                                    ${escapeHTML(
                                        question.explanation
                                    )}
                                  `
                                : ""
                        }

                    </div>

                </div>

                <button
                    type="button"
                    class="next-question-button"
                    id="nextQuestionButton"
                >
                    Show Next Question →
                </button>

            `
        );


        speak(
            joke
        );
    }


    const nextButton =
        document.getElementById(
            "nextQuestionButton"
        );


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                testIndex++;

                renderCurrentQuestion();

            }
        );
    }
}


// =========================================================
// FINISH TEST
// =========================================================

function finishTest() {

    const total =
        currentTest?.length || 0;


    const percentage =
        total
            ? Math.round(
                (testScore / total) * 100
            )
            : 0;


    if (testProgress) {

        testProgress.textContent =
            "Finished";
    }


    testBody.innerHTML = `

        <div class="empty-state">

            <h3>
                Test complete 🎓
            </h3>

            <p>

                You scored

                <strong>
                    ${testScore}/${total}
                </strong>

                (${percentage}%).

            </p>


            <button
                type="button"
                class="start-test-button"
                id="restartTestButton"
            >
                Try Again
            </button>

        </div>

    `;


    speak(
        `Test complete. You scored ${testScore} out of ${total}.`
    );


    const restart =
        document.getElementById(
            "restartTestButton"
        );


    if (restart) {

        restart.addEventListener(
            "click",
            startTest
        );
    }
}


// =========================================================
// TEXT TO SPEECH
// =========================================================

function speak(text) {

    try {

        if (
            !("speechSynthesis" in window)
        ) {

            return;
        }


        window.speechSynthesis.cancel();


        const utterance =
            new SpeechSynthesisUtterance(
                text
            );


        utterance.rate = 0.95;

        utterance.pitch = 1.05;

        utterance.volume = 1;


        window.speechSynthesis.speak(
            utterance
        );

    } catch (error) {

        console.warn(
            "Speech synthesis unavailable:",
            error
        );
    }
}


// =========================================================
// MAIN SEARCH
// =========================================================

async function performSearch() {

    const question =
        cleanText(
            questionInput?.value
        );


    if (
        question.length < 2
    ) {

        setSearchStatus(
            "Please enter a medical question."
        );

        return;
    }


    if (
        question.length > 2000
    ) {

        setSearchStatus(
            "Please keep the question below 2000 characters."
        );

        return;
    }


    askButton.disabled = true;

    setStatus(
        "Searching",
        true
    );

    setSearchStatus(
        "Searching Mwaniki Scholars learning material..."
    );

    showLoading();


    try {

        const result =
            await invokeWithTimeout(
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
                ),
                25000
            );


        if (result.error) {

            throw result.error;
        }


        const data =
            result.data;


        lastSearchData =
            data;


        renderMwanikiAnswer(
            data
        );


        renderWebResults(
            data,
            question
        );


        renderImages(
            data
        );


        const internalCount =
            data?.counts?.mwaniki
            ?? data?.mwanikiSources?.length
            ?? 0;


        if (internalCount > 0) {

            setSearchStatus(
                "Answer found in Mwaniki Scholars material."
            );

            setStatus(
                "Answer ready"
            );

        } else {

            setSearchStatus(
                "No internal answer was available. Web results are shown."
            );

            setStatus(
                "Web search ready"
            );
        }


        const quizQuestions =
            getQuizQuestions(data);


        if (
            quizQuestions.length
        ) {

            testBody.innerHTML = `

                <div class="empty-state">

                    I found
                    <strong>
                        ${quizQuestions.length}
                    </strong>
                    test question(s) related to this topic.

                    <br><br>

                    <button
                        type="button"
                        id="startTestButton"
                        class="start-test-button"
                    >
                        🧠 Test Me
                    </button>

                </div>

            `;


            document
                .getElementById(
                    "startTestButton"
                )
                ?.addEventListener(
                    "click",
                    startTest
                );

        } else {

            testBody.innerHTML = `

                <div class="empty-state">

                    No quiz questions are currently
                    linked to this topic.

                    <br><br>

                    <button
                        type="button"
                        id="startTestButton"
                        class="start-test-button"
                    >
                        Try Test Mode
                    </button>

                </div>

            `;


            document
                .getElementById(
                    "startTestButton"
                )
                ?.addEventListener(
                    "click",
                    startTest
                );
        }


    } catch (error) {

        console.error(
            "Mwaniki AI error:",
            error
        );


        setStatus(
            "Search error"
        );


        setSearchStatus(
            error?.message
            || "The AI search could not be completed."
        );


        answerArea.innerHTML = `

            <div class="empty-state">

                <strong>
                    Mwaniki AI could not complete
                    the internal search.
                </strong>

                <p>
                    The web search area can still be
                    used to continue the search.
                </p>

            </div>

        `;


        const fallbackURL =
            "https://www.google.com/search?q="
            + encodeURIComponent(question);


        webResultsArea.innerHTML = `

            <div class="empty-state">

                <strong>
                    Continue with Google
                </strong>

                <p>
                    Mwaniki AI could not retrieve its
                    internal material for this request.
                </p>

                <div class="google-fallback">

                    <a
                        class="google-button"
                        href="${fallbackURL}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🔎 Search Google
                    </a>

                </div>

            </div>

        `;

    } finally {

        askButton.disabled = false;

        setTimeout(
            () => {

                if (
                    aiStatus &&
                    aiStatus.textContent
                        .includes("Searching")
                ) {

                    setStatus(
                        "Ready"
                    );
                }

            },
            1000
        );
    }
}


// =========================================================
// SUGGESTIONS
// =========================================================

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
                        button.dataset.question
                        || "";

                    questionInput.value =
                        question;

                    performSearch();

                }
            );

        }
    );


// =========================================================
// SEARCH BUTTON
// =========================================================

if (askButton) {

    askButton.addEventListener(
        "click",
        performSearch
    );
}


// =========================================================
// CTRL/CMD + ENTER
// =========================================================

if (questionInput) {

    questionInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
                &&
                (event.ctrlKey || event.metaKey)
            ) {

                event.preventDefault();

                performSearch();
            }

        }
    );
}


// =========================================================
// START TEST BUTTON
// =========================================================

if (startTestButton) {

    startTestButton.addEventListener(
        "click",
        startTest
    );
}


// =========================================================
// GLOBAL FUNCTIONS
// =========================================================

window.askMwanikiAI =
    performSearch;

window.askAI =
    performSearch;

window.startMwanikiTest =
    startTest;


console.log(
    "✅ Mwaniki AI search interface initialized."
);
