const form = document.querySelector("#tradeForm");
const resetButton = document.querySelector("#resetButton");
const exampleButton = document.querySelector("#exampleButton");

const els = {
  resultTitle: document.querySelector("#resultTitle"),
  resultSummary: document.querySelector("#resultSummary"),
  trendScore: document.querySelector("#trendScore"),
  setupScore: document.querySelector("#setupScore"),
  riskScore: document.querySelector("#riskScore"),
  buyPlan: document.querySelector("#buyPlan"),
  stopPlan: document.querySelector("#stopPlan"),
  sellPlan: document.querySelector("#sellPlan"),
  watchPlan: document.querySelector("#watchPlan"),
  checklist: document.querySelector("#checklist"),
  riskLabel: document.querySelector("#riskLabel")
};

const examples = [
  {
    ticker: "ASML",
    price: 876,
    ma50: 842,
    ma200: 728,
    atr: 22,
    account: 25000,
    risk: "0.01",
    horizon: "position",
    regime: "risk-on",
    thesis: "Kwaliteitsnaam met structurele vraag, maar ik wil kopen bij pullback of bevestigde breakout."
  },
  {
    ticker: "TSLA",
    price: 182,
    ma50: 196,
    ma200: 214,
    atr: 8.5,
    account: 10000,
    risk: "0.005",
    horizon: "swing",
    regime: "mixed",
    thesis: "Volatiel aandeel. Alleen interessant als de neerwaartse trend breekt met volume."
  },
  {
    ticker: "AAPL",
    price: 204,
    ma50: 198,
    ma200: 187,
    atr: 4.8,
    account: 15000,
    risk: "0.01",
    horizon: "investor",
    regime: "risk-off",
    thesis: "Defensiever groot tech aandeel, maar brede markt is kwetsbaar."
  }
];

function money(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 100 ? 0 : 2
  });
}

function number(value) {
  return value.toLocaleString("nl-BE", {
    maximumFractionDigits: value >= 100 ? 0 : 2
  });
}

function getFormData() {
  const data = new FormData(form);
  return {
    ticker: String(data.get("ticker") || "").trim().toUpperCase(),
    price: Number(data.get("price")),
    ma50: Number(data.get("ma50")),
    ma200: Number(data.get("ma200")),
    atr: Number(data.get("atr")),
    account: Number(data.get("account")),
    risk: Number(data.get("risk")),
    horizon: String(data.get("horizon")),
    regime: String(data.get("regime")),
    thesis: String(data.get("thesis") || "").trim()
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function analyse(input) {
  const above50 = input.price > input.ma50;
  const above200 = input.price > input.ma200;
  const trendDistance = ((input.price - input.ma200) / input.ma200) * 100;
  const stretched = input.atr > 0 ? (input.price - input.ma50) / input.atr : 0;
  const regimePenalty = input.regime === "risk-on" ? 8 : input.regime === "mixed" ? -3 : -16;
  const horizonStopMultiplier = input.horizon === "swing" ? 1.6 : input.horizon === "position" ? 2.3 : 3.1;

  let trend = 40;
  if (above50) trend += 20;
  if (above200) trend += 25;
  if (input.ma50 > input.ma200) trend += 12;
  trend += clamp(trendDistance / 3, -18, 18);
  trend = Math.round(clamp(trend, 0, 100));

  let setup = 52 + regimePenalty;
  if (above50 && above200) setup += 13;
  if (stretched > 2.1) setup -= 19;
  if (stretched < -0.8) setup -= 9;
  if (Math.abs(stretched) <= 1.2) setup += 10;
  setup = Math.round(clamp(setup, 0, 100));

  const pullbackBuy = above200
    ? Math.max(input.ma50, input.price - input.atr * 1.15)
    : Math.min(input.ma50, input.price + input.atr * 0.5);
  const breakoutBuy = input.price + input.atr * 0.35;
  const stop = above200
    ? Math.min(pullbackBuy - input.atr * horizonStopMultiplier, input.ma50 - input.atr * 0.75)
    : input.price - input.atr * horizonStopMultiplier;
  const riskPerShare = Math.max(0.01, pullbackBuy - stop);
  const riskBudget = input.account * input.risk;
  const shares = Math.max(0, Math.floor(riskBudget / riskPerShare));
  const positionValue = shares * pullbackBuy;
  const target1 = pullbackBuy + riskPerShare * 2;
  const target2 = pullbackBuy + riskPerShare * 3.5;
  const invalidation = above200 ? input.ma200 : Math.min(input.ma50, input.ma200);

  let risk = 76;
  if (shares < 1) risk -= 28;
  if (positionValue > input.account * 0.35) risk -= 18;
  if (input.regime === "risk-off") risk -= 14;
  if (stretched > 2.1) risk -= 12;
  risk = Math.round(clamp(risk, 0, 100));

  const bias = trend >= 70 && setup >= 60
    ? "Constructief, maar alleen met prijsdiscipline."
    : trend >= 55
      ? "Interessant, wacht op betere bevestiging."
      : "Nog niet forceren; laat het aandeel eerst bewijzen dat de trend draait.";

  const buyPlan = above200
    ? `Voorkeur: koop gefaseerd rond ${money(pullbackBuy)}. Alternatief: koop pas boven ${money(breakoutBuy)} als de uitbraak sluit boven dat niveau. Vermijd najagen als de koers meer dan 2 ATR boven het 50-daags gemiddelde staat.`
    : `Geen agressieve koop zolang de koers onder de 200-daagse trend zit. Eerste test: kleine starter pas boven ${money(breakoutBuy)}, en alleen als de koers daarna boven ${money(input.ma50)} blijft.`;

  const stopPlan = `Plaats je harde invalidatie rond ${money(stop)}. Dat houdt het risico per aandeel op ongeveer ${money(riskPerShare)}. Met ${number(input.risk * 100)}% rekeningrisico is de maximale positie ongeveer ${shares} aandelen.`;

  const sellPlan = `Neem gedeeltelijke winst rond ${money(target1)} en verhoog je stop naar break-even als de beweging blijft lopen. Laat een resterend deel mikken op ${money(target2)}, maar verkoop sneller als de koers sluit onder ${money(invalidation)}.`;

  const watchPlan = input.horizon === "swing"
    ? "Check dagelijks de slotkoers, volume en of de koers boven het 50-daags gemiddelde blijft. Nieuws kan de trade ongeldig maken voor de volgende opening."
    : input.horizon === "position"
      ? "Check na elke slotkoers en rond cijfers, rentevergaderingen en sectornieuws. De belangrijkste vraag: blijft de trend intact zonder dat je risico groter wordt?"
      : "Check wekelijks de 200-daagse trend, winstrevisies, marktrente en brede indextrend. Verlaag blootstelling als macro en prijs tegelijk verslechteren.";

  const checklist = [
    `Mijn verlies is vooraf beperkt tot ongeveer ${money(riskBudget)}.`,
    `Ik koop niet als de prijs ver boven mijn plan ligt.`,
    `Ik weet exact welke slotkoers mijn idee ongeldig maakt.`,
    `De brede markt past bij deze trade: ${input.regime}.`,
    input.thesis ? `Mijn thesis: ${input.thesis}` : "Ik heb een duidelijke thesis opgeschreven."
  ];

  return {
    bias,
    trend,
    setup,
    risk,
    buyPlan,
    stopPlan,
    sellPlan,
    watchPlan,
    checklist,
    shares,
    positionValue
  };
}

function scoreClass(score) {
  if (score >= 70) return "good";
  if (score >= 45) return "warn";
  return "bad";
}

function setScore(element, score) {
  element.textContent = `${score}/100`;
  element.className = scoreClass(score);
}

function render() {
  const input = getFormData();
  if (!input.ticker || [input.price, input.ma50, input.ma200, input.atr, input.account].some((v) => !Number.isFinite(v) || v <= 0)) {
    els.resultTitle.textContent = "Controleer je input";
    els.resultSummary.textContent = "Ticker, prijs, gemiddelden, ATR en rekeningwaarde moeten ingevuld zijn.";
    return;
  }

  const result = analyse(input);
  els.resultTitle.textContent = `${input.ticker}: ${result.bias}`;
  els.resultSummary.textContent = `De coach zoekt eerst naar trend, daarna naar asymmetrie. Positiegrootte: ${result.shares} aandelen, ongeveer ${money(result.positionValue)} blootstelling.`;
  setScore(els.trendScore, result.trend);
  setScore(els.setupScore, result.setup);
  setScore(els.riskScore, result.risk);
  els.buyPlan.textContent = result.buyPlan;
  els.stopPlan.textContent = result.stopPlan;
  els.sellPlan.textContent = result.sellPlan;
  els.watchPlan.textContent = result.watchPlan;
  els.riskLabel.textContent = result.risk >= 70 ? "Controleerbaar risico" : result.risk >= 45 ? "Klein beginnen" : "Geen haast";

  els.checklist.replaceChildren(
    ...result.checklist.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );

  localStorage.setItem("macroTradeCoach:last", JSON.stringify(input));
}

function fill(data) {
  for (const [key, value] of Object.entries(data)) {
    if (key === "regime") {
      const radio = form.querySelector(`input[name="regime"][value="${value}"]`);
      if (radio) radio.checked = true;
      continue;
    }
    const field = form.elements[key];
    if (field) field.value = value;
  }
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

form.addEventListener("input", () => {
  window.clearTimeout(form.renderTimer);
  form.renderTimer = window.setTimeout(render, 180);
});

exampleButton.addEventListener("click", () => {
  const next = examples[Math.floor(Math.random() * examples.length)];
  fill(next);
});

resetButton.addEventListener("click", () => {
  localStorage.removeItem("macroTradeCoach:last");
  fill(examples[0]);
});

try {
  const saved = JSON.parse(localStorage.getItem("macroTradeCoach:last"));
  if (saved) fill(saved);
  else render();
} catch {
  render();
}
