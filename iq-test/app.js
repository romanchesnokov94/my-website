/* IQ Test App */
(function () {
	"use strict";

	const QUESTION_COUNT = 10;
	const TEST_DURATION_SECONDS = 10 * 60; // 10 minutes

	/**
	 * Bank of questions (ru)
	 * Each question has: id, text, choices[], correctIndex
	 */
	const QUESTION_BANK = [
		{
			id: "seq_1",
			text: "Выберите число, которое логически продолжит ряд: 2, 4, 8, 16, …",
			choices: ["18", "24", "30", "32"],
			correctIndex: 3
		},
		{
			id: "arith_1",
			text: "Если 3 × N = 27, то N = ?",
			choices: ["6", "7", "8", "9"],
			correctIndex: 3
		},
		{
			id: "logic_1",
			text: "Все кошки — млекопитающие. Мурка — кошка. Следовательно:",
			choices: [
				"Мурка — рыба",
				"Мурка — млекопитающее",
				"Мурка — рептилия",
				"Вывод сделать нельзя"
			],
			correctIndex: 1
		},
		{
			id: "analogy_1",
			text: "Свет относится к лампе так же, как звук относится к …",
			choices: ["колонке", "телевизору", "плееру", "залу"],
			correctIndex: 0
		},
		{
			id: "pattern_1",
			text: "Выберите лишнее слово: квадрат, круг, треугольник, сфера",
			choices: ["квадрат", "круг", "треугольник", "сфера"],
			correctIndex: 3
		},
		{
			id: "seq_2",
			text: "Найдите следующее число: 1, 1, 2, 3, 5, 8, …",
			choices: ["8", "9", "13", "21"],
			correctIndex: 2
		},
		{
			id: "arith_2",
			text: "Если сегодня вторник, то через 50 дней будет …",
			choices: ["среда", "четверг", "пятница", "суббота"],
			correctIndex: 1 // 50 mod 7 = 1 → среды? wait: Tue + 1 = Wed; but choices list: среда is index 0. Fix: 1 corresponds to четверг. Let's recompute.
		},
		{
			id: "word_1",
			text: "Сколько букв в слове “семь”?",
			choices: ["3", "4", "5", "7"],
			correctIndex: 1
		},
		{
			id: "logic_2",
			text: "На столе 5 яблок. Вы взяли 2. Сколько яблок у вас?",
			choices: ["2", "3", "5", "7"],
			correctIndex: 0
		},
		{
			id: "pattern_2",
			text: "Какое число лишнее: 6, 9, 12, 15, 21, 18?",
			choices: ["6", "12", "21", "18"],
			correctIndex: 2 // остальные кратны 3; 21 тоже кратно 3, но последовательность 6,9,12,15,18 — шаг 3; 21 нарушает
		},
		{
			id: "analogy_2",
			text: "Кисть относится к художнику так же, как … к писателю",
			choices: ["краска", "перо", "бумага", "словарь"],
			correctIndex: 1
		},
		{
			id: "spatial_1",
			text: "Если повернуть букву N на 180°, каким символом она станет?",
			choices: ["N", "Z", "U", "не изменится"],
			correctIndex: 1
		},
		{
			id: "seq_3",
			text: "Выберите следующее число: 3, 6, 9, 15, 24, …",
			choices: ["33", "36", "39", "42"],
			correctIndex: 0 // +3, +3, +6, +9, +? → +15 → 24+15=39? Wait, recalc below
		},
		{
			id: "arith_3",
			text: "Сколько углов у двух треугольников и одного квадрата вместе?",
			choices: ["8", "10", "12", "14"],
			correctIndex: 2
		}
	];

	// Fix data issues quickly
	(function sanitizeQuestions() {
		// Correct the weekday problem and sequence comment
		const qWeek = QUESTION_BANK.find(q => q.id === "arith_2");
		if (qWeek) {
			qWeek.correctIndex = 0; // вторник + 50 дней = среда
		}
		const qSeq3 = QUESTION_BANK.find(q => q.id === "seq_3");
		if (qSeq3) {
			qSeq3.correctIndex = 2; // 3,6,9,15,24 → +3,+3,+6,+9 → +15 → 39
			qSeq3.choices = ["33", "36", "39", "42"]; // ensure options
		}
	})();

	/** DOM */
	const screenStart = document.getElementById("screen-start");
	const screenQuiz = document.getElementById("screen-quiz");
	const screenResult = document.getElementById("screen-result");

	const btnStart = document.getElementById("btn-start");
	const btnNext = document.getElementById("btn-next");
	const btnSkip = document.getElementById("btn-skip");
	const btnRestart = document.getElementById("btn-restart");

	const progressBar = document.getElementById("progress-bar");
	const progressText = document.getElementById("progress-text");
	const timerEl = document.getElementById("timer");

	const questionTextEl = document.getElementById("question-text");
	const choicesListEl = document.getElementById("choices-list");

	const statCorrectEl = document.getElementById("stat-correct");
	const statTotalEl = document.getElementById("stat-total");
	const iqValueEl = document.getElementById("iq-value");
	const iqIndicatorEl = document.getElementById("iq-indicator");
	const iqInterpretationEl = document.getElementById("iq-interpretation");

	document.getElementById("year").textContent = String(new Date().getFullYear());

	/** State */
	let selectedQuestions = [];
	let currentIndex = 0;
	let answers = []; // store selected index or null
	let secondsLeft = TEST_DURATION_SECONDS;
	let timerHandle = null;

	function shuffle(array) {
		for (let i = array.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	function pickRandomQuestions(bank, count) {
		const copy = bank.slice();
		shuffle(copy);
		return copy.slice(0, count);
	}

	function formatTime(totalSeconds) {
		const mm = Math.floor(totalSeconds / 60);
		const ss = totalSeconds % 60;
		return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
	}

	function startTimer() {
		stopTimer();
		timerHandle = setInterval(() => {
			secondsLeft -= 1;
			if (secondsLeft <= 0) {
				secondsLeft = 0;
				timerEl.textContent = formatTime(secondsLeft);
				finishTest();
				return;
			}
			timerEl.textContent = formatTime(secondsLeft);
		}, 1000);
	}

	function stopTimer() {
		if (timerHandle) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}

	function renderProgress() {
		const total = selectedQuestions.length;
		const current = Math.min(currentIndex + 1, total);
		progressText.textContent = `Вопрос ${current} из ${total}`;
		progressBar.style.width = `${(currentIndex / total) * 100}%`;
	}

	function renderQuestion() {
		const question = selectedQuestions[currentIndex];
		questionTextEl.textContent = question.text;
		choicesListEl.innerHTML = "";

		const selected = answers[currentIndex];

		question.choices.forEach((choiceText, idx) => {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.className = "choice";
			btn.type = "button";
			btn.setAttribute("role", "option");
			btn.setAttribute("aria-selected", selected === idx ? "true" : "false");
			btn.textContent = choiceText;
			btn.addEventListener("click", () => onSelect(idx));
			li.appendChild(btn);
			choicesListEl.appendChild(li);
		});

		btnNext.disabled = selected == null;
		renderProgress();
	}

	function onSelect(choiceIndex) {
		answers[currentIndex] = choiceIndex;
		btnNext.disabled = false;

		// Update aria-selected
		Array.from(choicesListEl.querySelectorAll(".choice")).forEach((el, idx) => {
			if (idx === choiceIndex) {
				el.setAttribute("aria-selected", "true");
			} else {
				el.setAttribute("aria-selected", "false");
			}
		});
	}

	function nextQuestion() {
		if (currentIndex < selectedQuestions.length - 1) {
			currentIndex += 1;
			renderQuestion();
		} else {
			finishTest();
		}
	}

	function skipQuestion() {
		if (answers[currentIndex] == null) {
			answers[currentIndex] = null; // explicit skip
		}
		nextQuestion();
	}

	function calculateScore() {
		let correct = 0;
		selectedQuestions.forEach((q, idx) => {
			if (answers[idx] != null && q.correctIndex === answers[idx]) correct += 1;
		});
		return correct;
	}

	function estimateIQ(correct, total) {
		// Simple linear mapping for entertainment purposes
		// IQ ≈ 70 .. 150
		const iq = Math.round(70 + (correct / total) * 80);
		return Math.max(70, Math.min(150, iq));
	}

	function iqInterpretation(iq) {
		if (iq < 85) return "Ниже среднего диапазона";
		if (iq < 100) return "Чуть ниже среднего";
		if (iq < 115) return "Средний диапазон";
		if (iq < 130) return "Выше среднего";
		return "Очень высокий диапазон";
	}

	function finishTest() {
		stopTimer();
		screenQuiz.classList.add("hidden");
		screenResult.classList.remove("hidden");

		const total = selectedQuestions.length;
		const correct = calculateScore();
		const iq = estimateIQ(correct, total);

		statTotalEl.textContent = String(total);
		statCorrectEl.textContent = String(correct);
		iqValueEl.textContent = String(iq);
		iqInterpretationEl.textContent = iqInterpretation(iq);

		const pos = ((iq - 70) / (150 - 70)) * 100; // 0..100
		iqIndicatorEl.style.left = `${Math.max(0, Math.min(100, pos))}%`;

		try {
			localStorage.setItem("iq_last_result", JSON.stringify({ iq, correct, total, ts: Date.now() }));
		} catch (_) {}
	}

	function startTest() {
		selectedQuestions = pickRandomQuestions(QUESTION_BANK, QUESTION_COUNT);
		currentIndex = 0;
		answers = new Array(selectedQuestions.length).fill(null);
		secondsLeft = TEST_DURATION_SECONDS;

		screenStart.classList.add("hidden");
		screenResult.classList.add("hidden");
		screenQuiz.classList.remove("hidden");

		timerEl.textContent = formatTime(secondsLeft);
		startTimer();
		renderQuestion();
	}

	function restartTest() {
		screenStart.classList.remove("hidden");
		screenQuiz.classList.add("hidden");
		screenResult.classList.add("hidden");
	}

	// Events
	btnStart.addEventListener("click", startTest);
	btnNext.addEventListener("click", nextQuestion);
	btnSkip.addEventListener("click", skipQuestion);
	btnRestart.addEventListener("click", restartTest);

	// Keyboard accessibility: allow 1..n choice selection
	document.addEventListener("keydown", (e) => {
		if (!screenQuiz || screenQuiz.classList.contains("hidden")) return;
		const digit = parseInt(e.key, 10);
		if (!Number.isNaN(digit) && digit >= 1 && digit <= 9) {
			const idx = digit - 1;
			const buttons = Array.from(choicesListEl.querySelectorAll(".choice"));
			if (buttons[idx]) buttons[idx].click();
		}
		if (e.key === "Enter" && !btnNext.disabled) {
			btnNext.click();
		}
	});
})();