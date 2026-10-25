const CONSOLE_CONFIG = {
  clientId: "557794340183-s188b070e7f543o5f9nm3pfi408ma4kh.apps.googleusercontent.com",
  publishableKey: "sb_publishable_6yAW6MvHsXS9xv8kzu2YKA_D23JWWQ4",
  authUrl: "https://bbgwvpwzkyudbtcgrbtm.supabase.co/functions/v1/admin-auth",
  functionBaseUrl: "https://bbgwvpwzkyudbtcgrbtm.supabase.co/functions/v1",
};

// House Duck game server (one Supabase project for every game on it, separate from Quirky Ball's) — never merged into
// CONSOLE_CONFIG above so the Quirky Ball client's requests stay byte-for-byte unchanged. 10key Survival's admin
// function is tenkey-admin (console/tenkey*.js).
const HOUSEDUCK_CONFIG = {
  functionBaseUrl: "https://frepunpqswciugwoyvxo.supabase.co/functions/v1",
  publishableKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZXB1bnBxc3djaXVnd295dnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDA3ODQsImV4cCI6MjEwNzgxNjc4NH0.BTfi0LS35wVbsgLkdKpvRQN8e0pw2F7-vcJ2UEnWTv4",
  allowedFunctions: ["tenkey-admin"],
};

const pageTitles = {
  analytics: "분석",
  "analytics-exclusions": "통계 제외 계정",
  players: "플레이어",
  player: "플레이어 상세",
  operations: "운영",
  purchases: "구매",
  cs: "CS",
  audit: "감사 기록",
  notes: "메모",
  "tenkey-overview": "한눈 요약",
  "tenkey-players": "플레이어",
  "tenkey-player": "플레이어 상세",
  "tenkey-crashes": "크래시",
  "tenkey-notices": "공지",
  "tenkey-purchases": "구매 · 젬",
  "tenkey-ranking": "랭킹",
  "tenkey-balance": "밸런스",
  "tenkey-config": "강제 업데이트",
  "tenkey-audit": "감사 기록",
};
const pageDescriptions = {
  analytics: "유입부터 플레이·유지율·수익까지 현재 상태와 다음 판단 근거를 봅니다.",
  "analytics-exclusions": "닉네임이 아니라 서버 계정 식별자로 운영 통계에서 제외된 계정을 확인합니다.",
  players: "계정을 찾고 플레이 기록과 재화 상태를 빠르게 확인합니다.",
  player: "한 플레이어의 계정 상태, 기록, 보상과 변경 이력을 처리합니다.",
  operations: "전체 보상, 최소 지원 버전, QA 권한처럼 영향이 큰 작업을 관리합니다.",
  purchases: "실제 스토어 구매·환불 기록과 검토가 필요한 결제를 확인합니다.",
  cs: "답변이 필요한 문의를 우선순위대로 확인하고 처리합니다.",
  audit: "누가 무엇을 바꿨는지 확인하고 가능한 변경만 안전하게 되돌립니다.",
  notes: "정한 것과 그 이유를 남겨 두고 나중에 같은 판단을 다시 찾습니다.",
  "tenkey-overview": "오늘과 최근 7일의 앱을 연 사람·새로 설치·플레이·크래시·결제를 큰 숫자로 먼저 봅니다. 자세한 그래프는 아래에 접혀 있습니다.",
  "tenkey-players": "랭킹 서버에 있는 플레이어를 찾고 기록·구매·상태를 확인합니다.",
  "tenkey-player": "한 플레이어의 계정, 기록, 구매와 젬 장부, 정지 여부를 확인하고 처리합니다.",
  "tenkey-crashes": "앱이 보낸 크래시·멈춤·오류 보고를 오류 내용, 버전, 기기별로 묶어 보고 로그를 확인합니다.",
  "tenkey-notices": "게임 안 공지를 한국어로 작성·예약합니다. 다른 7개 언어는 자동으로 번역돼 함께 나갑니다.",
  "tenkey-purchases": "스토어 구매·환불 기록과 젬·리바이브 패스 장부를 확인합니다.",
  "tenkey-ranking": "이번 주와 전체 랭킹 보드를 앱에 보이는 그대로 봅니다. 제재는 플레이어 상세의 정지로 직접 합니다.",
  "tenkey-balance": "모든 판의 짧은 기록으로 판이 어디서 왜 끝나는지, DRIFT·로봇까지 얼마나 가는지, 어떤 카드를 고르는지 봅니다.",
  "tenkey-config": "Android·iOS 앱에서 이보다 낮은 빌드는 업데이트하기 전까지 게임을 못 하게 막습니다.",
  "tenkey-audit": "10KEY 관리자 변경(공지·정지·업데이트 번호·밸런스)을 누가 언제 왜 했는지 확인합니다.",
};

let currentProjectKey = "";
let renderedRouteKey = "";
const byId = (id) => document.getElementById(id);

function confirmChange(title, body) {
  const dialog = byId("confirmDialog");
  if (dialog.open) return Promise.resolve(false);
  byId("confirmTitle").textContent = title;
  byId("confirmBody").textContent = body;
  dialog.returnValue = "cancel";
  dialog.showModal();
  return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}

window.ConsoleApp = { confirmChange };

function showOnly(elementId) {
  ["loginPanel", "challengePanel", "projectPicker", "consoleApp"].forEach((id) => {
    byId(id).hidden = id !== elementId;
  });
  byId("skipLink").href = elementId === "consoleApp" ? "#mainContent" : `#${elementId}`;
}

function renderAuth(authState = window.ConsoleAuth.snapshot()) {
  byId("userEmail").textContent = authState.email || "";
  byId("challengeEmail").textContent = authState.email || "";
  if (!authState.signedIn) {
    currentProjectKey = "";
    renderedRouteKey = "";
    showOnly("loginPanel");
  } else if (!authState.unlocked) {
    currentProjectKey = "";
    renderedRouteKey = "";
    showOnly("challengePanel");
    byId("challengeAnswer").focus();
  } else if (currentProjectKey) {
    showOnly("consoleApp");
    renderRoute();
  } else {
    showOnly("projectPicker");
  }
}

const QB_ROUTE_PATTERN = /^#\/(analytics(?:-exclusions)?|players|operations|purchases|cs|audit|notes)(?:[/?]|$)/;
const TENKEY_ROUTE_PATTERN = /^#\/(tenkey-(?:overview|players|player|crashes|notices|purchases|ranking|balance|config|audit))(?:[/?]|$)/;

// One row per game: title in the sidebar, its <nav>, the hash routes it owns and its landing page.
const PROJECTS = {
  quirky_ball: { title: "Quirky Ball", nav: "consoleNav", routePattern: QB_ROUTE_PATTERN, home: "#/analytics" },
  tenkey: { title: "10key Survival", nav: "tenkeyNav", routePattern: TENKEY_ROUTE_PATTERN, home: "#/tenkey-overview" },
};

function selectProject(projectKey) {
  const project = PROJECTS[projectKey];
  if (!project) return;
  currentProjectKey = projectKey;
  byId("currentProject").textContent = project.title;
  Object.values(PROJECTS).forEach((entry) => { byId(entry.nav).hidden = entry !== project; });
  showOnly("consoleApp");
  window.location.hash = project.routePattern.test(window.location.hash) ? window.location.hash : project.home;
  renderRoute();
}

function returnToProjectPicker() {
  currentProjectKey = "";
  showOnly("projectPicker");
}

function renderRoute() {
  if (!currentProjectKey || !window.ConsoleAuth.isUnlocked()) return;
  const route = window.ConsoleModel.routeFromHash(window.location.hash);
  document.querySelectorAll(".route-view").forEach((view) => {
    view.hidden = view.dataset.route !== route.page;
  });
  document.querySelectorAll(Object.values(PROJECTS).map((entry) => `#${entry.nav} a`).join(", ")).forEach((link) => {
    const parent = route.page === "player" ? "players" : route.page === "tenkey-player" ? "tenkey-players" : route.page;
    if (link.dataset.page === route.page || link.dataset.page === parent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const routeKey = `${route.page}:${route.userId || ""}`;
  const routeChanged = routeKey !== renderedRouteKey;
  renderedRouteKey = routeKey;
  byId("pageTitle").textContent = pageTitles[route.page] || "분석";
  byId("pageDescription").textContent = pageDescriptions[route.page] || pageDescriptions.analytics;
  byId("consoleStatus").textContent = `${byId("pageTitle").textContent} 화면`;
  byId("mainContent").focus({ preventScroll: true });
  if (routeChanged && typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "auto" });
  if (route.page === "analytics") { window.ConsoleAnalytics.mount(); window.ConsoleLab?.loadAnalytics(); }
  if (route.page === "analytics-exclusions") window.ConsoleAnalyticsExclusions.mount();
  if (route.page === "players") window.ConsolePlayers.mountList();
  if (route.page === "player") window.ConsolePlayers.mountDetail(route.userId);
  if (route.page === "operations") { window.ConsoleOperations.mount(); window.ConsoleLiveops?.mount(); }
  if (route.page === "purchases") window.ConsolePurchases.mount();
  if (route.page === "cs") { window.ConsoleCs.mount(); window.ConsoleLab?.loadReports(); }
  if (route.page === "audit") window.ConsoleAudit.mount();
  if (route.page === "notes") window.ConsoleNotes.mount();
  if (route.page === "tenkey-overview") window.ConsoleTenkey.mountOverview();
  if (route.page === "tenkey-players") window.ConsoleTenkey.mountPlayers();
  if (route.page === "tenkey-player") window.ConsoleTenkey.mountPlayer(route.userId);
  if (route.page === "tenkey-crashes") window.ConsoleTenkey.mountCrashes();
  if (route.page === "tenkey-notices") window.ConsoleTenkey.mountNotices();
  if (route.page === "tenkey-purchases") window.ConsoleTenkey.mountPurchases();
  if (route.page === "tenkey-ranking") window.ConsoleTenkey.mountRanking();
  if (route.page === "tenkey-balance") window.ConsoleTenkey.mountBalance();
  if (route.page === "tenkey-audit") window.ConsoleTenkey.mountAudit();
  if (route.page === "tenkey-config") window.ConsoleTenkey.mountConfig();
}

function challengeErrorMessage(error) {
  const messages = {
    challenge_invalid: "답이 맞지 않습니다.",
    challenge_locked: "시도가 잠겼습니다. 15분 뒤 다시 시도해 주세요.",
    admin_required: "이 Google 계정에는 관리자 권한이 없습니다.",
    invalid_google_identity: "Google 로그인이 만료되었습니다. 다시 로그인해 주세요.",
    server_not_configured: "서버 인증 설정이 아직 완료되지 않았습니다.",
  };
  return messages[error?.message] || "관리자 확인을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
}

byId("challengeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const answerInput = byId("challengeAnswer");
  const finishRequest = window.ConsoleUiState.beginRequest(event.currentTarget);
  if (!finishRequest) return;
  let failed = false;
  window.ConsoleUiState.setMessage(byId("challengeMessage"), "확인 중...");
  try {
    await window.ConsoleAuth.unlock(answerInput.value);
    window.ConsoleUiState.setMessage(byId("challengeMessage"), "");
  } catch (error) {
    if (error?.message === "invalid_google_identity") {
      window.ConsoleUiState.setMessage(byId("challengeMessage"), "");
      window.ConsoleUiState.setMessage(byId("loginMessage"), challengeErrorMessage(error), true);
      window.ConsoleAuth.logout();
    } else {
      failed = true;
      window.ConsoleUiState.setMessage(byId("challengeMessage"), challengeErrorMessage(error), true);
    }
  } finally {
    answerInput.value = "";
    finishRequest();
    if (failed) answerInput.focus();
  }
});

byId("projectQuirkyBall").addEventListener("click", () => selectProject("quirky_ball"));
byId("projectTenkey").addEventListener("click", () => selectProject("tenkey"));
byId("changeProjectButton").addEventListener("click", returnToProjectPicker);
["challengeLogout", "pickerLogout", "logoutButton"].forEach((id) => byId(id).addEventListener("click", () => window.ConsoleAuth.logout()));
byId("refreshRouteButton").addEventListener("click", () => {
  const button = byId("refreshRouteButton");
  button.classList.add("is-refreshing");
  renderRoute();
  window.setTimeout(() => button.classList.remove("is-refreshing"), 650);
});
byId("scrollToTop").addEventListener("click", () => {
  if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "smooth" });
});
byId("mainContent").addEventListener("click", (event) => {
  const button = event.target.closest("[data-console-jump]");
  if (!button) return;
  const target = byId(button.dataset.consoleJump);
  if (!target) return;
  for (let node = target; node; node = node.parentElement) {
    if (node.tagName === "DETAILS") node.open = true;
  }
  target.scrollIntoView({ block: "start", behavior: "auto" });
  const focus = target.matches("details") ? target.querySelector("summary") : target.querySelector("h2, h3");
  if (focus) { if (!target.matches("details")) focus.tabIndex = -1; focus.focus({ preventScroll: true }); }
});
window.addEventListener("scroll", () => {
  byId("scrollToTop").hidden = !(Number(window.scrollY) > 640);
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("console-auth-change", (event) => renderAuth(event.detail));

(async () => {
  window.ConsoleAPI.initialize({ functionBaseUrl: CONSOLE_CONFIG.functionBaseUrl });
  window.ConsoleAPI.initializeProject?.("houseduck", HOUSEDUCK_CONFIG);
  const finishLogin = window.ConsoleUiState.beginRequest(byId("loginPanel"));
  window.ConsoleUiState.setMessage(byId("loginMessage"), "Google 로그인 버튼을 불러오는 중입니다.");
  try {
    const authState = await window.ConsoleAuth.initialize(CONSOLE_CONFIG);
    window.GmailAPI.initialize({ clientId: CONSOLE_CONFIG.clientId });
    window.ConsoleUiState.setMessage(byId("loginMessage"), "");
    renderAuth(authState);
  } catch (_error) {
    renderAuth({ signedIn: false, unlocked: false, email: "" });
    window.ConsoleUiState.setMessage(byId("loginMessage"), "Google 로그인 버튼을 불러오지 못했습니다. 공개 주소에서 다시 열어 주세요.", true);
  } finally {
    finishLogin?.();
  }
})();
