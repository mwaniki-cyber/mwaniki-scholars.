import { supabase } from "./supabase.js";


// ============================================================
// MWANIKI SCHOLARS
// MWANIKI AI FRONTEND ENGINE
// ============================================================

console.log("🚀 Mwaniki AI interface loading...");


// ============================================================
// DOM
// ============================================================

const questionInput =
    document.getElementById("aiQuestion");

const askButton =
    document.getElementById("askAIButton");

const aiAnswer =
    document.getElementById("aiAnswer");

const mwanikiSources =
    document.getElementById("mwanikiSources");

const webResults =
    document.getElementById("webResults");

const aiImages =
    document.getElementById("aiImages");

const aiSearchStatus =
    document.getElementById("aiSearchStatus");

const aiStatus =
    document.getElementById("aiStatus");

const mwanikiResultCount =
    document.getElementById("mwanikiResultCount");

const webResultCount =
    document.getElementById("webResultCount");

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

const testProgress =
    document.getElementById("testProgress");

const testNext =
    document.getElementById("testNext");

const testExit =
    document.getElementById("testExit");

const testTopic =
    document.getElementById("testTopic");

const startTestButton =
    document.getElementById("startTestButton");

const readAnswerButton =
    document.getElementById("readAnswerButton");

const stopAudioButton =
    document.getElementById("stopAudioButton");

const readMainAnswerButton =
    document.getElementById("readMainAnswerButton");

const stopMainAudioButton =
    document.getElementById("stopMainAudioButton");


// ============================================================
// STATE
// ============================================================

let currentAnswerText = "";

let currentSearchQuestion = "";

let currentTestTopic = "";

let currentTestNumber = 0;

let currentTestScore = 0;

let currentTestFinished = false;

let currentTestQuestion = null;


// ============================================================
// SAFE HTML
// ============================================================

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


// ============================================================
// SAFE URL
// ============================================================

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

        return "#";

    } catch {

        return "#";
    }
}


// ============================================================
// STATUS
// ============================================================

function setStatus(text, busy = false) {

    if (aiSearchStatus) {
        aiSearchStatus.textContent = text || "";
    }

    if (aiStatus) {

        aiStatus.innerHTML = busy
            ? '<span class="status-dot"></span> Searching...'
            : '<span class="status-dot"></span> Ready';
    }
}


// ============================================================
// LOADING
// ============================================================

function loadingHTML(message) {

    return `
        <div class="loading">
            <div class="spinner"></div>
            ${escapeHTML(message)}
        </div>
    `;
}


// ============================================================
// TEXT EXTRACTION
// ============================================================

function answerToText(answer) {

    if (!answer) {
        return "";
    }

    const pieces = [];

    if (answer.title) {
        pieces.push(answer.title);
    }

    if (Array.isArray(answer.paragraphs)) {

        pieces.push(
            ...answer.paragraphs
        );
    }

    if (Array.isArray(answer.keyPoints)) {

        pieces.push(
            ...answer.keyPoints
        );
    }

    if (answer.explanation) {
        pieces.push(answer.explanation);
    }

    return pieces
        .filter(Boolean)
        .join(". ");
}


// ============================================================
// RENDER ANSWER
// ============================================================

function renderAnswer(data) {

    if (!aiAnswer) {
        return;
    }

    const answer =
        data?.answer;

    if (!answer) {

        aiAnswer.innerHTML = `
            <div class="empty-state">
                No answer was returned.
                Try another medical question.
            </div>
        `;

        currentAnswerText = "";

        return;
    }


    const confidence =
        answer.confidence || "retrieved";


    const confidenceLabel =
        confidence === "internal"
            ? "Mwaniki Scholars material"
            : confidence === "web"
                ? "Web sources"
                : "Retrieved medical information";


    let html = `
        <span class="answer-confidence">
            ${escapeHTML(confidenceLabel)}
        </span>
    `;


    if (answer.title) {

        html += `
            <h3>
                ${escapeHTML(answer.title)}
            </h3>
        `;
    }


    if (
        Array.isArray(answer.paragraphs) &&
        answer.paragraphs.length
    ) {

        answer.paragraphs.forEach(
            paragraph => {

                html += `
                    <p>
                        ${escapeHTML(paragraph)}
                    </p>
                `;
            }
        );
    }


    if (
        Array.isArray(answer.keyPoints) &&
        answer.keyPoints.length
    ) {

        html += `
            <h4>
                Key points
            </h4>

            <ul>
        `;


        answer.keyPoints.forEach(
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


    if (answer.explanation) {

        html += `
            <p>
                ${escapeHTML(answer.explanation)}
            </p>
        `;
    }


    html += `
        <div style="margin-top:18px;">

            <button
                type="button"
                class="primary-button"
                id="inlineStartTest"
            >
                🧠 Test Me On This Topic
            </button>

        </div>
    `;


    aiAnswer.innerHTML = html;


    currentAnswerText =
        answerToText(answer);


    const inlineTestButton =
        document.getElementById("inlineStartTest");


    if (inlineTestButton) {

        inlineTestButton.addEventListener(
            "click",
            () => {

                const topic =
                    currentSearchQuestion ||
                    testTopic?.value ||
                    "";

                if (testTopic) {
                    testTopic.value = topic;
                }

                startTest(topic);
            }
        );
    }
}


// ============================================================
// RENDER MWANIKI SOURCES
// ============================================================

function renderMwanikiSources(sources) {

    if (!mwanikiSources) {
        return;
    }


    if (
        !Array.isArray(sources) ||
        sources.length === 0
    ) {

        mwanikiSources.innerHTML = `
            <div class="empty-state">
                No directly matching Mwaniki
                Scholars sources were found.
            </div>
        `;

        if (mwanikiResultCount) {
            mwanikiResultCount.textContent =
                "0 sources";
        }

        return;
    }


    if (mwanikiResultCount) {

        mwanikiResultCount.textContent =
            sources.length +
            (
                sources.length === 1
                    ? " source"
                    : " sources"
            );
    }


    mwanikiSources.innerHTML =
        sources
            .map(source => {

                const url =
                    safeURL(source.url);


                const clickable =
                    url !== "#";


                const title =
                    escapeHTML(
                        source.title ||
                        "Mwaniki Scholars source"
                    );


                const description =
                    escapeHTML(
                        source.description ||
                        ""
                    );


                const type =
                    escapeHTML(
                        source.type ||
                        "Mwaniki material"
                    );


                if (clickable) {

                    return `
                        <a
                            class="source-item"
                            href="${url}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <div class="source-type">
                                ${type}
                            </div>

                            <div class="source-title">
                                ${title}
                            </div>

                            <div class="source-description">
                                ${description}
                            </div>

                        </a>
                    `;
                }


                return `
                    <div class="source-item">

                        <div class="source-type">
                            ${type}
                        </div>

                        <div class="source-title">
                            ${title}
                        </div>

                        <div class="source-description">
                            ${description}
                        </div>

                    </div>
                `;

            })
            .join("");
}


// ============================================================
// RENDER WEB RESULTS
// ============================================================

function renderWebResults(results, googleURL) {

    if (!webResults) {
        return;
    }


    if (webResultCount) {

        webResultCount.textContent =
            (
                Array.isArray(results)
                    ? results.length
                    : 0
            ) +
            " results";
    }


    let html = "";


    if (
        Array.isArray(results) &&
        results.length
    ) {

        html += `
            <div class="web-list">
        `;


        results.forEach(result => {

            const title =
                result.title ||
                result.name ||
                "Medical web result";


            const description =
                result.description ||
                result.snippet ||
                result.text ||
                "";


            const url =
                safeURL(
                    result.url ||
                    result.link ||
                    result.href
                );


            html += `
                <article class="web-item">

                    <h3>

                        <a
                            href="${url}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${escapeHTML(title)}
                        </a>

                    </h3>

                    <p>
                        ${escapeHTML(description)}
                    </p>

                    ${
                        url !== "#"
                            ? `
                                <span class="web-url">
                                    ${escapeHTML(url)}
                                </span>
                            `
                            : ""
                    }

                </article>
            `;
        });


        html += `
            </div>
        `;

    } else {

        html += `
            <div class="empty-state">

                No configured web-search provider
                returned results for this query.

            </div>
        `;
    }


    if (googleURL) {

        const googleSafe =
            safeURL(googleURL);


        if (googleSafe !== "#") {

            html += `
                <a
                    class="see-more"
                    href="${googleSafe}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    🔎 Search Google for more
                </a>
            `;
        }
    }


    webResults.innerHTML =
        html;
}


// ============================================================
// RENDER IMAGES
// ============================================================

function renderImages(images, googleImageURL) {

    if (!aiImages) {
        return;
    }


    let validImages =
        Array.isArray(images)
            ? images
                .map(image => ({
                    url:
                        image.url ||
                        image.image ||
                        image.thumbnail ||
                        image.imageUrl,

                    title:
                        image.title ||
                        image.name ||
                        "Medical visual"
                }))
                .filter(image => image.url)
            : [];


    if (!validImages.length) {

        aiImages.innerHTML = `
            <div class="empty-state">

                No configured image-search provider
                returned images.

            </div>
        `;

    } else {

        let html = `
            <div class="image-grid">
        `;


        validImages
            .slice(0, 6)
            .forEach(image => {

                const url =
                    safeURL(image.url);


                if (url === "#") {
                    return;
                }


                html += `
                    <a
                        class="image-card"
                        href="${url}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >

                        <img
                            src="${url}"
                            alt="${escapeHTML(image.title)}"
                            loading="lazy"
                            onerror="this.parentElement.style.display='none';"
                        >

                        <div class="image-caption">
                            ${escapeHTML(image.title)}
                        </div>

                    </a>
                `;
            });


        html += `
            </div>
        `;


        if (googleImageURL) {

            const safeGoogle =
                safeURL(googleImageURL);


            if (safeGoogle !== "#") {

                html += `
                    <a
                        class="see-more"
                        href="${safeGoogle}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🖼️ See more images
                    </a>
                `;
            }
        }


        aiImages.innerHTML =
            html;
    }


    if (
        !validImages.length &&
        googleImageURL
    ) {

        const safeGoogle =
            safeURL(googleImageURL);


        if (safeGoogle !== "#") {

            aiImages.innerHTML += `
                <a
                    class="see-more"
                    href="${safeGoogle}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    🖼️ See more images
                </a>
            `;
        }
    }
}


// ============================================================
// SEARCH FUNCTION
// ============================================================

async function performSearch() {

    const question =
        questionInput?.value?.trim();


    if (!question) {

        setStatus(
            "Enter a medical question first."
        );

        if (questionInput) {
            questionInput.focus();
        }

        return;
    }


    currentSearchQuestion =
        question;


    if (testTopic) {
        testTopic.value = question;
    }


    if (testPanel) {
        testPanel.style.display = "none";
    }


    askButton.disabled = true;

    askButton.textContent =
        "Searching...";


    setStatus(
        "Searching Mwaniki Scholars and available web sources...",
        true
    );


    if (aiAnswer) {
        aiAnswer.innerHTML =
            loadingHTML(
                "Searching Mwaniki Scholars learning materials..."
            );
    }


    if (mwanikiSources) {
        mwanikiSources.innerHTML =
            loadingHTML(
                "Finding relevant Mwaniki sources..."
            );
    }


    if (webResults) {
        webResults.innerHTML =
            loadingHTML(
                "Checking available web sources..."
            );
    }


    if (aiImages) {
        aiImages.innerHTML =
            loadingHTML(
                "Finding relevant visual material..."
            );
    }


    try {

        const result =
            await Promise.race([

                supabase.functions.invoke(
                    "mwaniki-ai",
                    {
                        body: {
                            question,
                            searchMwaniki: true,
                            searchWeb: true,
                            searchImages: true
                        }
                    }
                ),

                new Promise(
                    (_, reject) => {

                        setTimeout(
                            () => {

                                reject(
                                    new Error(
                                        "Mwaniki AI request timed out."
                                    )
                                );

                            },
                            30000
                        );
                    }
                )

            ]);


        const {
            data,
            error
        } = result;


        if (error) {
            throw error;
        }


        if (!data) {
            throw new Error(
                "No response was returned by Mwaniki AI."
            );
        }


        if (!data.success) {

            throw new Error(
                data.error ||
                "Mwaniki AI returned an error."
            );
        }


        renderAnswer(data);

        renderMwanikiSources(
            data.mwanikiSources || []
        );

        renderWebResults(
            data.webResults || [],
            data.googleSearchUrl
        );

        renderImages(
            data.images || [],
            data.googleImageSearchUrl
        );


        const internalCount =
            data.counts?.mwaniki || 0;

        const webCount =
            data.counts?.web || 0;


        setStatus(
            "Search completed."
        );


        if (aiSearchStatus) {

            aiSearchStatus.textContent =
                "Mwaniki sources: " +
                internalCount +
                " • Web results: " +
                webCount;
        }


        console.log(
            "Mwaniki AI result:",
            data
        );

    } catch (error) {

        console.error(
            "Mwaniki AI search error:",
            error
        );


        if (aiAnswer) {

            aiAnswer.innerHTML = `
                <div class="empty-state">

                    <strong>
                        Mwaniki AI could not complete the search.
                    </strong>

                    <br><br>

                    ${escapeHTML(
                        error?.message ||
                        "Unknown error"
                    )}

                    <br><br>

                    Please try the search again.

                </div>
            `;
        }


        setStatus(
            "Search failed."
        );

    } finally {

        askButton.disabled = false;

        askButton.textContent =
            "Search Mwaniki AI";
    }
}


// ============================================================
// SPEECH
// ============================================================

function speak(text) {

    if (!("speechSynthesis" in window)) {

        alert(
            "Speech synthesis is not supported by this browser."
        );

        return;
    }


    if (!text) {
        return;
    }


    window.speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(text);


    utterance.rate = 0.92;

    utterance.pitch = 1;

    utterance.volume = 1;


    window.speechSynthesis.speak(
        utterance
    );
}


function stopSpeech() {

    if (
        "speechSynthesis" in window
    ) {
        window.speechSynthesis.cancel();
    }
}


// ============================================================
// START TEST
// ============================================================

async function startTest(topic) {

    const cleanTopic =
        String(topic || "").trim();


    if (!cleanTopic) {

        setStatus(
            "Enter a test topic first."
        );

        return;
    }


    currentTestTopic =
        cleanTopic;

    currentTestNumber = 0;

    currentTestScore = 0;

    currentTestFinished = false;

    currentTestQuestion = null;


    if (testPanel) {
        testPanel.style.display = "block";
    }


    testStatus.textContent =
        "Preparing your test...";


    testQuestion.textContent =
        "";


    testOptions.innerHTML =
        loadingHTML(
            "Generating a source-based question..."
        );


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    readAnswerButton.style.display =
        "none";


    try {

        await loadTestQuestion();

        testPanel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {

        console.error(
            "Test error:",
            error
        );


        testStatus.textContent =
            error?.message ||
            "Could not generate the test.";


        testOptions.innerHTML =
            `<div class="empty-state">
                Not enough material was available
                to generate this test.
            </div>`;
    }
}


// ============================================================
// LOAD TEST QUESTION
// ============================================================

async function loadTestQuestion() {

    currentTestNumber++;


    testProgress.textContent =
        "Question " +
        currentTestNumber;


    testStatus.textContent =
        "Generating question " +
        currentTestNumber +
        "...";


    testQuestion.textContent =
        "";


    testOptions.innerHTML =
        loadingHTML(
            "Preparing your question..."
        );


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    readAnswerButton.style.display =
        "none";


    const result =
        await supabase.functions.invoke(
            "mwaniki-ai",
            {
                body: {
                    mode: "test",
                    testTopic:
                        currentTestTopic,
                    searchMwaniki: true,
                    searchWeb: false,
                    searchImages: false
                }
            }
        );


    const {
        data,
        error
    } = result;


    if (error) {
        throw error;
    }


    if (
        !data ||
        !data.success
    ) {

        throw new Error(
            data?.error ||
            "The test question could not be generated."
        );
    }


    if (!data.testQuestion) {

        throw new Error(
            "No test question was returned."
        );
    }


    currentTestQuestion =
        data.testQuestion;


    renderTestQuestion(
        currentTestQuestion
    );
}


// ============================================================
// RENDER TEST QUESTION
// ============================================================

function renderTestQuestion(question) {

    testStatus.textContent =
        "Choose the best answer.";


    testQuestion.textContent =
        question.question;


    testOptions.innerHTML = "";


    const options =
        Array.isArray(question.options)
            ? question.options
            : [];


    options.forEach(option => {

        const button =
            document.createElement("button");


        button.type = "button";

        button.className =
            "test-option";


        button.dataset.key =
            option.key;


        button.textContent =
            option.key +
            ". " +
            option.text;


        button.addEventListener(
            "click",
            () => {

                answerTestQuestion(
                    option.key,
                    button
                );
            }
        );


        testOptions.appendChild(
            button
        );
    });


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    readAnswerButton.style.display =
        "none";
}


// ============================================================
// ANSWER TEST QUESTION
// ============================================================

function answerTestQuestion(
    selectedKey,
    selectedButton
) {

    if (!currentTestQuestion) {
        return;
    }


    const correctKey =
        currentTestQuestion.correctKey;


    const buttons =
        Array.from(
            testOptions.querySelectorAll(
                ".test-option"
            )
        );


    buttons.forEach(
        button => {
            button.disabled = true;
        }
    );


    const isCorrect =
        selectedKey === correctKey;


    const correctButton =
        buttons.find(
            button =>
                button.dataset.key ===
                correctKey
        );


    if (isCorrect) {

        currentTestScore++;


        selectedButton.classList.add(
            "correct"
        );


        testFeedback.className =
            "test-feedback correct-feedback";


        testFeedback.innerHTML = `
            <strong>
                🎉 Correct!
            </strong>

            <br><br>

            ${escapeHTML(
                currentTestQuestion.correctAnswer ||
                ""
            )}

            <br><br>

            ${escapeHTML(
                currentTestQuestion.explanation ||
                ""
            )}
        `;


        speak(
            "Correct. Well done. " +
            (
                currentTestQuestion.explanation ||
                ""
            )
        );

    } else {

        selectedButton.classList.add(
            "wrong"
        );


        if (correctButton) {

            correctButton.classList.add(
                "correct"
            );
        }


        testFeedback.className =
            "test-feedback wrong-feedback";


        testFeedback.innerHTML = `
            <strong>
                😂 What the heck did you just say?
                Let's fix that one.
            </strong>

            <br><br>

            <strong>
                Correct answer:
            </strong>

            ${escapeHTML(
                currentTestQuestion.correctAnswer ||
                ""
            )}

            <br><br>

            ${escapeHTML(
                currentTestQuestion.explanation ||
                ""
            )}
        `;


        speak(
            "What the heck did you just say? " +
            "Let's fix that one. " +
            "The correct answer is " +
            (
                currentTestQuestion.correctAnswer ||
                ""
            ) +
            ". " +
            (
                currentTestQuestion.explanation ||
                ""
            )
        );
    }


    testFeedback.style.display =
        "block";


    readAnswerButton.style.display =
        "inline-flex";


    testNext.style.display =
        "inline-flex";


    testStatus.textContent =
        isCorrect
            ? "Correct answer."
            : "Review the explanation above.";
}


// ============================================================
// NEXT TEST QUESTION
// ============================================================

async function nextTestQuestion() {

    if (currentTestFinished) {
        return;
    }


    testNext.disabled = true;


    try {

        await loadTestQuestion();

    } catch (error) {

        console.error(
            "Next test question error:",
            error
        );


        finishTest();

    } finally {

        testNext.disabled = false;
    }
}


// ============================================================
// FINISH TEST
// ============================================================

function finishTest() {

    currentTestFinished =
        true;


    const total =
        currentTestNumber;


    const percentage =
        total > 0
            ? Math.round(
                (currentTestScore / total) * 100
            )
            : 0;


    testProgress.textContent =
        "Finished";


    testQuestion.textContent =
        "Test completed";


    testOptions.innerHTML = `
        <div class="empty-state">

            <strong>
                Score: ${currentTestScore}/${total}
            </strong>

            <br><br>

            ${percentage}%

        </div>
    `;


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    readAnswerButton.style.display =
        "none";


    testStatus.textContent =
        percentage >= 80
            ? "Excellent work."
            : percentage >= 50
                ? "Good attempt. Keep revising."
                : "Keep studying this topic and try again.";
}


// ============================================================
// EXIT TEST
// ============================================================

function exitTest() {

    stopSpeech();


    if (testPanel) {
        testPanel.style.display =
            "none";
    }


    currentTestQuestion =
        null;

    currentTestFinished =
        false;

    currentTestNumber =
        0;

    currentTestScore =
        0;
}


// ============================================================
// SUGGESTIONS
// ============================================================

document
    .querySelectorAll(
        ".suggestion-button"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const value =
                    button.dataset.question ||
                    "";

                if (questionInput) {
                    questionInput.value =
                        value;
                }

                performSearch();
            }
        );
    });


// ============================================================
// SEARCH BUTTON
// ============================================================

if (askButton) {

    askButton.addEventListener(
        "click",
        performSearch
    );
}


// ============================================================
// ENTER KEY
// ============================================================

if (questionInput) {

    questionInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                performSearch();
            }
        }
    );
}


// ============================================================
// TEST BUTTON
// ============================================================

if (startTestButton) {

    startTestButton.addEventListener(
        "click",
        () => {

            startTest(
                testTopic?.value ||
                currentSearchQuestion
            );
        }
    );
}


// ============================================================
// NEXT
// ============================================================

if (testNext) {

    testNext.addEventListener(
        "click",
        nextTestQuestion
    );
}


// ============================================================
// EXIT
// ============================================================

if (testExit) {

    testExit.addEventListener(
        "click",
        exitTest
    );
}


// ============================================================
// TEST READ ALOUD
// ============================================================

if (readAnswerButton) {

    readAnswerButton.addEventListener(
        "click",
        () => {

            if (!currentTestQuestion) {
                return;
            }


            speak(
                "The correct answer is " +
                (
                    currentTestQuestion.correctAnswer ||
                    ""
                ) +
                ". " +
                (
                    currentTestQuestion.explanation ||
                    ""
                )
            );
        }
    );
}


// ============================================================
// MAIN ANSWER READ ALOUD
// ============================================================

if (readMainAnswerButton) {

    readMainAnswerButton.addEventListener(
        "click",
        () => {

            if (!currentAnswerText) {

                speak(
                    "There is no answer to read yet."
                );

                return;
            }


            speak(
                currentAnswerText
            );
        }
    );
}


// ============================================================
// STOP AUDIO
// ============================================================

if (stopAudioButton) {

    stopAudioButton.addEventListener(
        "click",
        stopSpeech
    );
}


if (stopMainAudioButton) {

    stopMainAudioButton.addEventListener(
        "click",
        stopSpeech
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

console.log(
    "✅ Mwaniki AI search interface initialized."
);
