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
  LOADED_EMPTY: "loaded_empty", // New state for loaded but no results
  ERROR: "error",
};

const EventList = () => {
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

  // --- Event Handlers & Effects (mostly unchanged) ---
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
    if (subjects && subjects.data && Array.isArray(subjects.data)) {
      const subjectsContent = (
        <ul>
          {" "}
          {subjects.data.map((subject, index) => (
            <li key={index}>{subject}</li>
          ))}{" "}
        </ul>
      );
      setState((prevState) => ({
        ...prevState,
        summarySelected: false,
        subjectsSelected: true,
        selectedText: subjectsContent,
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

  // --- Data Fetching Logic (fetchData unchanged) ---
  const fetchData = async (endpoint, body) => {
    const apiUrl = `/api/${endpoint}/`;
    console.log(`Sending request to: ${apiUrl}`);
    console.log(
      "Request body (first 100 chars of transcript):",
      JSON.stringify({
        ...body,
        transcript: body.transcript?.substring(0, 100) + "...",
      })
    ); // Log truncated transcript
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
        console.error(
          `Failed to parse JSON response from ${apiUrl}:`,
          responseBodyText
        );
        throw new Error(
          `Received non-JSON response from server for ${apiUrl}.`
        );
      }
    } catch (error) {
      console.error(`Error fetching data from ${apiUrl}:`, error);
      throw error;
    }
  };

  // Optional small delay function
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const onDemandFetchDelay = 500; // Small delay (0.5s) before on-demand fetch, can be 0

  // --- handleSubmit for Initial Generation (unchanged) ---
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
      const transcriptResponse = await fetchData("yt_link", {
        url: state.youtubeLink,
        user_id: state.user_id,
      });
      if (!transcriptResponse?.transcript) {
        throw new Error("Failed to fetch a valid transcript.");
      }
      transcript = transcriptResponse.transcript;
      console.log(`Transcript fetched (length: ${transcript.length}).`);
      setState((prevState) => ({
        ...prevState,
        apiData: { ...prevState.apiData, transcript: transcript },
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
      console.log("Initial data generation complete.");
      setState((prevState) => ({
        ...prevState,
        apiData: {
          ...prevState.apiData,
          summary: summaryData,
          subjects: subjectsData,
        },
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
      console.error("Error during initial handleSubmit sequence:", error);
      let userErrorMessage = `An error occurred: ${error.message}`;
      if (error.status === 429) {
        userErrorMessage =
          "API Rate Limit Exceeded during initial generation. Please wait a minute and try again.";
      } else if (error.message.includes("transcript")) {
        userErrorMessage =
          "Failed to get a valid transcript. Check the link/captions.";
      }
      setState((prevState) => ({
        ...prevState,
        isInitialLoading: false,
        errorMessage: userErrorMessage,
      }));
    }
  };

  // --- Refined handleGenerateQuiz ---
  const handleGenerateQuiz = async () => {
    if (!state.apiData.transcript || state.quizState === API_STATE.LOADING)
      return;
    console.log("Requesting Quiz Generation...");
    // Add optional small delay before fetching
    await wait(onDemandFetchDelay);
    setState((prevState) => ({
      ...prevState,
      quizState: API_STATE.LOADING,
      errorMessage: null,
    }));
    setSelectedAnswers({});

    try {
      console.log(
        `Sending transcript (length: ${state.apiData.transcript.length}) for quiz generation.`
      ); // Log length
      const quizzesResponse = await fetchData("quiz", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
      });
      console.log("Raw quiz response from backend:", quizzesResponse);

      const quizItems = (quizzesResponse?.data || [])
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
            console.warn("Skipping invalid quiz item structure:", q);
            return null;
          }
        })
        .filter(Boolean);

      const newState =
        quizItems.length > 0 ? API_STATE.LOADED : API_STATE.LOADED_EMPTY; // Set specific state
      if (newState === API_STATE.LOADED_EMPTY) {
        console.warn(
          "Quiz generation succeeded but returned zero valid questions."
        );
      }

      setState((prevState) => ({
        ...prevState,
        apiData: { ...prevState.apiData, quizzes: { data: quizItems } },
        quizState: newState, // Use LOADED or LOADED_EMPTY
      }));
    } catch (error) {
      console.error("Error generating quiz:", error);
      let userErrorMessage = `Failed to generate quiz: ${error.message}`;
      if (error.status === 429) {
        userErrorMessage =
          "API Rate Limit Exceeded while generating quiz. Please try again later.";
      }
      setState((prevState) => ({
        ...prevState,
        quizState: API_STATE.ERROR,
        errorMessage: userErrorMessage,
      }));
    }
  };

  // --- Refined handleGenerateFlashcards ---
  const handleGenerateFlashcards = async () => {
    if (!state.apiData.transcript || state.flashcardState === API_STATE.LOADING)
      return;
    console.log("Requesting Flashcard Generation...");
    await wait(onDemandFetchDelay); // Optional small delay
    setState((prevState) => ({
      ...prevState,
      flashcardState: API_STATE.LOADING,
      errorMessage: null,
    }));

    try {
      console.log(
        `Sending transcript (length: ${state.apiData.transcript.length}) for flashcard generation.`
      ); // Log length
      const flashcardsData = await fetchData("flashcards", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
      });
      console.log("Raw flashcards response from backend:", flashcardsData);

      let adaptedFlashcards = [];
      if (
        flashcardsData &&
        Array.isArray(flashcardsData.questions) &&
        Array.isArray(flashcardsData.answers) &&
        Array.isArray(flashcardsData.images)
      ) {
        adaptedFlashcards = flashcardsData.questions.map((question, i) => ({
          id: i, // Add checks for missing data inside if needed
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
                  <h6 style={{ margin: 0 }}>{question || "N/A"}</h6>{" "}
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
                  src={flashcardsData.images[i] || loadinggif}
                  alt="Flashcard visual representation"
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
                <h4>{flashcardsData.answers[i] || "N/A"}</h4>{" "}
              </div>{" "}
            </div>
          ),
        }));
      } else {
        console.warn(
          "Flashcard data received is incomplete/invalid.",
          flashcardsData
        );
        // Decide if this is an error or just loaded empty
        // Let's treat it as LOADED_EMPTY for now if the request succeeded (status 200)
        // throw new Error("Received incomplete data for flashcards."); // Or throw error
      }

      const newState =
        adaptedFlashcards.length > 0
          ? API_STATE.LOADED
          : API_STATE.LOADED_EMPTY;
      if (newState === API_STATE.LOADED_EMPTY) {
        console.warn(
          "Flashcard generation succeeded but returned zero valid cards."
        );
      }

      setState((prevState) => ({
        ...prevState,
        apiData: { ...prevState.apiData, flashcards: adaptedFlashcards },
        flashcardState: newState, // Use LOADED or LOADED_EMPTY
      }));
    } catch (error) {
      console.error("Error generating flashcards:", error);
      let userErrorMessage = `Failed to generate flashcards: ${error.message}`;
      if (error.status === 429) {
        userErrorMessage =
          "API Rate Limit Exceeded while generating flashcards. Please try again later.";
      }
      setState((prevState) => ({
        ...prevState,
        flashcardState: API_STATE.ERROR,
        errorMessage: userErrorMessage,
      }));
    }
  };

  // --- Quiz Component (Unchanged, but uses state correctly) ---
  const QuizzesContent = ({
    quizzesData,
    selectedAnswers,
    setSelectedAnswers,
  }) => {
    if (!quizzesData || quizzesData.length === 0)
      return <div>No quiz questions available to display.</div>; // More specific message
    let correctAnswersCount = 0;
    quizzesData.forEach((quiz, index) => {
      if (
        quiz &&
        selectedAnswers.hasOwnProperty(index) &&
        quiz.correct_answer === selectedAnswers[index]
      ) {
        correctAnswersCount += 1;
      }
    });
    const handleAnswerChange = (quizIndex, answerValue) => {
      setSelectedAnswers((prev) => ({ ...prev, [quizIndex]: answerValue }));
    };
    return (
      <form onSubmit={(e) => e.preventDefault()}>
        {" "}
        {quizzesData.map((quiz, index) => {
          if (!quiz || !Array.isArray(quiz.answers)) return null;
          return (
            <div key={index} className="quiz-block">
              {" "}
              <h4 className="question-heading">
                {" "}
                Q{index + 1}: {quiz.question}{" "}
              </h4>{" "}
              {quiz.answers.map((answer, answerIndex) => {
                const isChecked = selectedAnswers[index] === answer;
                const isSelectedCorrect =
                  isChecked && quiz.correct_answer === answer;
                const isCorrectOption = quiz.correct_answer === answer;
                let labelClassName = "";
                let flag = null;
                if (selectedAnswers.hasOwnProperty(index)) {
                  if (isChecked) {
                    labelClassName = isSelectedCorrect
                      ? "correct-answer"
                      : "incorrect-answer";
                    flag = isSelectedCorrect ? (
                      <span className="answer-flag"> ✅</span>
                    ) : (
                      <span className="answer-flag"> ❌</span>
                    );
                  } else if (isCorrectOption) {
                    labelClassName = "correct-answer-unselected";
                  }
                }
                return (
                  <div
                    key={answerIndex}
                    className={`quiz-option ${labelClassName}`}
                  >
                    {" "}
                    <input
                      type="radio"
                      id={`question-${index}-option-${answerIndex}`}
                      name={`question-${index}`}
                      value={answer}
                      onChange={(e) =>
                        handleAnswerChange(index, e.target.value)
                      }
                      checked={isChecked}
                    />{" "}
                    <label htmlFor={`question-${index}-option-${answerIndex}`}>
                      {answer}
                      {flag}
                    </label>{" "}
                  </div>
                );
              })}{" "}
            </div>
          );
        })}{" "}
        <div className="correct-answers-count">
          {" "}
          {Object.keys(selectedAnswers).length > 0 &&
            `Score: ${correctAnswersCount} / ${quizzesData.length}`}{" "}
        </div>{" "}
      </form>
    );
  };

  // --- Render Logic (Adjusted for new states) ---
  return (
    <>
      <SEO title="EduAction Generator" />
      <Layout>
        {/* --- Step 1: Input Link --- */}
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
          {/* General Error Display */}
          {state.errorMessage &&
            !state.isInitialLoading &&
            state.quizState !== API_STATE.LOADING &&
            state.flashcardState !== API_STATE.LOADING && (
              <div className="error-message-general">{state.errorMessage}</div>
            )}
        </div>

        {/* --- Step 1.5: Cooking/Loading (for Initial Load) --- */}
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

        {/* --- Step 2: Summary & Subjects & On-Demand Triggers --- */}
        {state.initialDataLoaded && !state.isInitialLoading && (
          <div ref={stepTwoRef} className="containersteps2">
            <h2 className="stepsname">Step 2: Summary & Subjects</h2>
            {/* Summary/Subjects Tabs */}
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
            {/* Display Area */}
            {state.selectedText && (
              <div className="text-box">{state.selectedText}</div>
            )}

            {/* --- On-Demand Generation Section --- */}
            <h3 className="stepsname" style={{ marginTop: "30px" }}>
              Step 3: Generate More (Optional)
            </h3>
            {/* On-Demand Error Display */}
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
            {/* On-Demand Buttons */}
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
                  </> // Combined loaded states for button display
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
                  </> // Combined loaded states
                ) : (
                  <> Generate Flashcards </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* --- Display Area for On-Demand Content (Quiz/Flashcards) --- */}
        <div ref={onDemandSectionRef}>
          {/* Show Quiz Area if Loaded (with or without data) or if Error occurred after trying */}
          {(state.quizState === API_STATE.LOADED ||
            state.quizState === API_STATE.LOADED_EMPTY ||
            state.quizState === API_STATE.ERROR) &&
            state.initialDataLoaded && (
              <div className="containersteps3">
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
                      Quiz generation complete, but no questions were found for
                      this content.
                    </div>
                  ) : state.quizState === API_STATE.ERROR &&
                    state.errorMessage ? (
                    <div className="error-message">{state.errorMessage}</div> // Show specific error if loading failed
                  ) : null}
                </div>
              </div>
            )}

          {/* Show Flashcard Area if Loaded (with or without data) or if Error occurred */}
          {(state.flashcardState === API_STATE.LOADED ||
            state.flashcardState === API_STATE.LOADED_EMPTY ||
            state.flashcardState === API_STATE.ERROR) &&
            state.initialDataLoaded && (
              <div
                className="containersteps3"
                style={{
                  marginTop: state.quizState !== API_STATE.IDLE ? "30px" : "0",
                }}
              >
                {" "}
                {/* Add margin if quiz section is also shown */}
                <h2 className="stepsname" style={{ marginBottom: "20px" }}>
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
                      Flashcard generation complete, but no cards were created
                      for this content.
                    </div>
                  ) : state.flashcardState === API_STATE.ERROR &&
                    state.errorMessage ? (
                    <div className="error-message">{state.errorMessage}</div>
                  ) : null}
                </div>
              </div>
            )}
        </div>

        {/* Final Screen remains optional */}
      </Layout>
    </>
  );
};

export default EventList;
