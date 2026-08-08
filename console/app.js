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

let currentProjectKey = "";
const byId = (id) => document.getElementById(id);

function confirmChange(title, body) {
  const dialog = byId("confirmDialog");
  byId("confirmTitle").textContent = title;
  byId("confirmBody").textContent = body;
  dialog.showModal();
  return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}

window.ConsoleApp = { confirmChange };

function showOnly(elementId) {
  ["loginPanel", "challengePanel", "projectPicker", "consoleApp"].forEach((id) => {
    byId(id).hidden = id !== elementId;
  });
}

function renderAuth(authState = window.ConsoleAuth.snapshot()) {
  byId("userEmail").textContent = authState.email || "";
  byId("challengeEmail").textContent = authState.email || "";
  if (!authState.signedIn) {
    currentProjectKey = "";
    showOnly("loginPanel");
  } else if (!authState.unlocked) {
    currentProjectKey = "";
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
  byId("pageTitle").textContent = pageTitles[route.page] || "분석";
  byId("consoleStatus").textContent = `${byId("pageTitle").textContent} 화면`;
  byId("mainContent").focus({ preventScroll: true });
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
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  byId("challengeMessage").textContent = "확인 중...";
  try {
    await window.ConsoleAuth.unlock(answerInput.value);
    byId("challengeMessage").textContent = "";
  } catch (error) {
    byId("challengeMessage").textContent = challengeErrorMessage(error);
  } finally {
    answerInput.value = "";
    submitButton.disabled = false;
  }
});

byId("projectQuirkyBall").addEventListener("click", () => selectProject("quirky_ball"));
byId("projectK").addEventListener("click", () => selectProject("project_k"));
byId("changeProjectButton").addEventListener("click", returnToProjectPicker);
["challengeLogout", "pickerLogout", "logoutButton"].forEach((id) => byId(id).addEventListener("click", () => window.ConsoleAuth.logout()));
window.addEventListener("hashchange", renderRoute);
window.addEventListener("console-auth-change", (event) => renderAuth(event.detail));

(async () => {
  window.ConsoleAPI.initialize({ functionBaseUrl: CONSOLE_CONFIG.functionBaseUrl });
  try {
    const authState = await window.ConsoleAuth.initialize(CONSOLE_CONFIG);
    window.GmailAPI.initialize({ clientId: CONSOLE_CONFIG.clientId });
    renderAuth(authState);
  } catch (_error) {
    renderAuth({ signedIn: false, unlocked: false, email: "" });
    byId("loginMessage").textContent = "Google 로그인 버튼을 불러오지 못했습니다. 공개 주소에서 다시 열어 주세요.";
  }
})();
