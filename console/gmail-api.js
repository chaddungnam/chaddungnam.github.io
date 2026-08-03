(function attachGmailApi(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GmailAPI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGmailApi(root) {
  const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me/";
  const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
  const LABEL_NAMES = {
    status: {
      new: "House Duck/CS/New",
      needs_reply: "House Duck/CS/Needs Reply",
      waiting_customer: "House Duck/CS/Waiting Customer",
      done: "House Duck/CS/Done",
    },
    category: {
      billing: "House Duck/CS/Billing",
      account: "House Duck/CS/Account",
      bug: "House Duck/CS/Bug",
      other: "House Duck/CS/Other",
    },
  };
  let oauthToken = "";
  let expiresAt = 0;
  let tokenClient = null;
  let pendingAuthorization = null;
  let labelIds = null;
  let failedDraft = null;

  function supportSearchQuery(query) {
    const term = String(query || "").trim().slice(0, 200).replace(/["\\]/g, " ").replace(/\s+/g, " ");
    return `to:support@houseduck.in${term ? ` "${term}"` : ""}`;
  }

  function buildGmailRequest(token, segments, { method = "GET", query = {}, body } = {}) {
    if (!token || !Array.isArray(segments) || segments.length === 0) throw new Error("invalid_gmail_request");
    const url = new URL(segments.map((segment) => encodeURIComponent(String(segment))).join("/"), API_BASE);
    for (const [key, rawValue] of Object.entries(query || {})) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (let value of values) {
        if (value == null || value === "") continue;
        if (key === "maxResults") value = Math.min(50, Math.max(1, Number(value) || 20));
        url.searchParams.append(key, String(value));
      }
    }
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const options = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    return { url: url.toString(), options };
  }

  function clearToken() {
    oauthToken = "";
    expiresAt = 0;
    labelIds = null;
  }

  function initialize({ clientId }) {
    if (!clientId || !root.google?.accounts?.oauth2) return false;
    tokenClient = root.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: (response) => {
        const pending = pendingAuthorization;
        pendingAuthorization = null;
        if (!pending) return;
        if (!response?.access_token) {
          clearToken();
          pending.reject(new Error(response?.error || "gmail_authorization_failed"));
          return;
        }
        oauthToken = response.access_token;
        expiresAt = Date.now() + Math.max(60, Number(response.expires_in || 3600) - 60) * 1000;
        pending.resolve(true);
      },
      error_callback: () => {
        const pending = pendingAuthorization;
        pendingAuthorization = null;
        clearToken();
        pending?.reject(new Error("gmail_authorization_failed"));
      },
    });
    return true;
  }

  function isAuthorized() {
    return Boolean(oauthToken && expiresAt > Date.now());
  }

  function authorize() {
    if (isAuthorized()) return Promise.resolve(true);
    if (!tokenClient) return Promise.reject(new Error("gmail_client_unavailable"));
    if (pendingAuthorization) return pendingAuthorization.promise;
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pendingAuthorization = { promise, resolve, reject };
    tokenClient.requestAccessToken({ prompt: "consent" });
    return promise;
  }

  function disconnect() {
    const token = oauthToken;
    clearToken();
    failedDraft = null;
    if (token && root.google?.accounts?.oauth2?.revoke) root.google.accounts.oauth2.revoke(token, () => {});
  }

  async function request(segments, options) {
    if (!isAuthorized()) throw new Error("gmail_reconnect_required");
    const shape = buildGmailRequest(oauthToken, segments, options);
    const response = await fetch(shape.url, shape.options);
    if (response.status === 401) {
      clearToken();
      throw new Error("gmail_reconnect_required");
    }
    if (!response.ok) throw Object.assign(new Error("gmail_request_failed"), { status: response.status });
    return response.status === 204 ? {} : response.json();
  }

  async function ensureCsLabels() {
    if (labelIds) return labelIds;
    const existing = await request(["labels"]);
    const byName = new Map((existing.labels || []).map((label) => [label.name, label.id]));
    const result = { status: {}, category: {} };
    for (const group of ["status", "category"]) {
      for (const [key, name] of Object.entries(LABEL_NAMES[group])) {
        let id = byName.get(name);
        if (!id) {
          const created = await request(["labels"], {
            method: "POST",
            body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
          });
          id = created.id;
        }
        result[group][key] = id;
      }
    }
    labelIds = result;
    return result;
  }

  async function listSupportThreads({ query = "", labelIds: filters = [], pageToken = "", unread = false, newerThanDays = 0 } = {}) {
    const gmailQuery = [
      supportSearchQuery(query),
      unread ? "is:unread" : "",
      newerThanDays ? `newer_than:${Math.min(365, Math.max(1, Number(newerThanDays)))}d` : "",
    ].filter(Boolean).join(" ");
    return request(["threads"], {
      query: { q: gmailQuery, labelIds: filters, pageToken, maxResults: 20 },
    });
  }

  function getThread(threadId) {
    return request(["threads", threadId], { query: { format: "full" } });
  }

  function getThreadSummary(threadId) {
    return request(["threads", threadId], {
      query: { format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] },
    });
  }

  async function setThreadStatus(threadId, status, category = "", knownLabelIds = null) {
    const labels = await ensureCsLabels();
    if (!labels.status[status] || (category && !labels.category[category])) throw new Error("invalid_cs_label");
    const thread = knownLabelIds ? null : await getThread(threadId);
    const current = [...new Set(knownLabelIds || (thread.messages || []).flatMap((message) => message.labelIds || []))];
    const statusChange = root.GmailModel.nextStatusLabels(current, labels.status[status], Object.values(labels.status));
    const categoryChange = category
      ? root.GmailModel.nextStatusLabels(current, labels.category[category], Object.values(labels.category))
      : { addLabelIds: [], removeLabelIds: [] };
    const addLabelIds = [...new Set([...statusChange.addLabelIds, ...categoryChange.addLabelIds])];
    const removeLabelIds = [...new Set([...statusChange.removeLabelIds, ...categoryChange.removeLabelIds])];
    if (status === "done") removeLabelIds.push("INBOX");
    else if (!current.includes("INBOX")) addLabelIds.push("INBOX");
    return request(["threads", threadId, "modify"], { method: "POST", body: { addLabelIds, removeLabelIds } });
  }

  function getAttachment(messageId, attachmentId) {
    return request(["messages", messageId, "attachments", attachmentId]);
  }

  async function sendReply(reply) {
    const thread = await getThread(reply.threadId);
    const latest = [...(thread.messages || [])].sort((left, right) => Number(right.internalDate || 0) - Number(left.internalDate || 0))[0];
    const headers = latest?.payload?.headers || [];
    const messageId = root.GmailModel.headerValue(headers, "Message-ID");
    const references = [root.GmailModel.headerValue(headers, "References"), messageId].filter(Boolean).join(" ");
    const raw = root.GmailModel.buildReplyRaw({ ...reply, inReplyTo: messageId, references });
    let sent;
    try {
      sent = await request(["messages", "send"], { method: "POST", body: { raw, threadId: reply.threadId } });
    } catch (error) {
      failedDraft = reply;
      if (error?.status === 400 || error?.status === 403) throw new Error("gmail_send_rejected");
      throw error;
    }
    failedDraft = null;
    let statusUpdated = true;
    try {
      await setThreadStatus(reply.threadId, "waiting_customer", reply.category || "");
    } catch (_error) {
      statusUpdated = false;
    }
    return { sent, statusUpdated };
  }

  function getFailedDraft() {
    return failedDraft;
  }

  return {
    initialize,
    authorize,
    disconnect,
    isAuthorized,
    ensureCsLabels,
    listSupportThreads,
    getThread,
    getThreadSummary,
    setThreadStatus,
    getAttachment,
    sendReply,
    getFailedDraft,
    buildGmailRequest,
    supportSearchQuery,
  };
});
