```javascript
import { supabase } from "./supabase.js";


// ============================================================
// MWANIKI SCHOLARS
// MWANIKI AI FRONTEND ENGINE
// ============================================================

console.log("🚀 Mwaniki AI interface starting...");


// ============================================================
// DOM
// ============================================================

const aiQuestion =
    document.getElementById("aiQuestion");

const askAIButton =
    document.getElementById("askAIButton");

const aiStatus =
    document.getElementById("aiStatus");

const aiSearchStatus =
    document.getElementById("aiSearchStatus");

const aiAnswer =
    document.getElementById("aiAnswer");

const mwanikiSources =
    document.getElementById("mwanikiSources");

const webResults =
    document.getElementById("webResults");

const aiImages =
    document.getElementById("aiImages");

const mwanikiResultCount =
    document.getElementById("mwanikiResultCount");

const webResultCount =
    document.getElementById("webResultCount");

const answerActions =
    document.getElementById("answerActions");

const readAnswerButton =
    document.getElementById("readAnswerButton");

const stopAudioButton =
    document.getElementById("stopAudioButton");

const startTestButton =
    document.getElementById("startTestButton");

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

let latestSearchData = null;

let currentTest = null;

let testQuestionNumber = 0;

let testScore = 0;

let testAnswered = false;

let testTopic = "";


// ============================================================
// BASIC HELPERS
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function cleanText(value) {

    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}


function setStatus(text, busy = false) {

    if (aiStatus) {

        aiStatus.innerHTML = `
            <span class="status-dot"></span>
            ${escapeHTML(text)}
        `;

        aiStatus.style.color =
            busy
                ? "#0b6fa4"
                : "";
    }
}


function setSearchStatus(text) {

    if (aiSearchStatus) {

        aiSearchStatus.textContent =
            text || "";
    }
}


function setButtonBusy(busy) {

    if (!askAIButton) {
        return;
    }

    askAIButton.disabled = busy;

    askAIButton.textContent =
        busy
            ? "Searching..."
            : "Search Mwaniki AI";
}


function showEmpty(element, text) {

    if (!element) {
        return;
    }

    element.innerHTML = `
        <div class="empty-result">
            ${escapeHTML(text)}
        </div>
    `;
}


function safeUrl(value) {

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

    return "";
}


// ============================================================
// AUDIO
// ============================================================

function stopAudio() {

    if (
        "speechSynthesis" in window
    ) {

        window.speechSynthesis.cancel();
    }
}


function speak(text) {

    if (
        !("speechSynthesis" in window)
    ) {

        setSearchStatus(
            "Speech synthesis is not supported by this browser."
        );

        return;
    }

    const clean =
        cleanText(text);

    if (!clean) {
        return;
    }

    stopAudio();

    const utterance =
        new SpeechSynthesisUtterance(clean);

    utterance.rate = 0.95;

    utterance.pitch = 1;

    utterance.volume = 1;

    window.speechSynthesis.speak(
        utterance
    );
}


// ============================================================
// SEARCH
// ============================================================

async function performSearch(question) {

    const query =
        cleanText(question);

    if (!query) {

        setSearchStatus(
            "Enter a medical question or topic first."
        );

        aiQuestion?.focus();

        return;
    }


    if (query.length > 2000) {

        setSearchStatus(
            "Your question is too long. Please shorten it."
        );

        return;
    }


    stopAudio();

    setButtonBusy(true);

    setStatus(
        "Searching Mwaniki Scholars...",
        true
    );

    setSearchStatus(
        "Searching Mwaniki Scholars materials first..."
    );


    answerActions.style.display =
        "none";


    showEmpty(
        aiAnswer,
        "Searching..."
    );

    showEmpty(
        mwanikiSources,
        "Searching Mwaniki Scholars sources..."
    );

    showEmpty(
        webResults,
        "Searching the wider web..."
    );

    showEmpty(
        aiImages,
        "Searching visual resources..."
    );


    try {

        const result =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {
                        question: query,

                        searchMwaniki: true,

                        searchWeb: true,

                        searchImages: true
                    }
                }
            );


        if (result.error) {

            console.error(
                "Mwaniki AI function error:",
                result.error
            );

            throw new Error(
                result.error.message ||
                "Mwaniki AI request failed."
            );
        }


        const data =
            result.data;


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.error ||
                "The AI service returned an invalid response."
            );
        }


        latestSearchData =
            data;


        renderAnswer(data);

        renderSources(data);

        renderWebResults(data);

        renderImages(data);


        const internalCount =
            Number(
                data.counts?.mwaniki ||
                data.mwanikiSources?.length ||
                0
            );


        const webCount =
            Number(
                data.counts?.web ||
                data.webResults?.length ||
                0
            );


        mwanikiResultCount.textContent =
            `${internalCount} source${internalCount === 1 ? "" : "s"}`;


        webResultCount.textContent =
            `${webCount} result${webCount === 1 ? "" : "s"}`;


        answerActions.style.display =
            "flex";


        setStatus(
            "Ready"
        );


        setSearchStatus(
            data.searchStatus?.message ||
            "Search complete."
        );


        localStorage.setItem(
            "mwanikiLastAIQuestion",
            query
        );


    } catch (error) {

        console.error(
            "Mwaniki AI error:",
            error
        );


        setStatus(
            "Search error"
        );


        setSearchStatus(
            error.message ||
            "Unable to complete the search."
        );


        aiAnswer.innerHTML = `

            <div class="empty-result">

                <strong>
                    Mwaniki AI could not complete this search.
                </strong>

                <br><br>

                ${escapeHTML(
                    error.message ||
                    "Please try again."
                )}

            </div>
        `;


        showEmpty(
            mwanikiSources,
            "No Mwaniki sources could be displayed."
        );


        showEmpty(
            webResults,
            "No web results could be displayed."
        );


        showEmpty(
            aiImages,
            "No visual resources could be displayed."
        );


    } finally {

        setButtonBusy(false);
    }
}


// ============================================================
// ANSWER RENDERING
// ============================================================

function renderAnswer(data) {

    const answer =
        data.answer;


    if (!answer) {

        showEmpty(
            aiAnswer,
            "No answer was returned."
        );

        return;
    }


    const title =
        cleanText(
            answer.title ||
            "Mwaniki Scholars answer"
        );


    const paragraphs =
        Array.isArray(
            answer.paragraphs
        )
            ? answer.paragraphs
            : [];


    const keyPoints =
        Array.isArray(
            answer.keyPoints
        )
            ? answer.keyPoints
            : [];


    let html = `

        <h2 class="answer-title">
            ${escapeHTML(title)}
        </h2>
    `;


    if (paragraphs.length) {

        html +=
            paragraphs
                .filter(Boolean)
                .map(
                    paragraph => `
                        <p class="answer-paragraph">
                            ${escapeHTML(paragraph)}
                        </p>
                    `
                )
                .join("");
    }


    if (answer.explanation) {

        html += `

            <p class="answer-paragraph">

                ${escapeHTML(
                    answer.explanation
                )}

            </p>
        `;
    }


    if (keyPoints.length) {

        html += `

            <div class="key-points">

                <h3>
                    Key points
                </h3>

                <ul>

                    ${keyPoints
                        .filter(Boolean)
                        .map(
                            point => `
                                <li>
                                    ${escapeHTML(point)}
                                </li>
                            `
                        )
                        .join("")
                    }

                </ul>

            </div>
        `;
    }


    if (
        !paragraphs.length &&
        !keyPoints.length &&
        !answer.explanation
    ) {

        html += `

            <p class="answer-paragraph">

                Mwaniki AI found related material,
                but there was not enough extracted text
                to build a complete answer.

            </p>
        `;
    }


    aiAnswer.innerHTML =
        html;
}


// ============================================================
// INTERNAL SOURCES
// ============================================================

function renderSources(data) {

    const sources =
        Array.isArray(
            data.mwanikiSources
        )
            ? data.mwanikiSources
            : [];


    if (!sources.length) {

        showEmpty(
            mwanikiSources,
            "No matching Mwaniki Scholars material was found."
        );

        return;
    }


    const html =
        sources
            .slice(0, 20)
            .map(source => {

                const title =
                    cleanText(
                        source.title ||
                        source.name ||
                        "Mwaniki source"
                    );


                const type =
                    cleanText(
                        source.type ||
                        "Source"
                    );


                const description =
                    cleanText(
                        source.description ||
                        source.excerpt ||
                        ""
                    );


                const url =
                    safeUrl(
                        source.url
                    );


                const inner = `

                    <span class="source-type">
                        ${escapeHTML(type)}
                    </span>

                    <h3 class="source-title">
                        ${escapeHTML(title)}
                    </h3>

                    ${
                        description
                            ? `
                                <p class="source-description">
                                    ${escapeHTML(description)}
                                </p>
                            `
                            : ""
                    }

                `;


                if (url) {

                    return `

                        <a
                            class="source-item"
                            href="${escapeHTML(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${inner}
                        </a>

                    `;
                }


                return `

                    <div class="source-item">
                        ${inner}
                    </div>

                `;

            })
            .join("");


    mwanikiSources.innerHTML = `

        <div class="source-list">
            ${html}
        </div>
    `;
}


// ============================================================
// WEB RESULTS
// ============================================================

function renderWebResults(data) {

    const results =
        Array.isArray(
            data.webResults
        )
            ? data.webResults
            : [];


    if (!results.length) {

        const googleUrl =
            safeUrl(
                data.googleSearchUrl
            );


        if (googleUrl) {

            webResults.innerHTML = `

                <div class="empty-result">

                    No configured web-search provider
                    returned results.

                    <br><br>

                    <a
                        class="see-more"
                        href="${escapeHTML(googleUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Search Google for this topic →
                    </a>

                </div>
            `;

            return;
        }


        showEmpty(
            webResults,
            "No web results were returned."
        );

        return;
    }


    webResults.innerHTML = `

        <div class="web-list">

            ${results
                .slice(0, 10)
                .map(result => {

                    const title =
                        cleanText(
                            result.title ||
                            result.name ||
                            "Web result"
                        );


                    const description =
                        cleanText(
                            result.description ||
                            result.snippet ||
                            result.content ||
                            ""
                        );


                    const url =
                        safeUrl(
                            result.url ||
                            result.link
                        );


                    return `

                        <article class="web-item">

                            <h3>
                                ${escapeHTML(title)}
                            </h3>

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
                                            Open source →
                                        </a>
                                    `
                                    : ""
                            }

                        </article>

                    `;

                })
                .join("")
            }

        </div>
    `;
}


// ============================================================
// IMAGE RESULTS
// ============================================================

function renderImages(data) {

    const images =
        Array.isArray(
            data.images
        )
            ? data.images
            : [];


    const validImages =
        images
            .map(image => {

                return {

                    url:
                        safeUrl(
                            image.url ||
                            image.image ||
                            image.thumbnail
                        ),

                    title:
                        cleanText(
                            image.title ||
                            image.name ||
                            "Medical visual"
                        ),

                    source:
                        safeUrl(
                            image.source ||
                            image.pageUrl ||
                            image.link
                        )

                };

            })
            .filter(
                image => image.url
            );


    if (!validImages.length) {

        const googleImageUrl =
            safeUrl(
                data.googleImageSearchUrl
            );


        if (googleImageUrl) {

            aiImages.innerHTML = `

                <div class="empty-result">

                    No configured image provider
                    returned a visual.

                    <br><br>

                    <a
                        class="see-more"
                        href="${escapeHTML(googleImageUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        See more images on Google →
                    </a>

                </div>
            `;

            return;
        }


        showEmpty(
            aiImages,
            "No visual resources were returned."
        );

        return;
    }


    const firstImages =
        validImages.slice(0, 8);


    aiImages.innerHTML = `

        <div class="image-grid">

            ${firstImages
                .map(image => {

                    const imageUrl =
                        escapeHTML(
                            image.url
                        );


                    const title =
                        escapeHTML(
                            image.title
                        );


                    const imageHTML = `

                        <img
                            src="${imageUrl}"
                            alt="${title}"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                            onerror="this.closest('.image-card').remove()"
                        >
                    `;


                    if (image.source) {

                        return `

                            <a
                                class="image-card"
                                href="${escapeHTML(image.source)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >

                                ${imageHTML}

                                <div class="image-caption">
                                    ${title}
                                </div>

                            </a>
                        `;
                    }


                    return `

                        <div class="image-card">

                            ${imageHTML}

                            <div class="image-caption">
                                ${title}
                            </div>

                        </div>
                    `;

                })
                .join("")
            }

        </div>


        ${
            data.googleImageSearchUrl
                ? `
                    <a
                        class="see-more"
                        href="${escapeHTML(
                            data.googleImageSearchUrl
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        See more images →
                    </a>
                `
                : ""
        }

    `;
}


// ============================================================
// TEST START
// ============================================================

async function startTest() {

    const topic =
        cleanText(
            latestSearchData?.question ||
            aiQuestion?.value ||
            ""
        );


    if (!topic) {

        setSearchStatus(
            "Search a topic before starting a test."
        );

        return;
    }


    testTopic =
        topic;


    testPanel.style.display =
        "block";


    testPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    testQuestionNumber = 1;

    testScore = 0;

    testAnswered = false;

    currentTest = null;


    testProgress.textContent =
        "Question 1";


    testStatus.textContent =
        "Generating a question from the retrieved material...";


    testQuestion.textContent =
        "";


    testOptions.innerHTML =
        "";


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    try {

        const result =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {

                        mode: "test",

                        testTopic: topic,

                        question: topic,

                        searchMwaniki: true,

                        searchWeb: true
                    }
                }
            );


        if (result.error) {

            throw new Error(
                result.error.message ||
                "Could not generate the test."
            );
        }


        const data =
            result.data;


        if (
            !data ||
            data.success !== true ||
            !data.testQuestion
        ) {

            throw new Error(
                data?.error ||
                "There was not enough material to generate a test."
            );
        }


        currentTest =
            data.testQuestion;


        renderTestQuestion();


    } catch (error) {

        console.error(
            "Test generation error:",
            error
        );


        testStatus.textContent =
            error.message ||
            "Unable to generate a test question.";

    }
}


// ============================================================
// RENDER TEST QUESTION
// ============================================================

function renderTestQuestion() {

    if (!currentTest) {
        return;
    }


    testAnswered =
        false;


    testFeedback.style.display =
        "none";


    testFeedback.innerHTML =
        "";


    testNext.style.display =
        "none";


    testProgress.textContent =
        `Question ${testQuestionNumber}`;


    testStatus.textContent =
        currentTest.sourceType ===
        "generated_from_mwaniki_material"
            ? "Generated from your retrieved Mwaniki Scholars material."
            : "Question from your learning material.";


    testQuestion.textContent =
        currentTest.question ||
        "";


    const options =
        Array.isArray(
            currentTest.options
        )
            ? currentTest.options
            : [];


    testOptions.innerHTML =
        options
            .map(option => {

                const key =
                    cleanText(
                        option.key ||
                        option.value
                    );


                const text =
                    cleanText(
                        option.text ||
                        option.label
                    );


                return `

                    <button
                        type="button"
                        class="test-option"
                        data-key="${escapeHTML(key)}"
                    >
                        <strong>
                            ${escapeHTML(key)}.
                        </strong>

                        ${escapeHTML(text)}

                    </button>
                `;

            })
            .join("");


    testOptions
        .querySelectorAll(".test-option")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    answerTestQuestion(
                        button.dataset.key
                    );

                }
            );

        });
}


// ============================================================
// ANSWER TEST QUESTION
// ============================================================

function answerTestQuestion(selectedKey) {

    if (
        testAnswered ||
        !currentTest
    ) {
        return;
    }


    testAnswered =
        true;


    const correctKey =
        cleanText(
            currentTest.correctKey
        );


    const selected =
        cleanText(
            selectedKey
        );


    const isCorrect =
        selected.toUpperCase() ===
        correctKey.toUpperCase();


    if (isCorrect) {

        testScore++;

    }


    testOptions
        .querySelectorAll(".test-option")
        .forEach(button => {

            button.disabled = true;


            const key =
                cleanText(
                    button.dataset.key
                );


            if (
                key.toUpperCase() ===
                correctKey.toUpperCase()
            ) {

                button.classList.add(
                    "correct"
                );
            }


            if (
                key.toUpperCase() ===
                selected.toUpperCase() &&
                !isCorrect
            ) {

                button.classList.add(
                    "wrong"
                );
            }

        });


    const correctAnswer =
        cleanText(
            currentTest.correctAnswer ||
            ""
        );


    const explanation =
        cleanText(
            currentTest.explanation ||
            ""
        );


    if (isCorrect) {

        testFeedback.className =
            "test-feedback correct";


        testFeedback.innerHTML = `

            <strong>
                🎉 Correct!
            </strong>

            <br><br>

            ${escapeHTML(
                explanation
            )}

        `;


        speak(
            `Correct. Well done. ${correctAnswer}. ${explanation}`
        );

    } else {

        testFeedback.className =
            "test-feedback wrong";


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
                correctAnswer
            )}

            <br><br>

            ${escapeHTML(
                explanation
            )}

        `;


        speak(
            `What the heck did you just say? Let's fix that one. The correct answer is ${correctAnswer}. ${explanation}`
        );
    }


    testFeedback.style.display =
        "block";


    testNext.style.display =
        "inline-flex";


    testFeedback.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}


// ============================================================
// NEXT TEST QUESTION
// ============================================================

async function nextTestQuestion() {

    if (!testAnswered) {
        return;
    }


    testQuestionNumber++;


    testStatus.textContent =
        "Generating the next question...";


    testQuestion.textContent =
        "";


    testOptions.innerHTML =
        "";


    testFeedback.style.display =
        "none";


    testNext.style.display =
        "none";


    try {

        const result =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {
                    body: {

                        mode: "test",

                        testTopic: testTopic,

                        question: testTopic,

                        questionNumber:
                            testQuestionNumber,

                        excludeQuestion:
                            currentTest?.question ||
                            "",

                        searchMwaniki: true,

                        searchWeb: true
                    }
                }
            );


        if (result.error) {

            throw new Error(
                result.error.message ||
                "Could not generate the next question."
            );
        }


        const data =
            result.data;


        if (
            !data ||
            data.success !== true ||
            !data.testQuestion
        ) {

            finishTest();

            return;
        }


        currentTest =
            data.testQuestion;


        renderTestQuestion();


    } catch (error) {

        console.error(
            "Next question error:",
            error
        );


        finishTest(
            error.message
        );
    }
}


// ============================================================
// FINISH TEST
// ============================================================

function finishTest(errorMessage = "") {

    stopAudio();


    const total =
        Math.max(
            testQuestionNumber - 1,
            1
        );


    const percentage =
        Math.round(
            (testScore / total) * 100
        );


    testStatus.textContent =
        "Test complete";


    testQuestion.textContent =
        "";


    testOptions.innerHTML =
        "";


    testFeedback.style.display =
        "block";


    testFeedback.className =
        "test-feedback correct";


    testFeedback.innerHTML = `

        <strong>
            Test complete.
        </strong>

        <br><br>

        Score:
        ${escapeHTML(
            String(testScore)
        )}
        /
        ${escapeHTML(
            String(total)
        )}

        (${escapeHTML(
            String(percentage)
        )}%)

        ${
            errorMessage
                ? `
                    <br><br>
                    ${escapeHTML(errorMessage)}
                `
                : ""
        }

    `;


    testNext.style.display =
        "none";


    testProgress.textContent =
        "Complete";


    speak(
        `Test complete. Your score is ${testScore} out of ${total}, which is ${percentage} percent.`
    );
}


// ============================================================
// EXIT TEST
// ============================================================

function exitTest() {

    stopAudio();

    testPanel.style.display =
        "none";

    currentTest =
        null;

    testQuestionNumber =
        0;

    testScore =
        0;

    testAnswered =
        false;
}


// ============================================================
// EVENTS
// ============================================================

askAIButton?.addEventListener(
    "click",
    () => {

        performSearch(
            aiQuestion.value
        );

    }
);


aiQuestion?.addEventListener(
    "keydown",
    event => {

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


document
    .querySelectorAll(".suggestion-button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const question =
                    button.dataset.question ||
                    "";

                aiQuestion.value =
                    question;

                performSearch(
                    question
                );

            }
        );

    });


readAnswerButton?.addEventListener(
    "click",
    () => {

        if (!latestSearchData) {
            return;
        }


        const answer =
            latestSearchData.answer;


        const text = [

            answer?.title,

            ...(answer?.paragraphs || []),

            answer?.explanation,

            ...(answer?.keyPoints || [])

        ]
            .filter(Boolean)
            .join(". ");


        speak(text);
    }
);


stopAudioButton?.addEventListener(
    "click",
    stopAudio
);


startTestButton?.addEventListener(
    "click",
    startTest
);


testNext?.addEventListener(
    "click",
    nextTestQuestion
);


testExit?.addEventListener(
    "click",
    exitTest
);


// ============================================================
// INITIAL STATE
// ============================================================

const previousQuestion =
    localStorage.getItem(
        "mwanikiLastAIQuestion"
    );


if (previousQuestion) {

    aiQuestion.value =
        previousQuestion;
}


console.log(
    "✅ Mwaniki AI search interface initialized."
);
```
