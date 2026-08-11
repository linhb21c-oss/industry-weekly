const reportDetails = window.REPORT_DETAILS || {};
const reports = (window.REPORTS || []).map((report) => ({ ...report, ...(reportDetails[report.id] || {}) }));
const categories = ["全部", ...new Set(reports.map((report) => report.category))];
let activeCategory = "全部";
let activeReportId = reports[0]?.id;

const filters = document.querySelector("#filters");
const timeline = document.querySelector("#timeline");
const reader = document.querySelector("#reader");
const count = document.querySelector("#report-count");
const template = document.querySelector("#report-template");
const manualSyncButton = document.querySelector("#manual-sync");
const syncFeedback = document.querySelector("#sync-feedback");
const categorySignals = {
  "电信运营商集中化信息更新": { label: "运营商", text: "算力与智能网络投入继续上升；集中化 BOSS 正从平台整合转向数据、AI 驱动的运营中枢。" },
  "电信行业报告": { label: "行业", text: "大模型竞争转向成本效率和商业化；存储供给偏紧，自动驾驶进入标准与合规阶段。" },
  "友商动态": { label: "友商", text: "产品发布、组织与业务布局同步调整，需结合历史时间线和行业背景交叉研判。" },
  "AI行业周刊": { label: "AI", text: "竞争焦点转向智能体协同、多模态与工作流落地，运营商 Token 经营成为新价值主线。" }
};

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function visibleReports() {
  return reports.filter((report) => activeCategory === "全部" || report.category === activeCategory);
}

function renderFilters() {
  filters.replaceChildren(...categories.map((category) => {
    const button = document.createElement("button");
    button.className = `filter${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      const visible = visibleReports();
      if (!visible.some((report) => report.id === activeReportId)) activeReportId = visible[0]?.id;
      render();
    });
    return button;
  }));
}

function renderTimeline() {
  const grouped = Object.groupBy(visibleReports(), (report) => report.publishedAt);
  timeline.replaceChildren(...Object.entries(grouped).map(([date, items]) => {
    const group = document.createElement("section");
    group.className = "date-group";
    const heading = document.createElement("div");
    heading.className = "date-heading";
    heading.textContent = formatDate(date);
    group.append(heading);
    items.forEach((report) => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.classList.toggle("active", report.id === activeReportId);
      card.querySelector(".category").textContent = report.category;
      card.querySelector(".card-title").textContent = report.title;
      card.querySelector(".period").textContent = report.period;
      card.addEventListener("click", () => { activeReportId = report.id; renderTimeline(); renderReader(); });
      group.append(card);
    });
    return group;
  }));
  count.textContent = `${visibleReports().length} 份报告`;
}

function renderReader() {
  const report = reports.find((item) => item.id === activeReportId) || reports[0];
  if (!report) return;
  const displayTitle = report.title.replace(/^\d{4}年/, "");
  const insights = report.insights || ["已纳入完整历史归档，可通过飞书查看该周的原始报告。", "切换报告类别或发布时间，即可对照浏览同一主题的连续更新。"];
  reader.innerHTML = `
    <div class="reader-meta"><span class="tag">${report.category}</span><span>发布于 ${report.publishedAt.replaceAll("-", ".")}</span></div>
    <h2>${displayTitle}</h2>
    <p class="summary">${report.summary}</p>
    <p class="section-label">三条关键信号</p>
    <div class="insights">${insights.map((insight, index) => `<div class="insight"><span class="insight-index">0${index + 1}</span><span>${insight}</span></div>`).join("")}</div>
    <div class="reader-actions"><a class="primary-action" href="${report.url}" target="_blank" rel="noreferrer">打开飞书完整报告 ↗</a></div>`;
}

function renderOverview() {
  const latest = reports[0]?.publishedAt;
  document.querySelector("#archive-total").textContent = reports.length;
  document.querySelector("#sync-date").textContent = latest ? `已同步至 ${latest.replaceAll("-", ".")}` : "暂无可用报告";
  document.querySelector("#weekly-signals").innerHTML = categories.slice(1).map((category) => {
    const signal = categorySignals[category] || { label: category, text: "本周重点动态已归档，可在报告库中查看原文。" };
    return `<div class="weekly-signal"><strong>${signal.label}</strong><span>${signal.text}</span></div>`;
  }).join("");
}

function render() { renderOverview(); renderFilters(); renderTimeline(); renderReader(); }

function setManualSyncState(state) {
  if (state.running) {
    manualSyncButton.disabled = true;
    manualSyncButton.textContent = "同步中...";
    syncFeedback.hidden = false;
    syncFeedback.className = "sync-feedback";
    syncFeedback.textContent = "正在获取飞书报告";
    return;
  }

  manualSyncButton.disabled = false;
  if (state.lastExitCode && state.lastExitCode !== 0) {
    manualSyncButton.textContent = "同步失败，重试";
    syncFeedback.hidden = false;
    syncFeedback.className = "sync-feedback error";
    syncFeedback.textContent = "同步失败，请重试";
    return;
  }

  manualSyncButton.textContent = "手工同步";
  syncFeedback.hidden = true;
}

async function syncStatus() {
  const response = await fetch("/api/sync", { cache: "no-store" });
  if (!response.ok) throw new Error("无法获取同步状态");
  return response.json();
}

async function monitorManualSync() {
  try {
    const state = await syncStatus();
    setManualSyncState(state);
    if (state.running) {
      window.setTimeout(monitorManualSync, 2000);
    } else if (state.lastExitCode === 0 && state.finishedAt) {
      window.location.reload();
    }
  } catch {
    manualSyncButton.disabled = false;
    manualSyncButton.textContent = "同步状态不可用";
    syncFeedback.hidden = false;
    syncFeedback.className = "sync-feedback error";
    syncFeedback.textContent = "同步状态不可用，请重试";
  }
}

manualSyncButton?.addEventListener("click", async () => {
  manualSyncButton.disabled = true;
  manualSyncButton.textContent = "同步中...";
  syncFeedback.hidden = false;
  syncFeedback.className = "sync-feedback";
  syncFeedback.textContent = "正在获取飞书报告";
  try {
    const response = await fetch("/api/sync", { method: "POST" });
    if (!response.ok) throw new Error("无法启动同步");
    monitorManualSync();
  } catch {
    manualSyncButton.disabled = false;
    manualSyncButton.textContent = "同步失败，重试";
    syncFeedback.hidden = false;
    syncFeedback.className = "sync-feedback error";
    syncFeedback.textContent = "同步失败，请重试";
  }
});

syncStatus().then((state) => {
  manualSyncButton.hidden = false;
  setManualSyncState(state);
}).catch(() => {
  manualSyncButton.hidden = true;
});

render();
