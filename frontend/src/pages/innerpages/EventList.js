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
import "./EventList.css";

// --- Constants ---
const API_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  LOADED: "loaded",
  LOADED_EMPTY: "loaded_empty",
  ERROR: "error",
};
const QUIZ_MODE = { ACTIVE: "active", REVIEW: "review" };
const BONUS_QUIZ_STATE = {
  IDLE: "idle",
  LOADING: "loading",
  LOADED: "loaded",
  ERROR: "error",
  NOT_QUALIFIED: "not_qualified",
  LOADED_EMPTY: "loaded_empty",
};
const SCORE_THRESHOLD = 0.8;
const NUM_BONUS_QUESTIONS = 5;

const EventList = () => {
  // --- State Definitions ---
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
    easyQuizState: API_STATE.IDLE,
    mediumQuizState: API_STATE.IDLE,
    difficultQuizState: API_STATE.IDLE,
    flashcardState: API_STATE.IDLE,
    initialDataLoaded: false,
    selectedText: "",
    summarySelected: true,
    subjectsSelected: false,
    user_id: "94bd2faf-d21b-452d-a9a2-0159363a11fd",
    errorMessage: null,
  });
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizMode, setQuizMode] = useState(QUIZ_MODE.ACTIVE);
  const [bonusQuizState, setBonusQuizState] = useState(BONUS_QUIZ_STATE.IDLE);

  const stepTwoRef = useRef(null);
  const onDemandSectionRef = useRef(null);

  // --- Event Handlers & Effects ---
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
          {subjects.data.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
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
      (state.easyQuizState === API_STATE.LOADED ||
        state.mediumQuizState === API_STATE.LOADED ||
        state.difficultQuizState === API_STATE.LOADED ||
        state.flashcardState === API_STATE.LOADED ||
        state.easyQuizState === API_STATE.LOADED_EMPTY ||
        state.mediumQuizState === API_STATE.LOADED_EMPTY ||
        state.difficultQuizState === API_STATE.LOADED_EMPTY ||
        state.flashcardState === API_STATE.LOADED_EMPTY) &&
      onDemandSectionRef.current
    ) {
      onDemandSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [
    state.easyQuizState,
    state.mediumQuizState,
    state.difficultQuizState,
    state.flashcardState,
  ]);

  // --- Data Fetching Logic ---
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
  const onDemandFetchDelay = 0;

  // --- handleSubmit ---
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
      easyQuizState: API_STATE.IDLE,
      mediumQuizState: API_STATE.IDLE,
      difficultQuizState: API_STATE.IDLE,
      flashcardState: API_STATE.IDLE,
      bonusQuizState: BONUS_QUIZ_STATE.IDLE,
      selectedText: "",
      summarySelected: true,
      subjectsSelected: false,
    }));
    setSelectedAnswers({});
    setQuizMode(QUIZ_MODE.ACTIVE);
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

  // --- Quiz Generation Functions ---
  const handleGenerateEasyQuiz = async () => {
    if (
      !state.apiData.transcript ||
      state.easyQuizState === API_STATE.LOADING
    ) {
      console.log(
        "Easy quiz generation blocked: No transcript or already loading."
      );
      return;
    }
    console.log("Requesting Easy Quiz Generation...");
    await wait(onDemandFetchDelay);
    setState((p) => ({
      ...p,
      easyQuizState: API_STATE.LOADING,
      errorMessage: null,
      quizMode: QUIZ_MODE.ACTIVE,
      bonusQuizState: BONUS_QUIZ_STATE.IDLE,
    }));
    setSelectedAnswers({});
    try {
      console.log(
        `Sending transcript (len: ${state.apiData.transcript.length}) for easy quiz.`
      );
      const res = await fetchData("quiz", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
        difficulty: "easy",
        num_questions: 5,
      });
      console.log("Raw easy quiz response:", JSON.stringify(res, null, 2));
      const items = (res?.data || [])
        .map((q, index) => {
          if (
            q &&
            typeof q === "object" &&
            q.question &&
            Array.isArray(q.answers) &&
            q.hasOwnProperty("correct_answer")
          ) {
            return {
              ...q,
              difficulty: q.difficulty || "easy", // Fallback if missing
            };
          } else {
            console.warn(
              `Skipping invalid quiz structure at index ${index}:`,
              q
            );
            return null;
          }
        })
        .filter(Boolean);
      const newState =
        items.length > 0 ? API_STATE.LOADED : API_STATE.LOADED_EMPTY;
      console.log(`Processed ${items.length} valid easy quiz questions.`);
      if (newState === API_STATE.LOADED_EMPTY)
        console.warn("Easy quiz gen OK but returned zero valid questions.");
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, quizzes: { data: items } },
        easyQuizState: newState,
      }));
    } catch (error) {
      console.error("Error generating easy quiz:", error);
      let msg = `Failed to generate easy quiz: ${error.message}`;
      if (error.status === 429)
        msg = "API Rate Limit Exceeded generating easy quiz.";
      else if (error.status === 400) msg = `Invalid request: ${error.message}`;
      setState((p) => ({
        ...p,
        easyQuizState: API_STATE.ERROR,
        errorMessage: msg,
      }));
    }
  };

  const handleGenerateMediumQuiz = async () => {
    if (
      !state.apiData.transcript ||
      state.mediumQuizState === API_STATE.LOADING
    ) {
      console.log(
        "Medium quiz generation blocked: No transcript or already loading."
      );
      return;
    }
    console.log("Requesting Medium Quiz Generation...");
    await wait(onDemandFetchDelay);
    setState((p) => ({
      ...p,
      mediumQuizState: API_STATE.LOADING,
      errorMessage: null,
      quizMode: QUIZ_MODE.ACTIVE,
      bonusQuizState: BONUS_QUIZ_STATE.IDLE,
    }));
    setSelectedAnswers({});
    try {
      console.log(
        `Sending transcript (len: ${state.apiData.transcript.length}) for medium quiz.`
      );
      const res = await fetchData("quiz", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
        difficulty: "medium",
        num_questions: 5,
      });
      console.log("Raw medium quiz response:", JSON.stringify(res, null, 2));
      const items = (res?.data || [])
        .map((q, index) => {
          if (
            q &&
            typeof q === "object" &&
            q.question &&
            Array.isArray(q.answers) &&
            q.hasOwnProperty("correct_answer")
          ) {
            return {
              ...q,
              difficulty: q.difficulty || "medium", // Fallback if missing
            };
          } else {
            console.warn(
              `Skipping invalid quiz structure at index ${index}:`,
              q
            );
            return null;
          }
        })
        .filter(Boolean);
      const newState =
        items.length > 0 ? API_STATE.LOADED : API_STATE.LOADED_EMPTY;
      console.log(`Processed ${items.length} valid medium quiz questions.`);
      if (newState === API_STATE.LOADED_EMPTY)
        console.warn("Medium quiz gen OK but returned zero valid questions.");
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, quizzes: { data: items } },
        mediumQuizState: newState,
      }));
    } catch (error) {
      console.error("Error generating medium quiz:", error);
      let msg = `Failed to generate medium quiz: ${error.message}`;
      if (error.status === 429)
        msg = "API Rate Limit Exceeded generating medium quiz.";
      else if (error.status === 400) msg = `Invalid request: ${error.message}`;
      setState((p) => ({
        ...p,
        mediumQuizState: API_STATE.ERROR,
        errorMessage: msg,
      }));
    }
  };

  const handleGenerateDifficultQuiz = async () => {
    if (
      !state.apiData.transcript ||
      state.difficultQuizState === API_STATE.LOADING
    ) {
      console.log(
        "Difficult quiz generation blocked: No transcript or already loading."
      );
      return;
    }
    console.log("Requesting Difficult Quiz Generation...");
    await wait(onDemandFetchDelay);
    setState((p) => ({
      ...p,
      difficultQuizState: API_STATE.LOADING,
      errorMessage: null,
      quizMode: QUIZ_MODE.ACTIVE,
      bonusQuizState: BONUS_QUIZ_STATE.IDLE,
    }));
    setSelectedAnswers({});
    try {
      console.log(
        `Sending transcript (len: ${state.apiData.transcript.length}) for difficult quiz.`
      );
      const res = await fetchData("quiz", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
        difficulty: "difficult",
        num_questions: 5,
      });
      console.log("Raw difficult quiz response:", JSON.stringify(res, null, 2));
      const items = (res?.data || [])
        .map((q, index) => {
          if (
            q &&
            typeof q === "object" &&
            q.question &&
            Array.isArray(q.answers) &&
            q.hasOwnProperty("correct_answer")
          ) {
            return {
              ...q,
              difficulty: q.difficulty || "difficult", // Fallback if missing
            };
          } else {
            console.warn(
              `Skipping invalid quiz structure at index ${index}:`,
              q
            );
            return null;
          }
        })
        .filter(Boolean);
      const newState =
        items.length > 0 ? API_STATE.LOADED : API_STATE.LOADED_EMPTY;
      console.log(`Processed ${items.length} valid difficult quiz questions.`);
      if (newState === API_STATE.LOADED_EMPTY)
        console.warn(
          "Difficult quiz gen OK but returned zero valid questions."
        );
      setState((p) => ({
        ...p,
        apiData: { ...p.apiData, quizzes: { data: items } },
        difficultQuizState: newState,
      }));
    } catch (error) {
      console.error("Error generating difficult quiz:", error);
      let msg = `Failed to generate difficult quiz: ${error.message}`;
      if (error.status === 429)
        msg = "API Rate Limit Exceeded generating difficult quiz.";
      else if (error.status === 400) msg = `Invalid request: ${error.message}`;
      setState((p) => ({
        ...p,
        difficultQuizState: API_STATE.ERROR,
        errorMessage: msg,
      }));
    }
  };

  // --- fetchBonusQuestions ---
  const fetchBonusQuestions = async () => {
    if (
      !state.apiData.transcript ||
      bonusQuizState === BONUS_QUIZ_STATE.LOADING ||
      bonusQuizState === BONUS_QUIZ_STATE.LOADED
    ) {
      console.log(
        "Bonus question fetch blocked: No transcript or already loading/loaded."
      );
      return;
    }
    console.log("Fetching Bonus Difficult Questions...");
    setState((prevState) => ({
      ...prevState,
      bonusQuizState: BONUS_QUIZ_STATE.LOADING,
      errorMessage: null,
    }));
    try {
      console.log(
        `Sending transcript (len: ${state.apiData.transcript.length}) for bonus difficult quiz.`
      );
      const bonusResponse = await fetchData("quiz", {
        transcript: state.apiData.transcript,
        user_id: state.user_id,
        difficulty: "difficult",
        num_questions: NUM_BONUS_QUESTIONS,
      });
      console.log(
        "Raw bonus quiz response:",
        JSON.stringify(bonusResponse, null, 2)
      );
      const bonusItems = (bonusResponse?.data || [])
        .map((q, index) => {
          if (
            q &&
            typeof q === "object" &&
            q.question &&
            Array.isArray(q.answers) &&
            q.hasOwnProperty("correct_answer")
          ) {
            return {
              ...q,
              difficulty: q.difficulty || "difficult", // Fallback if missing
            };
          } else {
            console.warn(
              `Skipping invalid bonus quiz structure at index ${index}:`,
              q
            );
            return null;
          }
        })
        .filter(Boolean);
      if (bonusItems.length > 0) {
        console.log(`Appending ${bonusItems.length} bonus questions.`);
        setState((prevState) => ({
          ...prevState,
          apiData: {
            ...prevState.apiData,
            quizzes: {
              data: [...(prevState.apiData.quizzes?.data || []), ...bonusItems],
            },
          },
          bonusQuizState: BONUS_QUIZ_STATE.LOADED,
        }));
      } else {
        console.warn("Bonus quiz fetch OK but returned zero valid questions.");
        setState((prevState) => ({
          ...prevState,
          bonusQuizState: BONUS_QUIZ_STATE.LOADED_EMPTY,
        }));
      }
    } catch (error) {
      console.error("Error fetching bonus quiz questions:", error);
      let userErrorMessage = `Failed to fetch bonus questions: ${error.message}`;
      if (error.status === 429) {
        userErrorMessage = "API Rate Limit Exceeded fetching bonus questions.";
      } else if (error.status === 400) {
        userErrorMessage = `Invalid request: ${error.message}`;
      }
      setState((prevState) => ({
        ...prevState,
        bonusQuizState: BONUS_QUIZ_STATE.ERROR,
        errorMessage: userErrorMessage,
      }));
    }
  };

  // --- handleGenerateFlashcards ---
  const handleGenerateFlashcards = async () => {
    if (
      !state.apiData.transcript ||
      state.flashcardState === API_STATE.LOADING
    ) {
      console.log(
        "Flashcard generation blocked: No transcript or already loading."
      );
      return;
    }
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
                <div className="flashcard-title">
                  <h6 style={{ margin: 0 }}>{q || "N/A"}</h6>
                </div>
              </div>
              <div
                style={{
                  flex: 0.8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={res.images[i] || loadinggif}
                  alt="Flashcard visual"
                  className="img-thumbnail flashcard-img"
                  style={{
                    maxHeight: "150px",
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          ),
          backHTML: (
            <div className="backstyle">
              <div className="backstyle-text">
                <h4>{res.answers[i] || "N/A"}</h4>
              </div>
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

  // --- Quiz Component ---
  const QuizzesContent = ({
    quizzesData,
    selectedAnswers,
    setSelectedAnswers,
    quizMode,
    currentTranscript,
    bonusQuizState,
  }) => {
    if (!quizzesData || quizzesData.length === 0) {
      return (
        <div>
          No quiz questions available to display.{" "}
          {state.mediumQuizState === API_STATE.LOADED_EMPTY ||
          state.difficultQuizState === API_STATE.LOADED_EMPTY
            ? "The quiz generation completed, but no valid questions were returned."
            : state.mediumQuizState === API_STATE.ERROR ||
              state.difficultQuizState === API_STATE.ERROR
            ? `Error: ${state.errorMessage}`
            : "Please try generating the quiz again."}
        </div>
      );
    }
    let correctAnswersCount = 0;
    quizzesData.forEach((quiz, index) => {
      if (quiz && selectedAnswers.hasOwnProperty(index)) {
        const correctAnswerText = quiz.answers?.[quiz.correct_answer];
        if (
          correctAnswerText !== undefined &&
          selectedAnswers[index] === correctAnswerText
        ) {
          correctAnswersCount += 1;
        }
      }
    });
    const score =
      quizzesData.length > 0 ? correctAnswersCount / quizzesData.length : 0;
    const totalQuestions = quizzesData.length;

    const handleAnswerChange = (quizIndex, answerValue) => {
      if (quizMode === QUIZ_MODE.ACTIVE) {
        const updatedSelectedAnswers = {
          ...selectedAnswers,
          [quizIndex]: answerValue,
        };
        setSelectedAnswers(updatedSelectedAnswers);
        const numAnswered = Object.keys(updatedSelectedAnswers).length;
        console.log(`Answered ${numAnswered}/${totalQuestions}`);
        if (
          numAnswered === totalQuestions &&
          bonusQuizState === BONUS_QUIZ_STATE.IDLE
        ) {
          console.log("Last question answered. Checking score for bonus...");
          let finalCorrectCount = 0;
          quizzesData.forEach((q, idx) => {
            if (updatedSelectedAnswers.hasOwnProperty(idx)) {
              const correctText = q.answers?.[q.correct_answer];
              if (
                correctText !== undefined &&
                updatedSelectedAnswers[idx] === correctText
              ) {
                finalCorrectCount++;
              }
            }
          });
          const finalScore =
            totalQuestions > 0 ? finalCorrectCount / totalQuestions : 0;
          console.log(
            `Final Score: ${finalScore.toFixed(
              2
            )} (Threshold: ${SCORE_THRESHOLD})`
          );
          if (finalScore >= SCORE_THRESHOLD) {
            console.log("Threshold met! Triggering bonus fetch.");
            fetchBonusQuestions();
          } else {
            console.log("Threshold not met.");
            setState((prevState) => ({
              ...prevState,
              bonusQuizState: BONUS_QUIZ_STATE.NOT_QUALIFIED,
            }));
          }
        }
      }
    };

    return (
      <form
        onSubmit={(e) => e.preventDefault()}
        className={`quiz-container quiz-mode-${quizMode}`}
      >
        {quizzesData.map((quiz, index) => {
          if (
            !quiz ||
            !quiz.question ||
            !Array.isArray(quiz.answers) ||
            typeof quiz.correct_answer !== "number"
          ) {
            console.warn(`Invalid quiz data at index ${index}:`, quiz);
            return null;
          }
          const correctAnswerText = quiz.answers[quiz.correct_answer];
          const userSelectedAnswerText = selectedAnswers[index];
          const isQuestionAnswered = selectedAnswers.hasOwnProperty(index);
          return (
            <div key={index} className="quiz-block">
              <h4 className="question-heading">
                Q{index + 1}: {quiz.question}
                <span style={{ fontSize: "0.8em", color: "#555" }}>
                  {" "}
                  ({quiz.difficulty || "unknown"})
                </span>
              </h4>
              {quiz.answers.map((answer, answerIndex) => {
                const isChecked = userSelectedAnswerText === answer;
                const isThisOptionCorrect = answer === correctAnswerText;
                let labelClassName = "";
                let flag = null;
                const isDisabled = quizMode === QUIZ_MODE.REVIEW;
                if (quizMode === QUIZ_MODE.REVIEW) {
                  if (isThisOptionCorrect) {
                    labelClassName = "correct-answer-review";
                    flag = <span className="answer-flag"> ✅</span>;
                  }
                  if (isChecked && !isThisOptionCorrect) {
                    labelClassName +=
                      (labelClassName ? " " : "") + "incorrect-answer";
                    flag = <span className="answer-flag"> ❌</span>;
                  }
                  if (isChecked && isThisOptionCorrect) {
                    labelClassName = "correct-answer-review correct-answer";
                  }
                } else {
                  if (isQuestionAnswered) {
                    if (isChecked) {
                      if (userSelectedAnswerText === correctAnswerText) {
                        labelClassName = "correct-answer";
                        flag = <span className="answer-flag"> ✅</span>;
                      } else {
                        labelClassName = "incorrect-answer";
                        flag = <span className="answer-flag"> ❌</span>;
                      }
                    } else {
                      if (
                        userSelectedAnswerText !== correctAnswerText &&
                        isThisOptionCorrect
                      ) {
                        labelClassName = "correct-answer-unselected";
                      }
                    }
                  }
                }
                return (
                  <div
                    key={answerIndex}
                    className={`quiz-option ${labelClassName}`}
                  >
                    <input
                      type="radio"
                      id={`question-${index}-option-${answerIndex}`}
                      name={`question-${index}`}
                      value={answer}
                      onChange={(e) =>
                        handleAnswerChange(index, e.target.value)
                      }
                      checked={isChecked}
                      disabled={isDisabled}
                    />
                    <label htmlFor={`question-${index}-option-${answerIndex}`}>
                      {answer}
                      {flag}
                    </label>
                  </div>
                );
              })}
              {quizMode === QUIZ_MODE.REVIEW && (
                <div
                  className="explanation-snippet"
                  style={{ marginTop: "5px", fontSize: "0.9em", color: "#555" }}
                >
                  {/* Placeholder for future explanations */}
                </div>
              )}
            </div>
          );
        })}
        <div className="correct-answers-count">
          {Object.keys(selectedAnswers).length > 0 &&
            `Score: ${correctAnswersCount} / ${totalQuestions} (${(
              score * 100
            ).toFixed(0)}%)`}
        </div>
      </form>
    );
  };

  // --- Render Logic ---
  return (
    <>
      <SEO title="EduAction Generator" />
      <Layout>
        <div className="containersteps">
          <h2 className="stepsname">Step 1: Paste your YouTube link</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="wrapper2">
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
                />
              </div>
              <div className="wrapper2">
                <button
                  type="submit"
                  className="buttons1"
                  disabled={state.isInitialLoading}
                >
                  {state.isInitialLoading
                    ? "Processing..."
                    : "Generate Summary & Subjects"}
                </button>
              </div>
              {!state.isInitialLoading && (
                <div className="text2">
                  <ul>
                    <li>Public YouTube video link required.</li>
                    <li>Include https://</li>
                    <li>Ensure captions/subtitles available.</li>
                  </ul>
                </div>
              )}
            </div>
          </form>
          {state.errorMessage &&
            !state.isInitialLoading &&
            state.easyQuizState !== API_STATE.LOADING &&
            state.mediumQuizState !== API_STATE.LOADING &&
            state.difficultQuizState !== API_STATE.LOADING &&
            state.flashcardState !== API_STATE.LOADING && (
              <div className="error-message-general">{state.errorMessage}</div>
            )}
        </div>

        {state.isInitialLoading && (
          <div className="containersteps2 containerstepscooking">
            <div className="text-content">
              <h2 className="stepsname">Brewing Initial Insights...</h2>
              <div className="text2">
                <h6 className="text2">AI is doing:</h6>
                <ul>
                  <li>Fetching transcript...</li>
                  <li>Generating summary...</li>
                  <li>Finding key subjects...</li>
                </ul>
              </div>
              <img src={loadinggif} alt="Loading..." className="loading" />
            </div>
            <img src={robotarm} alt="AI Processing" className="robot-arm" />
          </div>
        )}

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
                <img
                  src={
                    state.summarySelected ? summarywhiteicon : summaryblueicon
                  }
                  alt=""
                  className="button-icon"
                />
                Summary
              </button>
              <button
                type="button"
                className={`buttons1 ${
                  state.subjectsSelected ? "" : "unselected"
                }`}
                onClick={handleSubjectsClick}
                disabled={!state.apiData.subjects?.data}
              >
                <img
                  src={state.subjectsSelected ? whiteIcon : originalIcon}
                  alt=""
                  className="button-icon"
                />
                Subjects
              </button>
            </div>
            {state.selectedText && (
              <div className="text-box">{state.selectedText}</div>
            )}

            <h3 className="stepsname" style={{ marginTop: "30px" }}>
              Step 3: Generate Quiz & Flashcards
            </h3>
            {(state.easyQuizState === API_STATE.ERROR ||
              state.mediumQuizState === API_STATE.ERROR ||
              state.difficultQuizState === API_STATE.ERROR ||
              state.flashcardState === API_STATE.ERROR) &&
              state.errorMessage && (
                <div
                  className="error-message-general"
                  style={{ marginTop: "10px" }}
                >
                  {state.errorMessage}
                </div>
              )}

            <div
              className="button-row quiz-button-row"
              style={{ marginTop: "15px" }}
            >
              <h4
                style={{
                  width: "100%",
                  textAlign: "center",
                  marginBottom: "10px",
                }}
              >
                Generate Quiz:
              </h4>
              <button
                type="button"
                className="buttons1 button-generate button-difficulty button-easy"
                onClick={handleGenerateEasyQuiz}
                disabled={
                  state.easyQuizState === API_STATE.LOADING ||
                  !state.apiData.transcript
                }
              >
                <img
                  src={
                    state.easyQuizState === API_STATE.LOADING
                      ? loadinggif
                      : quizwhiteicon
                  }
                  alt=""
                  className="button-icon"
                />
                {state.easyQuizState === API_STATE.LOADING
                  ? "Loading..."
                  : "Easy"}
              </button>
              <button
                type="button"
                className="buttons1 button-generate button-difficulty button-medium"
                onClick={handleGenerateMediumQuiz}
                disabled={
                  state.mediumQuizState === API_STATE.LOADING ||
                  !state.apiData.transcript
                }
              >
                <img
                  src={
                    state.mediumQuizState === API_STATE.LOADING
                      ? loadinggif
                      : quizwhiteicon
                  }
                  alt=""
                  className="button-icon"
                />
                {state.mediumQuizState === API_STATE.LOADING
                  ? "Loading..."
                  : "Medium"}
              </button>
              <button
                type="button"
                className="buttons1 button-generate button-difficulty button-difficult"
                onClick={handleGenerateDifficultQuiz}
                disabled={
                  state.difficultQuizState === API_STATE.LOADING ||
                  !state.apiData.transcript
                }
              >
                <img
                  src={
                    state.difficultQuizState === API_STATE.LOADING
                      ? loadinggif
                      : quizwhiteicon
                  }
                  alt=""
                  className="button-icon"
                />
                {state.difficultQuizState === API_STATE.LOADING
                  ? "Loading..."
                  : "Difficult"}
              </button>
            </div>

            <div
              className="button-row flashcards-button-row"
              style={{ marginTop: "25px" }}
            >
              <h4
                style={{
                  width: "100%",
                  textAlign: "center",
                  marginBottom: "10px",
                }}
              >
                Generate Flashcards:
              </h4>
              <button
                type="button"
                className="buttons1 button-generate button-flashcards"
                onClick={handleGenerateFlashcards}
                disabled={
                  state.flashcardState === API_STATE.LOADING ||
                  state.flashcardState === API_STATE.LOADED ||
                  state.flashcardState === API_STATE.LOADED_EMPTY ||
                  !state.apiData.transcript
                }
              >
                <img
                  src={
                    state.flashcardState === API_STATE.LOADING
                      ? loadinggif
                      : flashcardwhiteicon
                  }
                  alt=""
                  className="button-icon"
                />
                {state.flashcardState === API_STATE.LOADING
                  ? "Generating..."
                  : state.flashcardState === API_STATE.LOADED ||
                    state.flashcardState === API_STATE.LOADED_EMPTY
                  ? "Flashcards Ready"
                  : "Generate Flashcards"}
              </button>
            </div>
          </div>
        )}

        <div ref={onDemandSectionRef}>
          {(state.easyQuizState === API_STATE.LOADED ||
            state.mediumQuizState === API_STATE.LOADED ||
            state.difficultQuizState === API_STATE.LOADED ||
            state.easyQuizState === API_STATE.LOADED_EMPTY ||
            state.mediumQuizState === API_STATE.LOADED_EMPTY ||
            state.difficultQuizState === API_STATE.LOADED_EMPTY ||
            state.flashcardState === API_STATE.LOADED ||
            state.flashcardState === API_STATE.LOADED_EMPTY) &&
            state.initialDataLoaded && (
              <div className="containersteps3">
                <h2 className="stepsname" style={{ marginBottom: "20px" }}>
                  Generated Quiz
                </h2>
                {(state.easyQuizState === API_STATE.LOADED ||
                  state.mediumQuizState === API_STATE.LOADED ||
                  state.difficultQuizState === API_STATE.LOADED ||
                  state.easyQuizState === API_STATE.LOADED_EMPTY ||
                  state.mediumQuizState === API_STATE.LOADED_EMPTY ||
                  state.difficultQuizState === API_STATE.LOADED_EMPTY) &&
                  state.apiData.quizzes?.data?.length > 0 && (
                    <div
                      className="button-row"
                      style={{ marginBottom: "20px" }}
                    >
                      <button
                        type="button"
                        className={`buttons1 review-button ${
                          quizMode === QUIZ_MODE.REVIEW ? "active" : ""
                        }`}
                        onClick={() => setQuizMode(QUIZ_MODE.REVIEW)}
                        disabled={quizMode === QUIZ_MODE.REVIEW}
                      >
                        Review Answers
                      </button>
                      <button
                        type="button"
                        className={`buttons1 review-button ${
                          quizMode === QUIZ_MODE.ACTIVE ? "active" : ""
                        }`}
                        onClick={() => setQuizMode(QUIZ_MODE.ACTIVE)}
                        disabled={quizMode === QUIZ_MODE.ACTIVE}
                      >
                        Answer Quiz
                      </button>
                    </div>
                  )}
                <div className="text-box">
                  {state.easyQuizState === API_STATE.LOADED ||
                  state.mediumQuizState === API_STATE.LOADED ||
                  state.difficultQuizState === API_STATE.LOADED ? (
                    <QuizzesContent
                      quizzesData={state.apiData.quizzes?.data || []}
                      selectedAnswers={selectedAnswers}
                      setSelectedAnswers={setSelectedAnswers}
                      quizMode={quizMode}
                      currentTranscript={state.apiData.transcript}
                      bonusQuizState={bonusQuizState}
                    />
                  ) : state.easyQuizState === API_STATE.LOADED_EMPTY ||
                    state.mediumQuizState === API_STATE.LOADED_EMPTY ||
                    state.difficultQuizState === API_STATE.LOADED_EMPTY ? (
                    <div>
                      Quiz generation complete, but no questions were found.
                      Please try again or check the transcript content.
                    </div>
                  ) : (state.easyQuizState === API_STATE.ERROR ||
                      state.mediumQuizState === API_STATE.ERROR ||
                      state.difficultQuizState === API_STATE.ERROR) &&
                    state.errorMessage ? (
                    <div className="error-message">{state.errorMessage}</div>
                  ) : null}
                </div>
                {bonusQuizState === BONUS_QUIZ_STATE.LOADING && (
                  <div style={{ textAlign: "center", marginTop: "15px" }}>
                    <img
                      src={loadinggif}
                      alt=""
                      className="loading-inline"
                      style={{ width: "25px", marginRight: "5px" }}
                    />
                    Loading difficult bonus questions...
                  </div>
                )}
                {bonusQuizState === BONUS_QUIZ_STATE.LOADED && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: "15px",
                      color: "green",
                      fontWeight: "bold",
                    }}
                  >
                    Bonus questions added! Keep answering or review.
                  </div>
                )}
                {bonusQuizState === BONUS_QUIZ_STATE.NOT_QUALIFIED && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: "15px",
                      color: "#777",
                    }}
                  >
                    Score below 80%. Keep practicing!
                  </div>
                )}
                {bonusQuizState === BONUS_QUIZ_STATE.ERROR &&
                  state.errorMessage && (
                    <div
                      className="error-message-general"
                      style={{ marginTop: "15px" }}
                    >
                      {state.errorMessage}
                    </div>
                  )}
              </div>
            )}

          {(state.flashcardState === API_STATE.LOADED ||
            state.flashcardState === API_STATE.LOADED_EMPTY ||
            state.flashcardState === API_STATE.ERROR) &&
            state.initialDataLoaded && (
              <div
                className="containersteps3"
                style={{
                  marginTop:
                    state.easyQuizState !== API_STATE.IDLE ||
                    state.mediumQuizState !== API_STATE.IDLE ||
                    state.difficultQuizState !== API_STATE.IDLE
                      ? "30px"
                      : "0",
                }}
              >
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
                      }}
                    />
                  ) : state.flashcardState === API_STATE.LOADED_EMPTY ? (
                    <div>No flashcards generated.</div>
                  ) : (
                    <div className="error-message">{state.errorMessage}</div>
                  )}
                </div>
              </div>
            )}
        </div>
      </Layout>
    </>
  );
};

export default EventList;
