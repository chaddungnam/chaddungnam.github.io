const assert = require("node:assert/strict");
const model = require("../console/gmail-model.js");
const gmailApi = require("../console/gmail-api.js");

const data = (value) => Buffer.from(value, "utf8").toString("base64url");
const plainPayload = { mimeType: "text/plain", body: { data: data("게임이 실행되지 않아요.") } };
const htmlPayload = { mimeType: "text/html", body: { data: data('<p>결제가 안 돼요.</p><script>alert(1)</script><img src="https://track.example/x">') } };
const multipartPayload = {
  mimeType: "multipart/mixed",
  parts: [
    { mimeType: "text/plain", body: { data: data("스크린샷을 첨부합니다.") } },
    { mimeType: "image/png", filename: "screen.png", body: { attachmentId: "att-1", size: 1200 } },
  ],
};
const nestedPayload = {
  mimeType: "multipart/mixed",
  parts: [{ mimeType: "multipart/alternative", parts: [htmlPayload, plainPayload] }],
};

assert.equal(model.extractMessageText(plainPayload), "게임이 실행되지 않아요.");
assert.equal(model.extractMessageText(nestedPayload), "게임이 실행되지 않아요.");
assert.doesNotMatch(model.extractMessageText(htmlPayload), /<script|<img|alert\(1\)/i);
assert.match(model.extractMessageText(htmlPayload), /결제가 안 돼요/);
assert.equal(model.extractMessageText({ mimeType: "text/plain", body: { data: "%%%" } }), "");
assert.deepEqual(model.listAttachments(multipartPayload), [{
  filename: "screen.png",
  mimeType: "image/png",
  size: 1200,
  attachmentId: "att-1",
}]);
assert.equal(model.headerValue([{ name: "Subject", value: "Help" }], "subject"), "Help");

const raw = model.buildReplyRaw({
  from: "support@houseduck.in",
  to: "player@example.com",
  subject: "Re: 도움이 필요합니다",
  body: "안녕하세요. 확인했습니다.",
  inReplyTo: "<message-1@example.com>",
  references: "<root@example.com> <message-1@example.com>",
  attachments: [{ filename: "guide.txt", mimeType: "text/plain", bytes: new TextEncoder().encode("안내") }],
});
const decodedRaw = Buffer.from(raw, "base64url").toString("utf8");
assert.match(decodedRaw, /From: support@houseduck\.in\r\n/);
assert.match(decodedRaw, /To: player@example\.com\r\n/);
assert.match(decodedRaw, /In-Reply-To: <message-1@example\.com>/);
assert.match(decodedRaw, /References: <root@example\.com> <message-1@example\.com>/);
assert.match(decodedRaw, /multipart\/mixed/);
assert.match(decodedRaw, /안녕하세요\. 확인했습니다\./);
assert.match(decodedRaw, /guide\.txt/);
assert.throws(() => model.buildReplyRaw({ from: "support@houseduck.in\r\nBcc: x@y.z", to: "player@example.com", subject: "x", body: "x" }), /invalid_header/);
assert.throws(() => model.buildReplyRaw({ from: "support@houseduck.in", to: "player@example.com", subject: "x", body: "x", attachments: [{ filename: "big", mimeType: "x", bytes: new Uint8Array(10 * 1024 * 1024 + 1) }] }), /attachment_too_large/);

assert.deepEqual(model.nextStatusLabels(["status-new", "category-bug", "STARRED"], "status-done", ["status-new", "status-reply", "status-wait", "status-done"]), {
  addLabelIds: ["status-done"],
  removeLabelIds: ["status-new"],
});
assert.equal(model.extractDisplayCode("제 코드는 pABCDEFGHJK 입니다."), "pABCDEFGHJK");
assert.equal(model.extractDisplayCode("UID 11111111-1111-4111-8111-111111111111"), "");

const request = gmailApi.buildGmailRequest("memory-token", ["threads", "a/b"], {
  query: { maxResults: 100, q: gmailApi.supportSearchQuery("결제") },
});
assert.equal(request.url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/"), true);
assert.match(request.url, /threads\/a%2Fb/);
assert.match(request.url, /maxResults=50/);
assert.match(decodeURIComponent(request.url), /to:support@houseduck\.in/);
assert.equal(request.url.includes("memory-token"), false);
assert.equal(request.options.headers.Authorization, "Bearer memory-token");
assert.equal(gmailApi.supportSearchQuery(""), "to:support@houseduck.in");

console.log("gmail model: PASS");
