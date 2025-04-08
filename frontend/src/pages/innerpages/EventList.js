import React, { useState, useEffect, useRef } from "react";
import SEO from "../../common/SEO";
import Layout from "../../common/Layout";
import loadinggif from "../../assets/images/loading.gif";
import robotarm from "../../assets/images/robotarm.svg";
import final from "../../assets/images/final.svg";
import { FlashcardArray } from "react-quizlet-flashcard";
import summarywhiteicon from "../../assets/images/summarywhiteicon.svg";
import summaryblueicon from "../../assets/images/summaryblueicon.svg";
import originalIcon from "../../assets/images/original.svg";
import whiteIcon from "../../assets/images/white.svg";
import quizwhiteicon from "../../assets/images/quizwhiteicon.svg";
import quizblueicon from "../../assets/images/quizblueicon.svg";
import flashcardwhiteicon from "../../assets/images/flashcardwhiteicon.svg";
import flashcardblueicon from "../../assets/images/flashcardblueicon.svg";

// --- Constants ---
const API_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  LOADED: "loaded",
  LOADED_EMPTY: "loaded_empty",
  ERROR: "error",
};

const EventList = () => {
  // --- State Definitions (Unchanged) ---
  const [state, setState] = useState({
    youtubeLink: "",
    apiData: {
      summary: {},
      subjects: {},
      quizzes: null,
      transcript: null,
      flashcards: null,
    },
    isInitialLoading: false,
    quizState: API_STATE.IDLE,
    flashcardState: API_STATE.IDLE,
    initialDataLoaded: false,
    selectedText: "",
    summarySelected: true,
    subjectsSelected: false,
    user_id: "94bd2faf-d21b-452d-a9a2-0159363a11fd",
    errorMessage: null,
  });
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const stepTwoRef = useRef(null);
  const onDemandSectionRef = useRef(null);

  // --- Event Handlers & Effects (Unchanged) ---
  const handleSummaryClick = () => {
    if (state.apiData.summary?.data) {
      setState((prevState) => ({
        ...prevState,
        summarySelected: true,
        subjectsSelected: false,
        selectedText: <div>{prevState.apiData.summary.data}</div>,
        errorMessage: null,
      }));
    }
  };
  const handleSubjectsClick = () => {
    const { subjects } = state.apiData;
    if (subjects?.data && Array.isArray(subjects.data)) {
      const content = (
        <ul>
          {" "}
          {subjects.data.map((s, i) => (
            <li key={i}>{s}</li>
          ))}{" "}
        </ul>
      );
      setState((prevState) => ({
        ...prevState,
        summarySelected: false,
        subjectsSelected: true,
        selectedText: content,
        errorMessage: null,
      }));
    } else {
      setState((prevState) => ({
        ...prevState,
        summarySelected: false,
        subjectsSelected: true,
        selectedText: <div>Subjects data not available.</div>,
        errorMessage: null,
      }));
    }
  };
  useEffect(() => {
    if (
      state.initialDataLoaded &&
      !state.isInitialLoading &&
      stepTwoRef.current
    ) {
      stepTwoRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.initialDataLoaded, state.isInitialLoading]);
  useEffect(() => {
    if (
      (state.quizState === API_STATE.LOADED ||
        state.flashcardState === API_STATE.LOADED ||
        state.quizState === API_STATE.LOADED_EMPTY ||
        state.flashcardState === API_STATE.LOADED_EMPTY) &&
      onDemandSectionRef.current
    ) {
      onDemandSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [state.quizState, state.flashcardState]);

  // --- Data Fetching Logic (fetchData, wait - Unchanged) ---
  const fetchData = async (endpoint, body) => {
    const apiUrl = `/api/${endpoint}/`;
    console.log(`Sending request to: ${apiUrl}`);
    console.log(
      "Request body (first 100 chars):",
      JSON.stringify({
        ...body,
        transcript: body.transcript?.substring(0, 100) + "...",
      })
    );
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBodyText = await response.text();
      if (!response.ok) {
        console.error(
          `HTTP Error ${response.status} from ${apiUrl}:`,
          responseBodyText
        );
        let detail = `Network response was not ok (Status: ${response.status}).`;
        try {
          const errorJson = JSON.parse(responseBodyText);
          detail = errorJson.detail || detail;
        } catch (e) {}
        const error = new Error(detail);
        error.status = response.status;
        throw error;
      }
      try {
        return JSON.parse(responseBodyText);
      } catch (e) {
        console.error(`Failed to parse JSON from ${apiUrl}:`, responseBodyText);
        throw new Error(`Received non-JSON response.`);
      }
    } catch (error) {
      console.error(`Error fetching data from ${apiUrl}:`, error);
      throw error;
    }
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const onDemandFetchDelay = 0; // Can set back to 0 if desired

  // --- handleSubmit for Initial Generation (Unchanged) ---
  const handleSubmit = async (event) => {
    event.preventDefault();
    setState((prevState) => ({
      ...prevState,
      isInitialLoading: true,
      initialDataLoaded: false,
      errorMessage: null,
      apiData: {
        transcript: null,
        summary: {},
        subjects: {},
        quizzes: null,
        flashcards: null,
      },
      quizState: API_STATE.IDLE,
      flashcardState: API_STATE.IDLE,
      selectedText: "",
      summarySelected: true,
      subjectsSelected: false,
    }));
    setSelectedAnswers({});
    let transcript = null;
    let summaryData = null;
    let subjectsData = null;
    try {
      console.log("Fetching transcript...");
      const tr = await fetchData("yt_link", {
        url: state.youtubeLink,
        user_id: state.user_id,
      });
      if (!tr?.transcript) throw new Error("Invalid transcript.");
      transcript = tr.transcript;
      console.log(`Transcript fetched (len: ${transcript.length}).`);
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, transcript: transcript },
      }));
      console.log("Fetching summary...");
      summaryData = await fetchData("summary", {
        transcript: transcript,
        user_id: state.user_id,
      });
      console.log("Summary fetched.");
      console.log("Fetching subjects...");
      subjectsData = await fetchData("subjects", {
        transcript: transcript,
        user_id: state.user_id,
      });
      console.log("Subjects fetched.");
      console.log("Initial data gen complete.");
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, summary: summaryData, subjects: subjectsData },
        isInitialLoading: false,
        initialDataLoaded: true,
        selectedText: summaryData?.data ? (
          <div>{summaryData.data}</div>
        ) : (
          <div>Summary generated.</div>
        ),
        summarySelected: true,
        subjectsSelected: false,
        errorMessage: null,
      }));
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      let msg = `An error occurred: ${error.message}`;
      if (error.status === 429)
        msg = "API Rate Limit Exceeded during initial generation.";
      else if (error.message.includes("transcript"))
        msg = "Failed to get a valid transcript.";
      setState((p) => ({ ...p, isInitialLoading: false, errorMessage: msg }));
    }
  };

  // --- handleGenerateQuiz (Unchanged from fix for parsing) ---
  const handleGenerateQuiz = async () => {
    if (!state.apiData.transcript || state.quizState === API_STATE.LOADING)
      return;
    console.log("Requesting Quiz Generation...");
    await wait(onDemandFetchDelay);
    setState((p) => ({
      ...p,
      quizState: API_STATE.LOADING,
      errorMessage: null,
    }));
    setSelectedAnswers({});
    try {
      console.log(
        `Sending transcript (len: ${state.apiData.transcript.length}) for quiz.`
      );
      const res = await fetchData("quiz", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
      });
      console.log("Raw quiz response:", res);
      const items = (res?.data || [])
        .map((q) => {
          if (
            q &&
            typeof q === "object" &&
            q.question &&
            Array.isArray(q.answers) &&
            q.hasOwnProperty("correct_answer")
          ) {
            return q;
          } else {
            console.warn("Skipping invalid quiz structure:", q);
            return null;
          }
        })
        .filter(Boolean);
      const newState =
        items.length > 0 ? API_STATE.LOADED : API_STATE.LOADED_EMPTY;
      if (newState === API_STATE.LOADED_EMPTY)
        console.warn("Quiz gen OK but returned zero valid questions.");
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, quizzes: { data: items } },
        quizState: newState,
      }));
    } catch (error) {
      console.error("Error generating quiz:", error);
      let msg = `Failed to generate quiz: ${error.message}`;
      if (error.status === 429)
        msg = "API Rate Limit Exceeded generating quiz.";
      setState((p) => ({
        ...p,
        quizState: API_STATE.ERROR,
        errorMessage: msg,
      }));
    }
  };

  // --- handleGenerateFlashcards (Unchanged from fix for parsing) ---
  const handleGenerateFlashcards = async () => {
    if (!state.apiData.transcript || state.flashcardState === API_STATE.LOADING)
      return;
    console.log("Requesting Flashcard Generation...");
    await wait(onDemandFetchDelay);
    setState((p) => ({
      ...p,
      flashcardState: API_STATE.LOADING,
      errorMessage: null,
    }));
    try {
      console.log(
        `Sending transcript (len: ${state.apiData.transcript.length}) for flashcards.`
      );
      const res = await fetchData("flashcards", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
      });
      console.log("Raw flashcards response:", res);
      let adapted = [];
      if (
        res &&
        Array.isArray(res.questions) &&
        Array.isArray(res.answers) &&
        Array.isArray(res.images)
      ) {
        adapted = res.questions.map((q, i) => ({
          id: i,
          frontHTML: (
            <div
              style={{ display: "flex", height: "100%", alignItems: "center" }}
            >
              {" "}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "0 10px",
                  textAlign: "left",
                }}
              >
                {" "}
                <div className="flashcard-title">
                  {" "}
                  <h6 style={{ margin: 0 }}>{q || "N/A"}</h6>{" "}
                </div>{" "}
              </div>{" "}
              <div
                style={{
                  flex: 0.8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {" "}
                <img
                  src={res.images[i] || loadinggif}
                  alt="Flashcard visual"
                  className="img-thumbnail flashcard-img"
                  style={{
                    maxHeight: "150px",
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />{" "}
              </div>{" "}
            </div>
          ),
          backHTML: (
            <div className="backstyle">
              {" "}
              <div className="backstyle-text">
                {" "}
                <h4>{res.answers[i] || "N/A"}</h4>{" "}
              </div>{" "}
            </div>
          ),
        }));
      } else {
        console.warn("Flashcard data invalid.", res);
        throw new Error("Incomplete flashcard data.");
      }
      const newState =
        adapted.length > 0 ? API_STATE.LOADED : API_STATE.LOADED_EMPTY;
      if (newState === API_STATE.LOADED_EMPTY)
        console.warn("Flashcard gen OK but zero valid cards.");
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, flashcards: adapted },
        flashcardState: newState,
      }));
    } catch (error) {
      console.error("Error generating flashcards:", error);
      let msg = `Failed to generate flashcards: ${error.message}`;
      if (error.status === 429)
        msg = "API Rate Limit Exceeded generating flashcards.";
      setState((p) => ({
        ...p,
        flashcardState: API_STATE.ERROR,
        errorMessage: msg,
      }));
    }
  };

  // --- CORRECTED Quiz Component ---
  const QuizzesContent = ({
    quizzesData,
    selectedAnswers,
    setSelectedAnswers,
  }) => {
    // quizzesData is the array of quiz objects: [{question, answers, correct_answer (index)}, ...]
    if (!quizzesData || quizzesData.length === 0) {
      return <div>No quiz questions available to display.</div>;
    }

    // Calculate score based on comparing selected answer *text* to the correct answer *text*
    let correctAnswersCount = 0;
    quizzesData.forEach((quiz, index) => {
      if (quiz && selectedAnswers.hasOwnProperty(index)) {
        // Get the text of the correct answer using the index
        const correctAnswerText = quiz.answers?.[quiz.correct_answer];
        // Compare the stored selected answer text with the actual correct answer text
        if (
          correctAnswerText !== undefined &&
          selectedAnswers[index] === correctAnswerText
        ) {
          correctAnswersCount += 1;
        }
      }
    });

    const handleAnswerChange = (quizIndex, answerValue) => {
      // Store the selected answer's *text* in the state
      setSelectedAnswers((prevSelectedAnswers) => ({
        ...prevSelectedAnswers,
        [quizIndex]: answerValue,
      }));
    };

    return (
      <form onSubmit={(e) => e.preventDefault()}>
        {quizzesData.map((quiz, index) => {
          // Basic validation for each quiz item
          if (
            !quiz ||
            !quiz.question ||
            !Array.isArray(quiz.answers) ||
            typeof quiz.correct_answer !== "number"
          ) {
            console.warn("Skipping rendering of invalid quiz item:", quiz);
            return null;
          }
          // Get the text of the correct answer for this question
          const correctAnswerText = quiz.answers[quiz.correct_answer];

          return (
            <div key={index} className="quiz-block">
              <h4 className="question-heading">
                {" "}
                Q{index + 1}: {quiz.question}{" "}
              </h4>
              {quiz.answers.map((answer, answerIndex) => {
                // Determine if this specific radio button is the one the user selected
                const isChecked = selectedAnswers[index] === answer;

                // Determine display styles *after* an answer has been selected for this question
                let labelClassName = "";
                let flag = null;
                if (selectedAnswers.hasOwnProperty(index)) {
                  // Check if user answered this question
                  const userSelectedAnswerText = selectedAnswers[index];

                  if (isChecked) {
                    // This is the radio button the user selected
                    if (userSelectedAnswerText === correctAnswerText) {
                      // Selected answer IS correct
                      labelClassName = "correct-answer";
                      flag = <span className="answer-flag"> ✅</span>;
                    } else {
                      // Selected answer IS incorrect
                      labelClassName = "incorrect-answer";
                      flag = <span className="answer-flag"> ❌</span>;
                    }
                  } else {
                    // This radio button was NOT selected
                    // Check if this UNSELECTED option is the ACTUAL correct answer
                    if (answer === correctAnswerText) {
                      labelClassName = "correct-answer-unselected"; // Style to highlight the correct answer if user was wrong
                    }
                  }
                } // End if user answered this question

                return (
                  <div
                    key={answerIndex}
                    className={`quiz-option ${labelClassName}`}
                  >
                    <input
                      type="radio"
                      id={`question-${index}-option-${answerIndex}`}
                      name={`question-${index}`}
                      value={answer} // The value is the answer text
                      // Update state with the answer text when changed
                      onChange={(e) =>
                        handleAnswerChange(index, e.target.value)
                      }
                      checked={isChecked} // Check based on stored answer text
                      // Disable further changes once an answer is selected for this question (optional)
                      // disabled={selectedAnswers.hasOwnProperty(index)}
                    />
                    <label htmlFor={`question-${index}-option-${answerIndex}`}>
                      {answer}
                      {flag} {/* Show flag only next to the selected answer */}
                    </label>
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* Display Score */}
        <div className="correct-answers-count">
          {Object.keys(selectedAnswers).length > 0 &&
            `Score: ${correctAnswersCount} / ${quizzesData.length}`}
        </div>
      </form>
    );
  };

  // --- Render Logic (Unchanged Structure) ---
  return (
    <>
      <SEO title="EduAction Generator" />
      <Layout>
        {/* Step 1 */}
        <div className="containersteps">
          <h2 className="stepsname">Step 1: Paste your YouTube link</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="wrapper2">
                {" "}
                <input
                  type="url"
                  id="youtubelink"
                  className="linkinput form-control form-control-lg"
                  placeholder="Enter YouTube link..."
                  pattern="https?://(www\.)?youtube\.com/watch\?v=.*|https?://youtu\.be/.*"
                  title="Please enter a valid YouTube video URL"
                  required
                  value={state.youtubeLink}
                  onChange={(e) =>
                    setState({ ...state, youtubeLink: e.target.value })
                  }
                  disabled={state.isInitialLoading}
                />{" "}
              </div>
              <div className="wrapper2">
                {" "}
                <button
                  type="submit"
                  className="buttons1"
                  disabled={state.isInitialLoading}
                >
                  {" "}
                  {state.isInitialLoading
                    ? "Processing..."
                    : "Generate Summary & Subjects"}{" "}
                </button>{" "}
              </div>
              {!state.isInitialLoading && (
                <div className="text2">
                  <ul>
                    <li>Make sure it's a public YouTube video link.</li>
                    <li>Include https://</li>
                    <li>Ensure captions/subtitles are available.</li>
                  </ul>
                </div>
              )}
            </div>
          </form>
          {state.errorMessage &&
            !state.isInitialLoading &&
            state.quizState !== API_STATE.LOADING &&
            state.flashcardState !== API_STATE.LOADING && (
              <div className="error-message-general">{state.errorMessage}</div>
            )}
        </div>

        {/* Step 1.5 Loading */}
        {state.isInitialLoading && (
          <div className="containersteps2 containerstepscooking">
            {" "}
            <div className="text-content">
              {" "}
              <h2 className="stepsname">Brewing Initial Insights...</h2>{" "}
              <div className="text2">
                {" "}
                <h6 className="text2">What the AI is doing:</h6>{" "}
                <ul>
                  {" "}
                  <li>Fetching transcript...</li> <li>Generating summary...</li>{" "}
                  <li>Finding key subjects...</li>{" "}
                </ul>{" "}
              </div>{" "}
              <img src={loadinggif} alt="Loading..." className="loading" />{" "}
            </div>{" "}
            <img src={robotarm} alt="AI Processing" className="robot-arm" />{" "}
          </div>
        )}

        {/* Step 2 & On-Demand Triggers */}
        {state.initialDataLoaded && !state.isInitialLoading && (
          <div ref={stepTwoRef} className="containersteps2">
            <h2 className="stepsname">Step 2: Summary & Subjects</h2>
            <div className="button-row">
              <button
                type="button"
                className={`buttons1 ${
                  state.summarySelected ? "" : "unselected"
                }`}
                onClick={handleSummaryClick}
                disabled={!state.apiData.summary?.data}
              >
                {" "}
                <img
                  src={
                    state.summarySelected ? summarywhiteicon : summaryblueicon
                  }
                  alt=""
                  className="button-icon"
                />{" "}
                Summary{" "}
              </button>
              <button
                type="button"
                className={`buttons1 ${
                  state.subjectsSelected ? "" : "unselected"
                }`}
                onClick={handleSubjectsClick}
                disabled={!state.apiData.subjects?.data}
              >
                {" "}
                <img
                  src={state.subjectsSelected ? whiteIcon : originalIcon}
                  alt=""
                  className="button-icon"
                />{" "}
                Subjects{" "}
              </button>
            </div>
            {state.selectedText && (
              <div className="text-box">{state.selectedText}</div>
            )}
            <h3 className="stepsname" style={{ marginTop: "30px" }}>
              Step 3: Generate More (Optional)
            </h3>
            {(state.quizState === API_STATE.ERROR ||
              state.flashcardState === API_STATE.ERROR) &&
              state.errorMessage && (
                <div
                  className="error-message-general"
                  style={{ marginTop: "10px" }}
                >
                  {state.errorMessage}
                </div>
              )}
            <div className="button-row">
              <button
                type="button"
                className="buttons1 button-generate"
                onClick={handleGenerateQuiz}
                disabled={
                  state.quizState === API_STATE.LOADING ||
                  state.quizState === API_STATE.LOADED ||
                  state.quizState === API_STATE.LOADED_EMPTY ||
                  !state.apiData.transcript
                }
              >
                {state.quizState === API_STATE.LOADING ? (
                  <>
                    {" "}
                    <img
                      src={loadinggif}
                      alt=""
                      className="loading-inline"
                    />{" "}
                    Generating Quiz...{" "}
                  </>
                ) : state.quizState === API_STATE.LOADED ||
                  state.quizState === API_STATE.LOADED_EMPTY ? (
                  <>
                    {" "}
                    <img
                      src={quizwhiteicon}
                      alt=""
                      className="button-icon"
                    />{" "}
                    Quiz Generated{" "}
                  </>
                ) : (
                  <> Generate Quiz </>
                )}
              </button>
              <button
                type="button"
                className="buttons1 button-generate"
                onClick={handleGenerateFlashcards}
                disabled={
                  state.flashcardState === API_STATE.LOADING ||
                  state.flashcardState === API_STATE.LOADED ||
                  state.flashcardState === API_STATE.LOADED_EMPTY ||
                  !state.apiData.transcript
                }
              >
                {state.flashcardState === API_STATE.LOADING ? (
                  <>
                    {" "}
                    <img
                      src={loadinggif}
                      alt=""
                      className="loading-inline"
                    />{" "}
                    Generating Flashcards...{" "}
                  </>
                ) : state.flashcardState === API_STATE.LOADED ||
                  state.flashcardState === API_STATE.LOADED_EMPTY ? (
                  <>
                    {" "}
                    <img
                      src={flashcardwhiteicon}
                      alt=""
                      className="button-icon"
                    />{" "}
                    Flashcards Generated{" "}
                  </>
                ) : (
                  <> Generate Flashcards </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* On-Demand Content Display */}
        <div ref={onDemandSectionRef}>
          {(state.quizState === API_STATE.LOADED ||
            state.quizState === API_STATE.LOADED_EMPTY ||
            state.flashcardState === API_STATE.LOADED ||
            state.flashcardState === API_STATE.LOADED_EMPTY ||
            state.quizState === API_STATE.ERROR ||
            state.flashcardState === API_STATE.ERROR) &&
            state.initialDataLoaded && (
              <div className="containersteps3">
                {/* Quiz Section */}
                {(state.quizState === API_STATE.LOADED ||
                  state.quizState === API_STATE.LOADED_EMPTY ||
                  state.quizState === API_STATE.ERROR) && (
                  <>
                    <h2 className="stepsname" style={{ marginBottom: "20px" }}>
                      Generated Quiz
                    </h2>
                    <div className="text-box">
                      {state.quizState === API_STATE.LOADED ? (
                        <QuizzesContent
                          quizzesData={state.apiData.quizzes?.data || []}
                          selectedAnswers={selectedAnswers}
                          setSelectedAnswers={setSelectedAnswers}
                        />
                      ) : state.quizState === API_STATE.LOADED_EMPTY ? (
                        <div>
                          Quiz generation complete, but no questions were found.
                        </div>
                      ) : state.quizState === API_STATE.ERROR &&
                        state.errorMessage ? (
                        <div className="error-message">
                          {state.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
                {/* Flashcard Section */}
                {(state.flashcardState === API_STATE.LOADED ||
                  state.flashcardState === API_STATE.LOADED_EMPTY ||
                  state.flashcardState === API_STATE.ERROR) && (
                  <>
                    <h2
                      className="stepsname"
                      style={{ marginTop: "30px", marginBottom: "20px" }}
                    >
                      Generated Flashcards
                    </h2>
                    <div className="text-box2">
                      {state.flashcardState === API_STATE.LOADED ? (
                        <FlashcardArray
                          cards={state.apiData.flashcards || []}
                          frontCardStyle={{
                            backgroundColor: "#e0f7fa",
                            border: "1px solid #007bff",
                            borderRadius: "8px",
                            padding: "15px",
                          }}
                          backCardStyle={{
                            backgroundColor: "#fff3e0",
                            border: "1px solid #ff9800",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "15px",
                            height: "100%",
                            width: "100%",
                          }}
                        />
                      ) : state.flashcardState === API_STATE.LOADED_EMPTY ? (
                        <div>
                          Flashcard generation complete, but no cards were
                          created.
                        </div>
                      ) : state.flashcardState === API_STATE.ERROR &&
                        state.errorMessage ? (
                        <div className="error-message">
                          {state.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
        </div>
      </Layout>
    </>
  );
};

export default EventList;
