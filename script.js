const tabs = [...document.querySelectorAll(".tab")];
const panels = [...document.querySelectorAll(".panel")];
const svgNS = "http://www.w3.org/2000/svg";

function showTab(id) {
  document.body.dataset.activeTab = id;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === id));
  panels.forEach((panel) => panel.classList.toggle("is-active", panel.id === id));
  document.getElementById(id)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "learn") {
    window.setTimeout(() => renderLearnCanvases(performance.now()), 60);
  }
  if (id === "data") {
    drawChart();
  }
}

tabs.forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.jump));
});

const shapeConfigs = {
  equal: {
    label: "兩個一樣粗的杯子",
    vessels: [{ x: 120, width: 138 }, { x: 462, width: 138 }]
  },
  unequal: {
    label: "一寬一細的杯子",
    vessels: [{ x: 90, width: 190 }, { x: 500, width: 92 }]
  },
  three: {
    label: "三個不同形狀的杯子",
    vessels: [{ x: 70, width: 88 }, { x: 305, width: 126 }, { x: 558, width: 72 }]
  },
  curved: {
    label: "彎曲造型連通杯",
    vessels: [{ x: 105, width: 132, tilt: -5 }, { x: 480, width: 120, tilt: 5 }]
  }
};

const amountMap = {
  1: { label: "少量", finalY: 276, level: 2 },
  2: { label: "中量", finalY: 220, level: 3 },
  3: { label: "大量", finalY: 164, level: 4 }
};

const speedMap = {
  1: { label: "慢速", ms: 1900 },
  2: { label: "標準", ms: 1150 },
  3: { label: "快速", ms: 520 }
};

const labState = {
  balanced: false,
  lastStart: [],
  lastFinal: [],
  activeShape: "unequal"
};

const vesselShape = document.getElementById("vesselShape");
const waterAmount = document.getElementById("waterAmount");
const flowSpeed = document.getElementById("flowSpeed");
const amountOut = document.getElementById("amountOut");
const speedOut = document.getElementById("speedOut");
const showGuide = document.getElementById("showGuide");
const reduceMotion = document.getElementById("reduceMotion");
const labForm = document.getElementById("labForm");
const labResult = document.getElementById("labResult");
const balanceBadge = document.getElementById("balanceBadge");
const pipeSimulator = document.getElementById("pipeSimulator");

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function selectedPour() {
  return document.querySelector('input[name="pourSide"]:checked')?.value || "left";
}

function selectedPrediction() {
  return document.querySelector('input[name="prediction"]:checked')?.value || "equal";
}

function currentConfig() {
  return shapeConfigs[vesselShape.value];
}

function setupMiddlePour() {
  const line = document.getElementById("middlePourLine");
  const middleRadio = line.querySelector("input");
  const hasMiddle = currentConfig().vessels.length === 3;
  line.hidden = !hasMiddle;
  if (!hasMiddle && middleRadio.checked) {
    document.querySelector('input[name="pourSide"][value="left"]').checked = true;
  }
}

function startLevels(finalY) {
  const vessels = currentConfig().vessels;
  const pour = selectedPour();
  const sourceIndex = pour === "left" ? 0 : pour === "right" ? vessels.length - 1 : Math.floor(vessels.length / 2);
  return vessels.map((_, index) => {
    if (index === sourceIndex) return Math.max(92, finalY - 58);
    return Math.min(316, finalY + (vessels.length === 3 ? 42 : 56));
  });
}

function setWaterLevels(levels, durationMs) {
  const base = 342;
  levels.forEach((y, index) => {
    const water = document.getElementById(`water-${index}`);
    const line = document.getElementById(`water-line-${index}`);
    if (!water || !line) return;
    water.style.transitionDuration = `${durationMs}ms`;
    line.style.transitionDuration = `${durationMs}ms`;
    water.setAttribute("y", y);
    water.setAttribute("height", base - y);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
  });
}

function setValve(open) {
  const valve = document.getElementById("valveIcon");
  const valveText = document.getElementById("valveText");
  if (!valve || !valveText) return;
  valve.setAttribute("fill", open ? "#87dfaa" : "#ffd166");
  valve.setAttribute("stroke", open ? "#23784f" : "#a66a13");
  document.getElementById("valveBar")?.setAttribute("d", open ? "M -12 0 L 12 0" : "M -10 -10 L 10 10");
  valveText.textContent = open ? "開啟" : "關閉";
}

function renderPipe() {
  setupMiddlePour();
  amountOut.textContent = amountMap[waterAmount.value].label;
  speedOut.textContent = speedMap[flowSpeed.value].label;

  const scaleLayer = document.getElementById("scaleLayer");
  const guideLayer = document.getElementById("guideLayer");
  const pipeLayer = document.getElementById("pipeLayer");
  const waterLayer = document.getElementById("waterLayer");
  const valveLayer = document.getElementById("valveLayer");
  const outlineLayer = document.getElementById("outlineLayer");
  const labelLayer = document.getElementById("labelLayer");
  [scaleLayer, guideLayer, pipeLayer, waterLayer, valveLayer, outlineLayer, labelLayer].forEach((layer) => layer.innerHTML = "");

  const defs = svgEl("defs");
  defs.innerHTML = `
    <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4bdff4"></stop>
      <stop offset="100%" stop-color="#117ea1"></stop>
    </linearGradient>
  `;
  waterLayer.appendChild(defs);

  for (let i = 0; i < 5; i += 1) {
    const y = 112 + i * 52;
    scaleLayer.appendChild(svgEl("line", { x1: 36, x2: 66, y1: y, y2: y, stroke: "#89aeb4", "stroke-width": 2 }));
    const text = svgEl("text", { x: 28, y: y + 5, fill: "#5d7075", "font-size": 15, "text-anchor": "end", "font-weight": 800 });
    text.textContent = `${5 - i}`;
    scaleLayer.appendChild(text);
  }

  const config = currentConfig();
  const first = config.vessels[0];
  const last = config.vessels[config.vessels.length - 1];
  const startX = first.x + first.width / 2;
  const endX = last.x + last.width / 2;

  pipeLayer.appendChild(svgEl("path", {
    d: `M ${startX} 340 V 378 H ${endX} V 340`,
    fill: "none",
    stroke: "rgba(17,126,161,.78)",
    "stroke-width": 26,
    "stroke-linejoin": "round"
  }));
  waterLayer.appendChild(svgEl("path", {
    d: `M ${startX} 340 V 378 H ${endX} V 340`,
    fill: "none",
    stroke: "#117ea1",
    "stroke-width": 13,
    "stroke-linejoin": "round"
  }));

  const finalY = amountMap[waterAmount.value].finalY;
  const guide = svgEl("g", { id: "equalGuide", opacity: showGuide.checked ? "1" : "0" });
  guide.appendChild(svgEl("line", { x1: 62, x2: 660, y1: finalY, y2: finalY, stroke: "#ffd166", "stroke-width": 4, "stroke-dasharray": "10 9" }));
  const guideText = svgEl("text", { x: 630, y: finalY - 10, fill: "#8b6000", "font-size": 15, "text-anchor": "end", "font-weight": 900 });
  guideText.textContent = "平衡水面";
  guide.appendChild(guideText);
  guideLayer.appendChild(guide);

  config.vessels.forEach((vessel, index) => {
    const group = svgEl("g", vessel.tilt ? { transform: `rotate(${vessel.tilt} ${vessel.x + vessel.width / 2} 340)` } : {});
    const innerX = vessel.x + 9;
    const innerW = vessel.width - 18;
    group.appendChild(svgEl("rect", { x: innerX, y: 80, width: innerW, height: 260, rx: 6, fill: "#eefbff" }));
    const water = svgEl("rect", { id: `water-${index}`, class: "water-rect", x: innerX, y: 230, width: innerW, height: 112, rx: 2, fill: "url(#waterGradient)" });
    const waterLine = svgEl("line", { id: `water-line-${index}`, class: "water-line", x1: innerX, x2: innerX + innerW, y1: 230, y2: 230, stroke: "#d8fbff", "stroke-width": 5, "stroke-linecap": "round" });
    const outline = svgEl("path", {
      d: `M ${vessel.x} 76 L ${vessel.x} 336 Q ${vessel.x} 348 ${vessel.x + 12} 348 L ${vessel.x + vessel.width - 12} 348 Q ${vessel.x + vessel.width} 348 ${vessel.x + vessel.width} 336 L ${vessel.x + vessel.width} 76`,
      fill: "none",
      stroke: "#2c6f80",
      "stroke-width": 8,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    group.appendChild(water);
    group.appendChild(waterLine);
    group.appendChild(outline);
    outlineLayer.appendChild(group);

    const label = svgEl("text", { x: vessel.x + vessel.width / 2, y: 414, fill: "#3d5e66", "font-size": 16, "text-anchor": "middle", "font-weight": 900 });
    label.textContent = config.vessels.length === 3 ? ["左杯", "中杯", "右杯"][index] : `${index === 0 ? "左" : "右"}杯`;
    labelLayer.appendChild(label);
  });

  for (let i = 0; i < 4; i += 1) {
    waterLayer.appendChild(svgEl("circle", { class: "bubble", cx: startX + 55 + i * 48, cy: 370, r: 4 + i, fill: "#d8fbff", style: `animation-delay: ${i * .25}s` }));
  }

  const valveX = (startX + endX) / 2;
  const valve = svgEl("g", { transform: `translate(${valveX} 378)` });
  valve.innerHTML = `
    <circle id="valveIcon" r="20" fill="#ffd166" stroke="#a66a13" stroke-width="4"></circle>
    <path id="valveBar" d="M -10 -10 L 10 10" stroke="#79510e" stroke-width="5" stroke-linecap="round"></path>
    <text id="valveText" x="0" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="#5d7075">關閉</text>
  `;
  valveLayer.appendChild(valve);

  labState.balanced = false;
  labState.activeShape = vesselShape.value;
  labState.lastStart = startLevels(finalY);
  labState.lastFinal = config.vessels.map(() => finalY);
  setWaterLevels(labState.lastStart, 0);
  setValve(false);
  pipeSimulator.classList.remove("is-flowing");
  balanceBadge.textContent = "通道關閉，等待預測";
  labResult.textContent = "先選條件和預測，再按下「打開通道，開始觀察」。";
}

function runExperiment(event) {
  event?.preventDefault?.();
  const duration = reduceMotion.checked ? 10 : speedMap[flowSpeed.value].ms;
  labState.balanced = true;
  pipeSimulator.classList.add("is-flowing");
  setValve(true);
  balanceBadge.textContent = "水正在流動...";
  setWaterLevels(labState.lastFinal, duration);

  window.setTimeout(() => {
    pipeSimulator.classList.remove("is-flowing");
    balanceBadge.textContent = "已平衡：水面等高";
    const prediction = selectedPrediction();
    const correct = prediction === "equal";
    labResult.textContent = correct
      ? "預測正確。杯子形狀不同，清水平衡後仍會停在同一條水平線上。"
      : "再想想。底部相通後，水會流動到每個相通杯子的水面一樣高。";
    updateDataFromLab();
    drawChart();
  }, duration + 80);
}

function loadPreset(type) {
  if (type === "shape") {
    vesselShape.value = "unequal";
    waterAmount.value = "2";
    document.querySelector('input[name="pourSide"][value="left"]').checked = true;
  }
  if (type === "valve") {
    vesselShape.value = "equal";
    waterAmount.value = "3";
    document.querySelector('input[name="pourSide"][value="left"]').checked = true;
  }
  if (type === "three") {
    vesselShape.value = "three";
    waterAmount.value = "2";
    document.querySelector('input[name="pourSide"][value="middle"]').checked = true;
  }
  document.querySelector('input[name="prediction"][value="equal"]').checked = true;
  renderPipe();
  showTab("lab");
}

document.querySelectorAll("[data-load-preset]").forEach((button) => {
  button.addEventListener("click", () => loadPreset(button.dataset.loadPreset));
});

[vesselShape, waterAmount, flowSpeed, showGuide, reduceMotion].forEach((control) => {
  control.addEventListener("input", renderPipe);
  control.addEventListener("change", renderPipe);
});
document.querySelectorAll('input[name="pourSide"]').forEach((radio) => radio.addEventListener("change", renderPipe));
document.getElementById("resetLab").addEventListener("click", renderPipe);
labForm.addEventListener("submit", runExperiment);

const defaultData = [
  { label: "左杯", start: 4, final: 3 },
  { label: "右杯", start: 2, final: 3 }
];
let chartData = defaultData.map((item) => ({ ...item }));

function renderDataInputs() {
  const container = document.getElementById("dataInputs");
  container.innerHTML = "";
  chartData.forEach((item, index) => {
    const row = document.createElement("label");
    row.className = "data-row";
    row.innerHTML = `
      <span>${item.label}</span>
      <input type="number" min="0" max="5" step="0.1" value="${item.start}" aria-label="${item.label}一開始高度">
      <input type="number" min="0" max="5" step="0.1" value="${item.final}" aria-label="${item.label}平衡後高度">
    `;
    const [startInput, finalInput] = row.querySelectorAll("input");
    startInput.addEventListener("input", () => {
      chartData[index].start = Number(startInput.value);
      drawChart();
    });
    finalInput.addEventListener("input", () => {
      chartData[index].final = Number(finalInput.value);
      drawChart();
    });
    container.appendChild(row);
  });
}

function heightToLevel(y) {
  const value = 5 - ((y - 112) / 52);
  return Math.max(0, Math.min(5, Math.round(value * 10) / 10));
}

function updateDataFromLab() {
  const config = currentConfig();
  chartData = config.vessels.map((_, index) => ({
    label: config.vessels.length === 3 ? ["左杯", "中杯", "右杯"][index] : `${index === 0 ? "左" : "右"}杯`,
    start: heightToLevel(labState.lastStart[index]),
    final: heightToLevel(labState.lastFinal[index])
  }));
  renderDataInputs();
}

function drawChart() {
  const canvas = document.getElementById("barChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  const left = 82;
  const right = 36;
  const top = 44;
  const bottom = 70;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  ctx.strokeStyle = "#d8e7e4";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5d7075";
  ctx.font = "700 16px 'Noto Sans TC', sans-serif";
  for (let i = 0; i <= 5; i += 1) {
    const y = top + plotH - (i / 5) * plotH;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillText(`${i}`, 44, y + 5);
  }

  const groupW = plotW / chartData.length;
  chartData.forEach((item, index) => {
    const x = left + index * groupW + groupW * .18;
    const barW = Math.min(58, groupW * .22);
    const startH = (item.start / 5) * plotH;
    const finalH = (item.final / 5) * plotH;
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(x, top + plotH - startH, barW, startH);
    ctx.fillStyle = "#1fb6d8";
    ctx.fillRect(x + barW + 14, top + plotH - finalH, barW, finalH);
    ctx.fillStyle = "#17323a";
    ctx.textAlign = "center";
    ctx.fillText(item.label, x + barW + 7, height - 32);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#8b6000";
  ctx.fillRect(width - 230, 28, 16, 16);
  ctx.fillText("一開始", width - 206, 42);
  ctx.fillStyle = "#117ea1";
  ctx.fillRect(width - 130, 28, 16, 16);
  ctx.fillText("平衡後", width - 106, 42);

  const finals = chartData.map((item) => item.final);
  const same = finals.every((value) => Math.abs(value - finals[0]) < .15);
  document.getElementById("conclusion").textContent = same
    ? "觀察結論：平衡後各杯水面高度相同，符合連通管原理。"
    : "觀察結論：平衡後高度仍不同，請檢查是否已打開通道或資料是否輸入正確。";
}

document.getElementById("loadLastResult").addEventListener("click", () => {
  updateDataFromLab();
  drawChart();
});
document.getElementById("resetData").addEventListener("click", () => {
  chartData = defaultData.map((item) => ({ ...item }));
  renderDataInputs();
  drawChart();
});
document.getElementById("printPage").addEventListener("click", () => window.print());

const applicationExamples = {
  cups: {
    kicker: "例子 1",
    title: "兩個相通透明杯",
    text: "兩個透明杯用底部小管相連，水可以在杯子間流動，最後水面會停在一樣高的位置。",
    think: "想一想：如果右杯變得很細，最後水面會改變嗎？"
  },
  level: {
    kicker: "例子 2",
    title: "水準管",
    text: "工地或校園測量高度時，可以利用透明水管兩端水面等高的性質，判斷兩個位置是否同高。",
    think: "想一想：為什麼水管中間可以彎曲，兩端水面仍能比較高度？"
  },
  tank: {
    kicker: "例子 3",
    title: "水桶水位管",
    text: "有些水桶旁邊接透明小管，小管和桶內相通，所以小管水面可以顯示桶內水位。",
    think: "想一想：如果透明小管底部堵住，還能顯示正確水位嗎？"
  },
  teapot: {
    kicker: "例子 4",
    title: "茶壺壺嘴",
    text: "茶壺和壺嘴底部相通，裝水後壺嘴裡的水面會和壺身裡的水面接近同高。",
    think: "想一想：為什麼壺嘴通常不會做得比壺身開口低很多？"
  },
  tower: {
    kicker: "例子 5",
    title: "水塔供水",
    text: "高處水塔和管線相連，水會受到高度差影響流向較低位置。這是連通與水壓概念的生活延伸。",
    think: "想一想：住在高樓時，為什麼水塔位置和水壓有關？"
  },
  uTube: {
    kicker: "例子 6",
    title: "U 形管觀察",
    text: "U 形管兩邊相通，裝入同一種液體後，靜止時兩端液面會位在同一高度。",
    think: "想一想：如果兩端液體不同，結果還一定相同嗎？"
  }
};

let activeApplication = "cups";
const applicationCanvas = document.getElementById("applicationCanvas");
const applicationCtx = applicationCanvas.getContext("2d");

document.querySelectorAll(".application-choice").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".application-choice").forEach((choice) => choice.classList.toggle("is-active", choice === button));
    activeApplication = button.dataset.app;
    const item = applicationExamples[activeApplication];
    document.getElementById("applicationVisual").className = `application-visual ${activeApplication}-scene`;
    document.getElementById("applicationKicker").textContent = item.kicker;
    document.getElementById("applicationTitle").textContent = item.title;
    document.getElementById("applicationText").textContent = item.text;
    document.getElementById("applicationThink").textContent = item.think;
    drawApplication(performance.now());
  });
});

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#e9fbff");
  gradient.addColorStop(.62, "#fffdf7");
  gradient.addColorStop(1, "#effdf4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCup(ctx, x, y, w, h, waterY, label) {
  ctx.strokeStyle = "#2c6f80";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.quadraticCurveTo(x, y + h + 10, x + 10, y + h + 10);
  ctx.lineTo(x + w - 10, y + h + 10);
  ctx.quadraticCurveTo(x + w, y + h + 10, x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.fillStyle = "#1fb6d8";
  ctx.fillRect(x + 7, waterY, w - 14, y + h - waterY + 6);
  ctx.fillStyle = "#17323a";
  ctx.font = "800 20px 'Noto Sans TC', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h + 45);
}

function drawApplication(now) {
  const rect = applicationCanvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(420, Math.round(rect.width));
  const height = Math.max(320, Math.round(rect.height));
  if (applicationCanvas.width !== Math.round(width * scale) || applicationCanvas.height !== Math.round(height * scale)) {
    applicationCanvas.width = Math.round(width * scale);
    applicationCanvas.height = Math.round(height * scale);
  }
  applicationCtx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBackground(applicationCtx, width, height);
  const t = now / 1000;
  const pulse = Math.sin(t * 1.8) * 8;

  if (activeApplication === "tower") {
    applicationCtx.fillStyle = "#9fd6a9";
    applicationCtx.fillRect(0, height * .76, width, height * .24);
    applicationCtx.fillStyle = "#117ea1";
    roundedRect(applicationCtx, width * .12, height * .18, width * .26, height * .18, 14);
    applicationCtx.fill();
    applicationCtx.fillStyle = "#8b6b3c";
    applicationCtx.fillRect(width * .2, height * .36, width * .1, height * .42);
    applicationCtx.strokeStyle = "#117ea1";
    applicationCtx.lineWidth = 10;
    applicationCtx.beginPath();
    applicationCtx.moveTo(width * .38, height * .28);
    applicationCtx.lineTo(width * .7, height * .54);
    applicationCtx.lineTo(width * .84, height * .54);
    applicationCtx.stroke();
  } else if (activeApplication === "teapot") {
    applicationCtx.fillStyle = "#fff4d4";
    roundedRect(applicationCtx, width * .18, height * .38, width * .38, height * .28, 24);
    applicationCtx.fill();
    applicationCtx.strokeStyle = "#2c6f80";
    applicationCtx.lineWidth = 10;
    applicationCtx.beginPath();
    applicationCtx.moveTo(width * .52, height * .48);
    applicationCtx.quadraticCurveTo(width * .72, height * .42, width * .82, height * .32);
    applicationCtx.stroke();
    applicationCtx.fillStyle = "#1fb6d8";
    applicationCtx.fillRect(width * .21, height * .52, width * .32, height * .12);
  } else {
    drawCup(applicationCtx, width * .14, height * .2, width * .22, height * .46, height * .43 + pulse, "左");
    drawCup(applicationCtx, width * .64, height * .28, width * .16, height * .38, height * .43 + pulse, "右");
    applicationCtx.strokeStyle = "#117ea1";
    applicationCtx.lineWidth = 16;
    applicationCtx.beginPath();
    applicationCtx.moveTo(width * .25, height * .68);
    applicationCtx.lineTo(width * .25, height * .78);
    applicationCtx.lineTo(width * .72, height * .78);
    applicationCtx.lineTo(width * .72, height * .68);
    applicationCtx.stroke();
    applicationCtx.strokeStyle = "#ffd166";
    applicationCtx.lineWidth = 4;
    applicationCtx.setLineDash([10, 10]);
    applicationCtx.beginPath();
    applicationCtx.moveTo(width * .1, height * .43 + pulse);
    applicationCtx.lineTo(width * .88, height * .43 + pulse);
    applicationCtx.stroke();
    applicationCtx.setLineDash([]);
  }
}

function animateApplications(now) {
  drawApplication(now);
  requestAnimationFrame(animateApplications);
}

function renderLearnCanvases(now) {
  document.querySelectorAll(".learn-canvas").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    drawBackground(ctx, w, h);
    const type = canvas.dataset.learnCanvas;
    if (type === "connected") {
      drawCup(ctx, 70, 42, 118, 150, 104, "高");
      drawCup(ctx, 332, 64, 92, 128, 134, "低");
      ctx.strokeStyle = "#117ea1";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(130, 202);
      ctx.lineTo(130, 230);
      ctx.lineTo(378, 230);
      ctx.lineTo(378, 202);
      ctx.stroke();
    }
    if (type === "pressure") {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(60, 120);
      ctx.lineTo(460, 120);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#117ea1";
      ctx.font = "900 24px 'Noto Sans TC', sans-serif";
      ctx.fillText("同一深度", 190, 110);
      ctx.fillText("壓力平衡", 190, 158);
    }
    if (type === "shape") {
      drawCup(ctx, 50, 48, 150, 146, 118, "寬杯");
      drawCup(ctx, 330, 40, 70, 154, 118, "細杯");
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(44, 118);
      ctx.lineTo(420, 118);
      ctx.stroke();
    }
  });
}

const quizItems = [
  {
    question: "1. 兩個底部相通的透明杯裝入清水，水不再流動後會怎樣？",
    options: ["寬杯水面較高", "細杯水面較高", "兩杯水面一樣高", "水全部跑到寬杯"],
    answer: 2,
    reason: "同種液體在相通且上方開放的容器中，平衡後水面會等高。"
  },
  {
    question: "2. 哪個條件符合今天的連通管基本模型？",
    options: ["裝不同飲料", "底部相通並裝清水", "杯子沒有相通", "杯子完全密閉且加壓"],
    answer: 1,
    reason: "第一版教材只討論同種液體、底部相通、上方開放的情境。"
  },
  {
    question: "3. 左寬右細的兩個杯子底部相通，最後水面如何？",
    options: ["左邊較高", "右邊較高", "一樣高", "無法觀察"],
    answer: 2,
    reason: "杯子粗細不同不會改變最後等高的結果。"
  },
  {
    question: "4. 水桶旁邊接透明小管，為什麼能看桶內水位？",
    options: ["透明管和水桶相通", "透明管比較細", "透明管會產生水", "水桶顏色改變"],
    answer: 0,
    reason: "透明小管和水桶相通，因此水面高度可反映桶內水位。"
  }
];

function renderQuiz() {
  const list = document.getElementById("quizList");
  list.innerHTML = "";
  quizItems.forEach((item, itemIndex) => {
    const card = document.createElement("article");
    card.className = "quiz-card";
    card.innerHTML = `<h3>${item.question}</h3><div class="quiz-options"></div><p class="quiz-reason" aria-live="polite"></p>`;
    const options = card.querySelector(".quiz-options");
    const reason = card.querySelector(".quiz-reason");
    item.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      button.className = "quiz-option";
      button.type = "button";
      button.textContent = option;
      button.addEventListener("click", () => {
        card.querySelectorAll(".quiz-option").forEach((choice) => choice.classList.remove("is-correct", "is-wrong"));
        button.classList.add(optionIndex === item.answer ? "is-correct" : "is-wrong");
        quizAnswers[itemIndex] = optionIndex === item.answer;
        reason.textContent = item.reason;
        updateScore();
      });
      options.appendChild(button);
    });
    list.appendChild(card);
  });
}

const quizAnswers = {};
function updateScore() {
  const score = Object.values(quizAnswers).filter(Boolean).length;
  const done = Object.keys(quizAnswers).length;
  document.getElementById("scoreBox").textContent = done < quizItems.length
    ? `已作答 ${done} / ${quizItems.length} 題，目前答對 ${score} 題。`
    : `完成。你答對 ${score} / ${quizItems.length} 題。${score === quizItems.length ? "獲得連通管小小研究員徽章。" : "可以回到實驗室再觀察一次。"}`;
}

document.getElementById("retryQuiz").addEventListener("click", () => {
  Object.keys(quizAnswers).forEach((key) => delete quizAnswers[key]);
  renderQuiz();
  updateScore();
});

window.addEventListener("resize", () => {
  drawChart();
  renderLearnCanvases(performance.now());
});

renderPipe();
renderDataInputs();
drawChart();
renderQuiz();
updateScore();
requestAnimationFrame(animateApplications);

const previewMode = new URLSearchParams(window.location.search).get("preview");
if (previewMode === "balanced") {
  showTab("lab");
  showGuide.checked = true;
  reduceMotion.checked = true;
  window.setTimeout(() => runExperiment(), 80);
}
