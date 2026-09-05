#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("console/index.html");
const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], {
  textContent: "", innerHTML: "", dataset: {}, style: {}, setAttribute() {},
  querySelector: () => ({ setAttribute() {} }), querySelectorAll: () => [],
}]));
const window = { location: { hash: "#/analytics" } };
const context = vm.createContext({ window, document: { getElementById: (id) => {
  assert.ok(nodes.has(id), `real HTML must contain ${id}`);
  return nodes.get(id);
}, querySelectorAll: () => [] }, console, Intl, Date, URLSearchParams });
vm.runInContext(read("console/model.js"), context);
window.ConsoleModel = context.ConsoleModel;
// Only expose private renderers inside the VM; no production test hooks or alternate implementations.
vm.runInContext(read("console/analytics.js").replace("root.ConsoleAnalytics = { mount, load: loadDashboard };", `root.ConsoleAnalytics = {
  render(payload) { state.payload = payload; const model = { metrics: { completion: {status:"neutral"}, duration: {status:"neutral"}, retention: {status:"neutral"} } };
    renderAnalyticsCoverage(); renderExecutiveSummary(model); renderExecutiveVisuals(model);
    renderAccountActivity(); renderUnfinishedPlays(); renderPeriodPlayers(); renderInsight(); renderFunnel(); renderExitBreakdown();
  },
  journey: renderJourney,
  finishLoading: () => setFiltersDisabled(false),
};`), context);
const text = (id) => nodes.get(id).textContent;
const markup = (id) => nodes.get(id).innerHTML;
const base = {
  summary: { installs: 2, gamesStarted: 5, observedGames: 4, gameOvers: 3, midGameExits: 1, unobservedGames: 1, avgGameSeconds: 80, exitRate: .25 },
  accountActivity: { activeAccounts: 8, accountsWithCompletedGame: 6, completedGames: 19, zeroCompletedGameAccounts: 2, totalVisits: 12, activityAccountDays: 12, freshLaunches: 15, repeatAccounts: null, repeatRate: null, retention: [] },
  accountScope: { mode: "all_accounts", description: "전체 인증 계정 · 검색과 별도 집계" },
  analyticsCoverage: { eventRows: 20, observedPlatforms: ["android"], message: "Android 이벤트만 수집됨" },
  funnel: [{event:"first_open",users:1},{event:"game_start",users:4},{event:"game_over",users:2}],
  periodPlayers: [{ userId: "a", nickname: "account", gamesPlayed: 19 }], periodPlayerTotal: 8,
  unfinishedPlays: [{userId:"a",nickname:"missing",identityMatch:"auth_window",platformKey:"android",distributionKey:"app_store"}],
};
const render = (changes = {}) => window.ConsoleAnalytics.render({...base, ...changes});
render();
assert.equal(text("execPlayers"), "8명");
assert.equal(text("execCompleted"), "6명");
assert.match(text("execCompletedDetail"), /19판/);
assert.match(text("insightText"), /완료한 계정 6명.*19판.*2설치/);
assert.doesNotMatch(text("insightText"), /그중/);
assert.match(text("analyticsCoverageMessage"), /Android 이벤트만 수집됨/);
assert.doesNotMatch(text("analyticsCoverageMessage"), /iOS 텔레메트리 미수집/, "server coverage message must not be duplicated or broadened");
assert.match(text("execCompletionCaption"), /텔레메트리 표본 4판/);
assert.match(markup("accountActivitySummary"), /12계정·일/);
assert.match(markup("accountActivitySummary"), /15회/);
assert.match(markup("unfinishedPlaysTable"), /계정 완료 집계 대기/);
assert.doesNotMatch(markup("unfinishedPlaysTable"), /<strong>계정 완료 0판/);
assert.match(markup("unfinishedPlaysTable"), /추정 연결/);
assert.match(markup("unfinishedPlaysTable"), />AOS</);
assert.doesNotMatch(markup("unfinishedPlaysTable"), />iOS</);
for (const match of markup("funnelChart").matchAll(/width:([\d.]+)%/g)) assert.ok(Number(match[1]) <= 100);
window.ConsoleAnalytics.journey([{event:"first_open",users:1},{event:"game_start",users:4,rate:4}]);
assert.match(markup("journeyGraph"), /동일 코호트 아님/);
assert.match(markup("exitBreakdown"), /짧은 판 포함/);
const before = text("execCompleted");
render({periodPlayers: [], periodPlayerTotal: 0});
assert.equal(text("execCompleted"), before, "search/pagination must not change totals");
for (const missing of [undefined, null, {}]) {
  render({accountActivity: missing, unfinishedPlays: undefined});
  assert.equal(text("execPlayers"), "—명");
  assert.equal(text("execCompleted"), "—명");
  assert.match(text("unfinishedPlaysStatus"), /조회 실패.*집계 대기/);
  assert.doesNotMatch(markup("unfinishedPlaysTable"), /완료되지 않은 판이 없습니다/);
  assert.match(markup("accountActivitySummary"), /집계 대기/);
  assert.doesNotMatch(markup("accountActivitySummary"), />0명/);
}
for (const value of [undefined, null, "", "0"]) {
  render({unfinishedPlays:[{userId:"a",accountCompletedGameCount:value}]});
  assert.match(markup("unfinishedPlaysTable"), /계정 완료 집계 대기/);
  assert.doesNotMatch(markup("unfinishedPlaysTable"), /<strong>계정 완료 0판/);
}
render({accountActivity:{activeAccounts:0,accountsWithCompletedGame:0,completedGames:0,zeroCompletedGameAccounts:0,activityAccountDays:0,freshLaunches:0}, unfinishedPlays:[{userId:"a",accountCompletedGameCount:0}]});
assert.equal(text("execCompleted"), "0명");
assert.equal(text("execPlayers"), "0명");
assert.match(text("execCompletedDetail"), /0판/);
assert.match(markup("unfinishedPlaysTable"), /<strong>계정 완료 0판/);
render({unfinishedPlays:[]}); assert.equal(text("unfinishedPlaysStatus"), "0판");
for (const identityMatch of ["auth_window", "same_runtime_record", "record_match", "time_window"]) {
  render({unfinishedPlays:[{userId:"a",identityMatch}]});
  assert.match(markup("unfinishedPlaysTable"), /추정 연결/);
  assert.doesNotMatch(markup("unfinishedPlaysTable"), /인증 계정 확인/);
}
render({unfinishedPlays:[{userId:"a",identityMatch:"same_runtime"}]});
assert.match(markup("unfinishedPlaysTable"), /같은 앱 실행의 인증 계정 확인/);
render({accountActivity:{...base.accountActivity, activityAccountDays:null}});
assert.doesNotMatch(markup("accountActivitySummary"), /12계정·일/);
render({analyticsCoverage:{eventRows:0,observedPlatforms:[],message:"이벤트 없음"}, summary:{installs:0,observedGames:0,gameOvers:0}});
assert.equal(text("execCompleted"), "6명", "no telemetry does not erase authenticated completions");
assert.match(text("insightText"), /미수집은 사용자 없음이 아닙니다/);
for (const changes of [
  {periodPlayers:undefined}, {periodPlayers:null}, {periodPlayers:{}},
  {periodPlayerTotal:undefined}, {periodPlayerTotal:null}, {periodPlayerTotal:"0"},
]) {
  render(changes);
  window.ConsoleAnalytics.finishLoading();
  assert.match(text("periodPlayerTotal"), /조회 실패.*집계 대기/);
  assert.match(text("periodPage"), /집계 대기/);
  assert.equal(nodes.get("periodPrevious").disabled, true);
  assert.equal(nodes.get("periodNext").disabled, true);
  assert.match(markup("periodPlayersTable"), /조회 실패.*집계 대기/);
  assert.doesNotMatch(markup("periodPlayersTable"), /계정 활동 신호가 없습니다/);
}
render({periodPlayers:[],periodPlayerTotal:0});
assert.equal(text("periodPlayerTotal"), "0명", "explicit successful empty account response stays zero");
render({accountActivity:{activeAccounts:5,accountsWithCompletedGame:5,completedGames:6}, unfinishedPlays:[], analyticsCoverage:{eventRows:0,observedPlatforms:[],message:"App Store 분석 이벤트 미수집"}});
assert.equal(text("execPlayers"), "5명");
assert.equal(text("execCompleted"), "5명");
assert.match(text("execCompletedDetail"), /6판/);
assert.equal(text("unfinishedPlaysStatus"), "분석 이벤트 미수집 · 미완료 여부 판단 불가");
assert.match(markup("unfinishedPlaysTable"), /분석 이벤트 미수집 · 미완료 여부 판단 불가/);
assert.doesNotMatch(markup("unfinishedPlaysTable"), /완료되지 않은 판이 없습니다/);
for (const values of [ {latestCompletedScore:null,latestCompletedLevel:null}, {latestCompletedScore:null,latestCompletedLevel:4}, {latestCompletedScore:0,latestCompletedLevel:null} ]) {
  render({unfinishedPlays:[{userId:"a",sameInstallCompletedAfterCount:1,...values}]});
  assert.match(markup("unfinishedPlaysTable"), /완료 점수·레벨 미확인/);
  assert.doesNotMatch(markup("unfinishedPlaysTable"), /0점|Lv.0/);
}
render({unfinishedPlays:[{userId:"a",sameInstallCompletedAfterCount:1,latestCompletedScore:0,latestCompletedLevel:0}]});
assert.match(markup("unfinishedPlaysTable"), /0점 · Lv.0/, "explicit numeric zero is preserved");
for (const distributionKey of ["all", "app_store", "google_play"]) {
  render({accountScope:{mode:"observed_device_accounts",distributionKey},analyticsCoverage:{eventRows:0,observedPlatforms:[],message:"서버 수집 범위 안내"}});
  assert.doesNotMatch(text("analyticsCoverageMessage"), /iOS 텔레메트리 미수집/);
  render({accountScope:{mode:"observed_device_accounts",distributionKey},analyticsCoverage:{eventRows:0,observedPlatforms:[]}});
  if (distributionKey === "google_play") assert.doesNotMatch(text("analyticsCoverageMessage"), /iOS 텔레메트리 미수집/);
  else assert.match(text("analyticsCoverageMessage"), /iOS 텔레메트리 미수집/);
}
for (const periodReturn of [undefined, null, {}, {previousPlayers:8,returnedPlayers:null,rate:0}, {status:"unavailable_device_cohort",previousPlayers:0,returnedPlayers:0,rate:0}]) {
  render({periodReturn});
  assert.equal(text("execReturn"), "—");
  assert.equal(text("execRetentionPercent"), "—");
  assert.match(text("execReturnDetail"), /집계 대기/);
  assert.match(text("execRetentionCaption"), /집계 대기/);
  assert.doesNotMatch(text("execReturnDetail") + text("execRetentionCaption") + text("insightText"), /이전 0명|재방문율 0\.0%/);
}
render({periodReturn:{previousPlayers:8,returnedPlayers:0,rate:0}});
assert.equal(text("execReturn"), "0.0%", "known zero return rate remains valid");
assert.match(text("execReturnDetail"), /이전 8명 중 0명/);
assert.match(html, /<span>활동한 계정<\/span>/);
assert.match(html, /활동 설치<\/span>.*완료 판<\/span>/);
console.log("Console analytics consistency: real-render VM mismatch, unknown/zero, coverage, identity, denominator and funnel tests passed.");
