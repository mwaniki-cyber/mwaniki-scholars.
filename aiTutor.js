```javascript
import { supabase } from "./supabase.js";

/*
===========================================================
 MWANIKI SCHOLARS
 AI TUTOR FRONTEND
===========================================================

 VOICE SYSTEM
 ----------------------------------------------------------
 NORMAL VOICE
 • AI answers
 • Test questions
 • Final score
 • Read Answer

 CARTOON VOICE
 • Correct answer
 • Wrong answer
 • Exaggerated pitch
 • Faster delivery
 • Dedicated voice selection

 IMPORTANT:
 The cartoon voice is NEVER used for normal AI speech.
===========================================================
*/


/* =========================================================
   DOM ELEMENTS
========================================================= */

const backToDashboardButton =
    document.getElementById("backToDashboardButton");

const aiRecentQuestions =
    document.getElementById("aiRecentQuestions");

const suggestionButtons =
    document.querySelectorAll(".suggestion-button");

const aiQuestion =
    document.getElementById("aiQuestion");

const askAIButton =
    document.getElementById("askAIButton");

const aiSearchStatus =
    document.getElementById("aiSearchStatus");

const aiStatus =
    document.getElementById("aiStatus");

const aiAnswer =
    document.getElementById("aiAnswer");

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

const testMeButton =
    document.getElementById("testMeButton");

const mwanikiSources =
    document.getElementById("mwanikiSources");

const aiImages =
    document.getElementById("aiImages");

const webResults =
    document.getElementById("webResults");


/* =========================================================
   STATE
========================================================= */

let currentAnswerText = "";

let currentQuestionText = "";

let currentTestQuestion = null;

let currentTestTopic = "";

let currentTestNumber = 0;

let currentTestLength = 10;

let currentTestScore = 0;

let currentTestAnswered = false;

let currentTestUsedIds = [];


/* =========================================================
   NORMAL SPEECH STATE
========================================================= */

let speechQueue = [];

let speechIndex = 0;

let speechStopped = false;

let selectedNaturalVoice = null;


/* =========================================================
   CARTOON SPEECH STATE
========================================================= */

let selectedCartoonVoice = null;


/* =========================================================
   BASIC HELPERS
========================================================= */

function cleanText(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\r/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
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

    try {

        const url =
            new URL(String(value));

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {
            return url.href;
        }

    } catch (_) {}

    return "#";
}


function textToHTML(value) {

    const cleaned =
        cleanText(value);

    if (!cleaned) {
        return "";
    }

    return escapeHTML(cleaned)
        .replace(/\n\n+/g, "</p><p>")
        .replace(/\n/g, "<br>");
}


function setStatus(message = "") {

    if (aiStatus) {
        aiStatus.textContent =
            message;
    }

    if (aiSearchStatus) {
        aiSearchStatus.textContent =
            message;
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
                "dashboard.html";

        }
    );

}


/* =========================================================
   SUGGESTIONS
========================================================= */

suggestionButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const question =
                    cleanText(
                        button.dataset.question ||
                        button.textContent
                    );

                if (!question) {
                    return;
                }

                if (aiQuestion) {
                    aiQuestion.value =
                        question;
                }

                searchAI(question);

            }
        );

    }
);


/* =========================================================
   ENTER TO ASK
========================================================= */

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


/* =========================================================
   ASK AI
========================================================= */

if (askAIButton) {

    askAIButton.addEventListener(
        "click",
        () => {

            const question =
                cleanText(
                    aiQuestion?.value
                );

            if (!question) {

                setStatus(
                    "Please enter a medical question."
                );

                aiQuestion?.focus();

                return;

            }

            searchAI(question);

        }
    );

}


/* =========================================================
   VOICE ENGINE
========================================================= */

function getAvailableVoices() {

    if (
        !("speechSynthesis" in window)
    ) {
        return [];
    }

    return window
        .speechSynthesis
        .getVoices();

}


/* =========================================================
   NORMAL VOICE SCORING
========================================================= */

function scoreNaturalVoice(voice) {

    const name =
        cleanText(
            voice?.name
        ).toLowerCase();

    const lang =
        cleanText(
            voice?.lang
        ).toLowerCase();

    let score = 0;


    if (lang === "en-us") {
        score += 20;
    }

    if (lang === "en-gb") {
        score += 19;
    }

    if (lang.startsWith("en-")) {
        score += 10;
    }


    if (name.includes("natural")) {
        score += 100;
    }

    if (name.includes("online")) {
        score += 80;
    }

    if (name.includes("neural")) {
        score += 80;
    }


    if (name.includes("microsoft")) {
        score += 30;
    }

    if (name.includes("google")) {
        score += 25;
    }


    if (name.includes("ava")) {
        score += 35;
    }

    if (name.includes("jenny")) {
        score += 35;
    }

    if (name.includes("aria")) {
        score += 35;
    }

    if (name.includes("guy")) {
        score += 30;
    }

    if (name.includes("sonia")) {
        score += 30;
    }

    if (name.includes("ryan")) {
        score += 30;
    }

    if (name.includes("samantha")) {
        score += 25;
    }

    if (name.includes("karen")) {
        score += 25;
    }

    if (name.includes("daniel")) {
        score += 25;
    }


    return score;
}


/* =========================================================
   SELECT NATURAL VOICE
========================================================= */

function chooseNaturalVoice() {

    const voices =
        getAvailableVoices();

    if (!voices.length) {

        selectedNaturalVoice =
            null;

        return null;

    }


    const english =
        voices.filter(
            voice =>
                cleanText(
                    voice.lang
                )
                .toLowerCase()
                .startsWith("en")
        );


    const candidates =
        english.length
            ? english
            : voices;


    candidates.sort(
        (a, b) =>
            scoreNaturalVoice(b) -
            scoreNaturalVoice(a)
    );


    selectedNaturalVoice =
        candidates[0] || null;


    return selectedNaturalVoice;

}


/* =========================================================
   CARTOON VOICE SCORING
========================================================= */

/*
   We deliberately select a DIFFERENT voice from the
   normal AI voice.

   Preference is given to voices that sound suitable
   for an animated / playful reaction.

   This cannot manufacture a Disney-style character voice
   because browser speech synthesis does not expose an
   actual cartoon voice effect, but it does give us a
   clearly separate playful voice when the browser has
   multiple English voices available.
*/

function scoreCartoonVoice(
    voice
) {

    const name =
        cleanText(
            voice?.name
        ).toLowerCase();

    const lang =
        cleanText(
            voice?.lang
        ).toLowerCase();

    let score = 0;


    if (
        lang.startsWith("en")
    ) {
        score += 20;
    }


    /*
       Prefer voices different from the normal
       natural Microsoft voice.
    */

    if (
        name.includes("google")
    ) {
        score += 40;
    }


    if (
        name.includes("samantha")
    ) {
        score += 45;
    }


    if (
        name.includes("karen")
    ) {
        score += 45;
    }


    if (
        name.includes("daniel")
    ) {
        score += 40;
    }


    if (
        name.includes("female")
    ) {
        score += 25;
    }


    /*
       Avoid using the exact same voice as normal AI.
    */

    if (
        selectedNaturalVoice &&
        voice.name ===
        selectedNaturalVoice.name
    ) {

        score -= 100;

    }


    /*
       Natural/online voices are not automatically
       preferred here because we want separation
       from the normal AI voice.
    */

    if (
        name.includes("natural")
    ) {
        score -= 10;
    }


    return score;

}


/* =========================================================
   SELECT CARTOON VOICE
========================================================= */

function chooseCartoonVoice() {

    const voices =
        getAvailableVoices();

    if (!voices.length) {

        selectedCartoonVoice =
            null;

        return null;

    }


    const english =
        voices.filter(
            voice =>
                cleanText(
                    voice.lang
                )
                .toLowerCase()
                .startsWith("en")
        );


    const candidates =
        english.length
            ? english
            : voices;


    candidates.sort(
        (a, b) =>
            scoreCartoonVoice(b) -
            scoreCartoonVoice(a)
    );


    selectedCartoonVoice =
        candidates[0] || null;


    /*
       If the browser only exposes one voice,
       we have no second voice to select.
    */

    if (
        selectedCartoonVoice &&
        selectedNaturalVoice &&
        selectedCartoonVoice.name ===
        selectedNaturalVoice.name
    ) {

        selectedCartoonVoice =
            null;

    }


    return selectedCartoonVoice;

}


/* =========================================================
   LOAD VOICES
========================================================= */

function loadSpeechVoices() {

    chooseNaturalVoice();

    chooseCartoonVoice();

}


if (
    "speechSynthesis" in window
) {

    loadSpeechVoices();


    window.speechSynthesis
        .addEventListener(
            "voiceschanged",
            () => {

                loadSpeechVoices();

                console.log(
                    "🎙 Voices loaded:",
                    getAvailableVoices()
                        .map(
                            voice =>
                                `${voice.name} (${voice.lang})`
                        )
                );

                console.log(
                    "🔊 Normal voice:",
                    selectedNaturalVoice?.name ||
                    "browser default"
                );

                console.log(
                    "🎭 Cartoon voice:",
                    selectedCartoonVoice?.name ||
                    "pitch-based fallback"
                );

            }
        );

}


/* =========================================================
   STOP ALL SPEECH
========================================================= */

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

        window
            .speechSynthesis
            .cancel();

    }

}


/* =========================================================
   SPLIT NORMAL SPEECH
========================================================= */

function splitSpeech(text) {

    const cleaned =
        cleanText(text);

    if (!cleaned) {
        return [];
    }


    const sentences =
        cleaned.match(
            /[^.!?]+[.!?]+/g
        );


    if (
        !sentences ||
        !sentences.length
    ) {

        return [cleaned];

    }


    const chunks = [];

    let current =
        "";


    sentences.forEach(
        sentence => {

            const part =
                cleanText(sentence);

            if (!part) {
                return;
            }


            if (
                current.length +
                part.length <
                420
            ) {

                current +=
                    (
                        current
                            ? " "
                            : ""
                    ) +
                    part;

            } else {

                if (current) {
                    chunks.push(
                        current
                    );
                }

                current =
                    part;

            }

        }
    );


    if (current) {
        chunks.push(current);
    }


    return chunks;

}


/* =========================================================
   NORMAL SPEECH CHUNK
========================================================= */

function speakNextChunk() {

    if (
        speechStopped ||
        speechIndex >=
        speechQueue.length
    ) {
        return;
    }


    const chunk =
        cleanText(
            speechQueue[
                speechIndex
            ]
        );


    if (!chunk) {

        speechIndex++;

        speakNextChunk();

        return;

    }


    const utterance =
        new SpeechSynthesisUtterance(
            chunk
        );


    if (
        selectedNaturalVoice
    ) {

        utterance.voice =
            selectedNaturalVoice;

        utterance.lang =
            selectedNaturalVoice.lang;

    } else {

        utterance.lang =
            "en-US";

    }


    /*
       NORMAL EDUCATIONAL VOICE
    */

    utterance.rate =
        0.93;

    utterance.pitch =
        1.0;

    utterance.volume =
        1.0;


    utterance.onend =
        () => {

            if (speechStopped) {
                return;
            }

            speechIndex++;

            setTimeout(
                () => {

                    speakNextChunk();

                },
                40
            );

        };


    utterance.onerror =
        error => {

            console.warn(
                "Normal speech error:",
                error
            );

            if (speechStopped) {
                return;
            }

            speechIndex++;

            speakNextChunk();

        };


    window
        .speechSynthesis
        .speak(
            utterance
        );

}


/* =========================================================
   NORMAL SPEAK FUNCTION
========================================================= */

function speakText(text) {

    if (
        !("speechSynthesis" in window)
    ) {

        setStatus(
            "Speech synthesis is not supported by this browser."
        );

        return;

    }


    const cleaned =
        cleanText(text);

    if (!cleaned) {
        return;
    }


    stopSpeech();


    loadSpeechVoices();


    speechQueue =
        splitSpeech(cleaned);

    speechIndex =
        0;

    speechStopped =
        false;


    speakNextChunk();

}


/* =========================================================
   CARTOON SPEECH ENGINE
========================================================= */

/*
   This is completely separate from speakText().

   The normal AI voice is NEVER used here unless the
   browser literally exposes only one voice.

   The exaggerated pitch/rate gives the selected voice
   an animated reaction character.
*/

function speakCartoon(
    text,
    type = "wrong"
) {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }


    const phrase =
        cleanText(text);

    if (!phrase) {
        return;
    }


    /*
       Kill whatever was speaking.
    */

    window
        .speechSynthesis
        .cancel();


    loadSpeechVoices();


    const utterance =
        new SpeechSynthesisUtterance(
            phrase
        );


    /*
       USE A DIFFERENT VOICE.
    */

    if (
        selectedCartoonVoice
    ) {

        utterance.voice =
            selectedCartoonVoice;

        utterance.lang =
            selectedCartoonVoice.lang;

    } else {

        /*
           If Edge only gives us one voice,
           the exaggerated pitch/rate remains
           as the fallback.
        */

        utterance.lang =
            "en-US";

    }


    if (
        type === "correct"
    ) {

        /*
           HAPPY CARTOON
        */

        utterance.rate =
            1.35;

        utterance.pitch =
            1.75;

        utterance.volume =
            1.0;

    } else {

        /*
           SILLY / SURPRISED CARTOON
        */

        utterance.rate =
            1.48;

        utterance.pitch =
            1.95;

        utterance.volume =
            1.0;

    }


    utterance.onstart =
        () => {

            console.log(
                "🎭 Cartoon voice:",
                utterance.voice?.name ||
                "pitch fallback"
            );

        };


    utterance.onerror =
        error => {

            console.warn(
                "Cartoon speech error:",
                error
            );

        };


    window
        .speechSynthesis
        .speak(
            utterance
        );

}


/* =========================================================
   CORRECT CARTOON REACTION
========================================================= */

function playCorrectReaction() {

    const phrases = [

        "Yes! That's it!",

        "Excellent! You got it!",

        "Brilliant! Fantastic answer!",

        "Yes! Absolutely correct!",

        "Woohoo! You nailed it!"

    ];


    const phrase =
        phrases[
            Math.floor(
                Math.random() *
                phrases.length
            )
        ];


    speakCartoon(
        phrase,
        "correct"
    );

}


/* =========================================================
   WRONG CARTOON REACTION
========================================================= */

function playWrongReaction() {

    const phrases = [

        "Ooooh! Not quite!",

        "Whoops! Almost there!",

        "Aha! Not this time!",

        "Nice try! Keep going!",

        "Oops! Let's have another look!"

    ];


    const phrase =
        phrases[
            Math.floor(
                Math.random() *
                phrases.length
            )
        ];


    speakCartoon(
        phrase,
        "wrong"
    );

}


/* =========================================================
   READ ANSWER
========================================================= */

if (readAnswerButton) {

    readAnswerButton.addEventListener(
        "click",
        () => {

            if (!currentAnswerText) {

                setStatus(
                    "There is no answer to read yet."
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
        () => {

            stopSpeech();

            setStatus(
                "Audio stopped."
            );

        }
    );

}


/* =========================================================
   SEARCH AI
========================================================= */

async function searchAI(question) {

    const query =
        cleanText(question);

    if (!query) {
        return;
    }


    stopSpeech();


    currentQuestionText =
        query;


    if (askAIButton) {

        askAIButton.disabled =
            true;

        askAIButton.textContent =
            "Thinking...";

    }


    setStatus(
        "Searching Mwaniki AI..."
    );


    if (aiAnswer) {

        aiAnswer.innerHTML = `

            <div class="ai-loading">

                <span>
                    Searching medical knowledge...
                </span>

            </div>

        `;

    }


    try {

        const {
            data: {
                session
            } = {}
        } =
            await supabase.auth
                .getSession();


        const accessToken =
            session?.access_token ||
            "";


        if (!accessToken) {

            throw new Error(
                "You are not signed in."
            );

        }


        const {
            data,
            error
        } =
            await supabase.functions.invoke(
                "mwaniki-ai",
                {

                    body: {

                        mode: "search",

                        question:
                            query,

                        searchMwaniki:
                            true,

                        searchWeb:
                            true,

                        searchImages:
                            true

                    },

                    headers: {

                        Authorization:
                            `Bearer ${accessToken}`

                    }

                }
            );


        if (error) {
            throw error;
        }


        if (!data) {

            throw new Error(
                "The AI returned no data."
            );

        }


        console.log(
            "Mwaniki AI response:",
            data
        );


        const answer =
            cleanText(
                data.answer ||
                data.finalAnswer ||
                data.mwanikiAnswer ||
                data.webAnswer ||
                ""
            );


        currentAnswerText =
            answer;


        renderAnswer(
            query,
            answer
        );


        renderWebResults(
            data.webResults || []
        );


        renderImages(
            data.images || [],
            data.primaryImage || null
        );


        /*
           INTERNAL MATERIALS STAY HIDDEN.
        */

        if (mwanikiSources) {

            mwanikiSources.innerHTML =
                "";

            mwanikiSources.style.display =
                "none";

        }


        setStatus(
            answer
                ? "Mwaniki AI is ready."
                : "No direct answer was returned."
        );


        saveRecentQuestion(
            query
        );


    } catch (error) {

        console.error(
            "Mwaniki AI error:",
            error
        );


        currentAnswerText =
            "";


        if (aiAnswer) {

            aiAnswer.innerHTML = `

                <div class="ai-error">

                    <strong>
                        Unable to answer right now.
                    </strong>

                    <p>
                        ${escapeHTML(
                            error?.message ||
                            "Please try again."
                        )}
                    </p>

                </div>

            `;

        }


        setStatus(
            error?.message ||
            "AI request failed."
        );


    } finally {

        if (askAIButton) {

            askAIButton.disabled =
                false;

            askAIButton.textContent =
                "🤖 Ask Mwaniki AI";

        }

    }

}


/* =========================================================
   ANSWER RENDER
========================================================= */

function renderAnswer(
    question,
    answer
) {

    if (!aiAnswer) {
        return;
    }


    if (!answer) {

        aiAnswer.innerHTML = `

            <div class="ai-empty">

                <div class="ai-empty-icon">
                    🤖
                </div>

                <h3>
                    I could not build a reliable answer.
                </h3>

                <p>
                    Try making the medical question more specific.
                </p>

            </div>

        `;

        return;

    }


    aiAnswer.innerHTML = `

        <div class="answer-question">

            <span class="answer-label">
                YOUR QUESTION
            </span>

            <h3>
                ${escapeHTML(question)}
            </h3>

        </div>


        <div class="answer-body">

            <span class="answer-label">
                MWANIKI AI
            </span>

            <div class="answer-text">

                <p>
                    ${textToHTML(answer)}
                </p>

            </div>

        </div>

    `;

}


/* =========================================================
   GOOGLE SEARCH
========================================================= */

function renderWebResults(results) {

    if (!webResults) {
        return;
    }


    const items =
        Array.isArray(results)
            ? results
            : [];


    if (!items.length) {

        webResults.innerHTML = `

            <div class="web-empty">

                <span>
                    🔎
                </span>

                <p>
                    No Google results were returned.
                </p>

            </div>

        `;

        return;

    }


    const cards =
        items
            .slice(0, 8)
            .map(
                result => {

                    const title =
                        cleanText(
                            result.title ||
                            "Medical search result"
                        );

                    const snippet =
                        cleanText(
                            result.snippet ||
                            result.description ||
                            ""
                        );

                    const url =
                        safeURL(
                            result.url ||
                            result.link ||
                            result.displayUrl
                        );


                    return `

                        <article
                            class="web-result-card"
                        >

                            <div class="web-result-label">
                                GOOGLE SEARCH
                            </div>

                            <h3>
                                ${escapeHTML(title)}
                            </h3>

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
                                url !== "#"
                                    ? `
                                    <a
                                        href="${url}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="web-result-link"
                                    >
                                        Open result →
                                    </a>
                                    `
                                    : ""
                            }

                        </article>

                    `;

                }
            )
            .join("");


    webResults.innerHTML = `

        <div class="web-results-heading">

            <div>

                <span>
                    RESEARCH
                </span>

                <h3>
                    Google Search
                </h3>

            </div>

        </div>


        <div class="web-results-grid">

            ${cards}

        </div>

    `;

}


/* =========================================================
   GOOGLE IMAGES
========================================================= */

function renderImages(
    images,
    primaryImage = null
) {

    if (!aiImages) {
        return;
    }


    const imageList =
        Array.isArray(images)
            ? images
            : [];


    const combined =
        primaryImage
            ? [
                primaryImage,
                ...imageList
            ]
            : imageList;


    const seen =
        new Set();

    const uniqueImages =
        [];


    combined.forEach(
        image => {

            const url =
                image?.url ||
                image?.imageUrl ||
                image?.link ||
                image?.src ||
                "";


            if (!url) {
                return;
            }


            if (seen.has(url)) {
                return;
            }


            seen.add(url);

            uniqueImages.push({
                ...image,
                url
            });

        }
    );


    if (!uniqueImages.length) {

        aiImages.innerHTML = `

            <div class="images-empty">

                <span>
                    🖼
                </span>

                <p>
                    No image results were returned.
                </p>

            </div>

        `;

        return;

    }


    const cards =
        uniqueImages
            .slice(0, 12)
            .map(
                image => {

                    const url =
                        safeURL(
                            image.url
                        );


                    if (url === "#") {
                        return "";
                    }


                    const title =
                        cleanText(
                            image.title ||
                            image.alt ||
                            "Medical image"
                        );


                    return `

                        <article
                            class="image-result-card"
                        >

                            <a
                                href="${url}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >

                                <img
                                    src="${url}"
                                    alt="${escapeHTML(title)}"
                                    loading="lazy"
                                    referrerpolicy="no-referrer"
                                >

                            </a>

                            <div class="image-result-title">
                                ${escapeHTML(title)}
                            </div>

                        </article>

                    `;

                }
            )
            .join("");


    aiImages.innerHTML = `

        <div class="images-results-heading">

            <div>

                <span>
                    VISUAL RESEARCH
                </span>

                <h3>
                    Google Images
                </h3>

            </div>

        </div>


        <div class="images-grid">

            ${cards}

        </div>

    `;

}


/* =========================================================
   RECENT QUESTIONS
========================================================= */

function getRecentQuestions() {

    try {

        const saved =
            localStorage.getItem(
                "mwanikiAIRecentQuestions"
            );

        if (!saved) {
            return [];
        }


        const parsed =
            JSON.parse(saved);


        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (_) {

        return [];

    }

}


function saveRecentQuestion(
    question
) {

    const query =
        cleanText(question);

    if (!query) {
        return;
    }


    let questions =
        getRecentQuestions();


    questions =
        [
            query,
            ...questions.filter(
                item =>
                    item !== query
            )
        ]
        .slice(0, 8);


    try {

        localStorage.setItem(
            "mwanikiAIRecentQuestions",
            JSON.stringify(
                questions
            )
        );

    } catch (_) {}


    renderRecentQuestions();

}


function renderRecentQuestions() {

    if (!aiRecentQuestions) {
        return;
    }


    const questions =
        getRecentQuestions();


    if (!questions.length) {

        aiRecentQuestions.innerHTML =
            "";

        return;

    }


    aiRecentQuestions.innerHTML = `

        <div class="recent-heading">
            Recent questions
        </div>

        <div class="recent-question-list">

            ${questions
                .map(
                    question => `

                        <button
                            type="button"
                            class="recent-question-button"
                            data-recent-question="${escapeHTML(
                                question
                            )}"
                        >
                            ${escapeHTML(
                                question
                            )}
                        </button>

                    `
                )
                .join("")}

        </div>

    `;


    aiRecentQuestions
        .querySelectorAll(
            ".recent-question-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const question =
                            button.dataset
                                .recentQuestion ||
                            "";

                        if (aiQuestion) {
                            aiQuestion.value =
                                question;
                        }

                        searchAI(
                            question
                        );

                    }
                );

            }
        );

}


/* =========================================================
   TEST ME
========================================================= */

if (testMeButton) {

    testMeButton.addEventListener(
        "click",
        () => {

            startTest();

        }
    );

}


/* =========================================================
   START TEST
========================================================= */

async function startTest(
    topic = ""
) {

    stopSpeech();


    currentTestTopic =
        cleanText(
            topic ||
            currentQuestionText ||
            aiQuestion?.value ||
            "medical science"
        );


    currentTestNumber =
        0;

    currentTestScore =
        0;

    currentTestAnswered =
        false;

    currentTestUsedIds =
        [];


    if (testPanel) {

        testPanel.style.display =
            "block";

    }


    if (testStatus) {

        testStatus.textContent =
            "Preparing your medical test...";

    }


    if (testProgress) {

        testProgress.textContent =
            `0 / ${currentTestLength}`;

    }


    if (testQuestion) {
        testQuestion.innerHTML = "";
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


    try {

        await loadNextTestQuestion();

    } catch (error) {

        console.error(
            "Test error:",
            error
        );


        if (testStatus) {

            testStatus.textContent =
                error?.message ||
                "Unable to start the test.";

        }

    }

}


/* =========================================================
   LOAD TEST QUESTION
========================================================= */

async function loadNextTestQuestion() {

    currentTestAnswered =
        false;


    if (
        currentTestNumber >=
        currentTestLength
    ) {

        finishTest();

        return;

    }


    currentTestNumber++;


    if (testProgress) {

        testProgress.textContent =
            `${currentTestNumber} / ${currentTestLength}`;

    }


    if (testStatus) {

        testStatus.textContent =
            "Loading question...";

    }


    if (testQuestion) {
        testQuestion.innerHTML = "";
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


    const {
        data: {
            session
        } = {}
    } =
        await supabase.auth
            .getSession();


    const accessToken =
        session?.access_token ||
        "";


    if (!accessToken) {

        throw new Error(
            "You are not signed in."
        );

    }


    const {
        data,
        error
    } =
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

                    searchMwaniki:
                        true,

                    searchWeb:
                        true,

                    searchImages:
                        false

                },

                headers: {

                    Authorization:
                        `Bearer ${accessToken}`

                }

            }
        );


    if (error) {
        throw error;
    }


    if (!data) {

        throw new Error(
            "No test question was returned."
        );

    }


    console.log(
        "Test question:",
        data
    );


    if (
        data.available === false
    ) {

        throw new Error(
            data.message ||
            "A suitable question could not be generated."
        );

    }


    currentTestQuestion =
        normalizeTestQuestion(
            data
        );


    if (
        !currentTestQuestion
    ) {

        throw new Error(
            "The returned test question was incomplete."
        );

    }


    if (
        currentTestQuestion.id
    ) {

        currentTestUsedIds.push(
            currentTestQuestion.id
        );

    }


    renderTestQuestion(
        currentTestQuestion
    );


    /*
       NATURAL VOICE FOR QUESTION.
    */

    speakText(
        currentTestQuestion.question
    );

}


/* =========================================================
   NORMALIZE TEST QUESTION
========================================================= */

function normalizeTestQuestion(
    data
) {

    const question =
        cleanText(
            data.question ||
            data.testQuestion ||
            ""
        );


    const rawOptions =
        Array.isArray(data.options)
            ? data.options
            : [];


    const options =
        rawOptions
            .map(
                option => {

                    if (
                        typeof option ===
                        "string"
                    ) {

                        return {
                            value: "",
                            label:
                                cleanText(
                                    option
                                )
                        };

                    }


                    return {

                        value:
                            cleanText(
                                option.value ||
                                ""
                            ),

                        label:
                            cleanText(
                                option.label ||
                                option.text ||
                                ""
                            )

                    };

                }
            )
            .filter(
                option =>
                    option.label
            )
            .slice(0, 4);


    let correctKey =
        cleanText(
            data.correctKey ||
            data.correct_answer ||
            data.correctAnswer ||
            ""
        )
        .toUpperCase();


    if (
        !["A", "B", "C", "D"]
            .includes(correctKey)
    ) {

        const answerText =
            cleanText(
                data.correctAnswer ||
                data.correct_answer ||
                ""
            );


        const index =
            options.findIndex(
                option =>
                    cleanText(
                        option.label
                    ).toLowerCase() ===
                    answerText.toLowerCase()
            );


        if (index >= 0) {

            correctKey =
                String.fromCharCode(
                    65 + index
                );

        }

    }


    if (
        !question ||
        options.length !== 4 ||
        !["A", "B", "C", "D"]
            .includes(correctKey)
    ) {

        return null;

    }


    return {

        id:
            data.id ||
            data.quizId ||
            "",

        question,

        options,

        correctKey

    };

}


/* =========================================================
   RENDER TEST QUESTION
========================================================= */

function renderTestQuestion(
    question
) {

    if (!testQuestion) {
        return;
    }


    testQuestion.innerHTML = `

        <div class="test-question-number">

            Question
            ${currentTestNumber}
            of
            ${currentTestLength}

        </div>


        <h3>
            ${escapeHTML(
                question.question
            )}
        </h3>

    `;


    if (!testOptions) {
        return;
    }


    testOptions.innerHTML =
        question.options
            .map(
                (option, index) => {

                    const letter =
                        String.fromCharCode(
                            65 + index
                        );


                    return `

                        <button
                            type="button"
                            class="test-option"
                            data-key="${letter}"
                        >

                            <span
                                class="test-option-letter"
                            >
                                ${letter}
                            </span>

                            <span
                                class="test-option-text"
                            >
                                ${escapeHTML(
                                    option.label
                                )}
                            </span>

                        </button>

                    `;

                }
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

                        answerTestQuestion(
                            button.dataset.key
                        );

                    }
                );

            }
        );


    if (testStatus) {

        testStatus.textContent =
            "Choose the best answer.";

    }

}


/* =========================================================
   ANSWER TEST QUESTION
========================================================= */

function answerTestQuestion(
    selectedKey
) {

    if (
        currentTestAnswered ||
        !currentTestQuestion
    ) {
        return;
    }


    currentTestAnswered =
        true;


    const correctKey =
        currentTestQuestion
            .correctKey;


    const selectedButton =
        testOptions?.querySelector(
            `[data-key="${selectedKey}"]`
        );


    const correctButton =
        testOptions?.querySelector(
            `[data-key="${correctKey}"]`
        );


    testOptions
        ?.querySelectorAll(
            ".test-option"
        )
        .forEach(
            button => {

                button.disabled =
                    true;

            }
        );


    if (
        selectedKey ===
        correctKey
    ) {

        currentTestScore++;


        selectedButton
            ?.classList
            .add(
                "correct"
            );


        if (testFeedback) {

            testFeedback.innerHTML = `

                <div class="test-correct-feedback">

                    <div class="feedback-cartoon">
                        🎉
                    </div>

                    <strong>
                        Correct!
                    </strong>

                    <p>
                        Excellent work. Keep going.
                    </p>

                </div>

            `;

        }


        /*
           🎭 CARTOON VOICE
        */

        playCorrectReaction();


    } else {

        selectedButton
            ?.classList
            .add(
                "wrong"
            );


        correctButton
            ?.classList
            .add(
                "correct"
            );


        const correctOption =
            currentTestQuestion.options[
                "ABCD".indexOf(
                    correctKey
                )
            ];


        if (testFeedback) {

            testFeedback.innerHTML = `

                <div class="test-wrong-feedback">

                    <div class="feedback-cartoon">
                        😅
                    </div>

                    <strong>
                        Not quite!
                    </strong>

                    <p>
                        The correct answer is:
                        <strong>
                            ${escapeHTML(
                                correctKey
                            )}
                            —
                            ${escapeHTML(
                                correctOption?.label ||
                                ""
                            )}
                        </strong>
                    </p>

                </div>

            `;

        }


        /*
           🎭 CARTOON VOICE
        */

        playWrongReaction();

    }


    if (testStatus) {

        testStatus.textContent =
            `Score: ${currentTestScore} / ${currentTestNumber}`;

    }


    if (testNext) {

        testNext.style.display =
            "inline-flex";

    }

}


/* =========================================================
   NEXT QUESTION
========================================================= */

if (testNext) {

    testNext.addEventListener(
        "click",
        () => {

            stopSpeech();

            loadNextTestQuestion()
                .catch(
                    error => {

                        console.error(
                            error
                        );

                        if (testStatus) {

                            testStatus.textContent =
                                error?.message ||
                                "Could not load the next question.";

                        }

                    }
                );

        }
    );

}


/* =========================================================
   EXIT TEST
========================================================= */

if (testExit) {

    testExit.addEventListener(
        "click",
        () => {

            stopSpeech();

            exitTest();

        }
    );

}


function exitTest() {

    stopSpeech();


    currentTestQuestion =
        null;

    currentTestNumber =
        0;

    currentTestScore =
        0;

    currentTestAnswered =
        false;

    currentTestUsedIds =
        [];


    if (testPanel) {

        testPanel.style.display =
            "none";

    }


    if (testQuestion) {
        testQuestion.innerHTML = "";
    }


    if (testOptions) {
        testOptions.innerHTML = "";
    }


    if (testFeedback) {
        testFeedback.innerHTML = "";
    }


    if (testStatus) {
        testStatus.textContent = "";
    }


    if (testProgress) {
        testProgress.textContent = "";
    }

}


/* =========================================================
   FINISH TEST
========================================================= */

function finishTest() {

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


    if (testQuestion) {

        testQuestion.innerHTML = `

            <div class="test-finished">

                <div class="test-finished-icon">
                    🏆
                </div>

                <h3>
                    Test Complete
                </h3>

                <p>
                    You scored
                    <strong>
                        ${currentTestScore}
                    </strong>
                    out of
                    <strong>
                        ${currentTestLength}
                    </strong>.
                </p>

                <div class="test-final-score">
                    ${percentage}%
                </div>

            </div>

        `;

    }


    if (testOptions) {
        testOptions.innerHTML = "";
    }


    if (testFeedback) {

        testFeedback.innerHTML = `

            <div class="test-finished-message">

                ${
                    percentage >= 80
                        ? "Excellent performance."
                        : percentage >= 60
                            ? "Good work. Keep reviewing."
                            : "Keep studying and try again."
                }

            </div>

        `;

    }


    if (testNext) {

        testNext.style.display =
            "none";

    }


    if (testStatus) {

        testStatus.textContent =
            `Final score: ${currentTestScore} / ${currentTestLength}`;

    }


    if (testProgress) {

        testProgress.textContent =
            `${currentTestLength} / ${currentTestLength}`;

    }


    /*
       Final score uses the NORMAL voice.
    */

    speakText(
        `Test complete. You scored ${currentTestScore} out of ${currentTestLength}.`
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
        speakText,

    stopSpeech:
        stopSpeech,

    finishTest:
        finishTest

};


/* =========================================================
   INITIALIZATION
========================================================= */

renderRecentQuestions();

loadSpeechVoices();


console.log(
    "🚀 Mwaniki AI Tutor loaded."
);

console.log(
    "🔊 Natural voice:",
    selectedNaturalVoice?.name ||
    "browser default"
);

console.log(
    "🎭 Cartoon voice:",
    selectedCartoonVoice?.name ||
    "pitch fallback"
);

console.log(
    "🧠 Smart Test:",
    Boolean(testPanel)
);

console.log(
    "🔎 Google Search:",
    Boolean(webResults)
);

console.log(
    "🖼 Google Images:",
    Boolean(aiImages)
);
```
