const assert = require("node:assert/strict");
const model = require("../console/model.js");

assert.deepEqual(model.routeFromHash("#/analytics"), { page: "analytics" });
assert.deepEqual(model.routeFromHash("#/players/abc%20123"), { page: "player", userId: "abc 123" });
assert.deepEqual(model.routeFromHash("#/players/"), { page: "players" });
assert.deepEqual(model.routeFromHash("#/unknown"), { page: "analytics" });

const players = model.dedupePlayers([
  { userId: "1", nickname: "Duck" },
  { userId: "1", nickname: "Duplicate" },
  { userId: "2", nickname: "Duck" },
]);
assert.deepEqual(players.map((player) => player.userId), ["1", "2"]);
assert.equal(players[0].nickname, "Duck");
assert.equal(model.playerDisplayName({ nickname: "Duck", displayCode: "AB12" }), "Duck · AB12");
assert.equal(model.playerDisplayName({ nickname: "Duck", displayCode: "" }), "Duck");
assert.equal(model.playerDisplayName({ nickname: "", displayCode: "AB12" }), "이름 없음 · AB12");

console.log("console model: PASS");
