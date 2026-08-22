const CONSOLE_CONFIG = {
  clientId: "557794340183-s188b070e7f543o5f9nm3pfi408ma4kh.apps.googleusercontent.com",
  publishableKey: "sb_publishable_6yAW6MvHsXS9xv8kzu2YKA_D23JWWQ4",
  authUrl: "https://bbgwvpwzkyudbtcgrbtm.supabase.co/functions/v1/admin-auth",
  functionBaseUrl: "https://bbgwvpwzkyudbtcgrbtm.supabase.co/functions/v1",
};

const pageTitles = {
  analytics: "분석",
  players: "플레이어",
  player: "플레이어 상세",
  operations: "운영",
  purchases: "구매",
  cs: "CS",
  audit: "감사 기록",
  "project-k": "Project K",
};
const pageDescriptions = {
  analytics: "유입부터 플레이·유지율·수익까지 현재 상태와 다음 판단 근거를 봅니다.",
  players: "계정을 찾고 플레이 기록과 재화 상태를 빠르게 확인합니다.",
  player: "한 플레이어의 계정 상태, 기록, 보상과 변경 이력을 처리합니다.",
  operations: "전체 보상, 최소 지원 버전, QA 권한처럼 영향이 큰 작업을 관리합니다.",
  purchases: "실제 스토어 구매·환불 기록과 검토가 필요한 결제를 확인합니다.",
  cs: "답변이 필요한 문의를 우선순위대로 확인하고 처리합니다.",
  audit: "누가 무엇을 바꿨는지 확인하고 가능한 변경만 안전하게 되돌립니다.",
  "project-k": "아직 준비 중인 프로젝트입니다.",
};

let currentProjectKey = "";
let renderedRouteKey = "";
const byId = (id) => document.getElementById(id);

function confirmChange(title, body) {
  const dialog = byId("confirmDialog");
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

function selectProject(projectKey) {
  currentProjectKey = projectKey;
  const projectK = projectKey === "project_k";
  byId("currentProject").textContent = projectK ? "Project K" : "Quirky Ball";
  byId("consoleNav").hidden = projectK;
  showOnly("consoleApp");
  window.location.hash = projectK ? "#/project-k" : "#/analytics";
  renderRoute();
}

function returnToProjectPicker() {
  currentProjectKey = "";
  showOnly("projectPicker");
}

function renderRoute() {
  if (!currentProjectKey || !window.ConsoleAuth.isUnlocked()) return;
  const route = currentProjectKey === "project_k"
    ? { page: "project-k" }
    : window.ConsoleModel.routeFromHash(window.location.hash);
  document.querySelectorAll(".route-view").forEach((view) => {
    view.hidden = view.dataset.route !== route.page;
  });
  document.querySelectorAll("#consoleNav a").forEach((link) => {
    if (link.dataset.page === route.page) link.setAttribute("aria-current", "page");
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
  if (route.page === "analytics") window.ConsoleAnalytics.mount();
  if (route.page === "players") window.ConsolePlayers.mountList();
  if (route.page === "player") window.ConsolePlayers.mountDetail(route.userId);
  if (route.page === "operations") window.ConsoleOperations.mount();
  if (route.page === "purchases") window.ConsolePurchases.mount();
  if (route.page === "cs") window.ConsoleCs.mount();
  if (route.page === "audit") window.ConsoleAudit.mount();
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
byId("projectK").addEventListener("click", () => selectProject("project_k"));
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
window.addEventListener("scroll", () => {
  byId("scrollToTop").hidden = !(Number(window.scrollY) > 640);
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("console-auth-change", (event) => renderAuth(event.detail));

(async () => {
  window.ConsoleAPI.initialize({ functionBaseUrl: CONSOLE_CONFIG.functionBaseUrl });
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
