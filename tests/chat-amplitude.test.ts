import assert from "node:assert/strict";
import { test } from "node:test";
import { createReplayAnalytics, replaySampleRate, type ReplayAnalytics } from "../src/lib/amplitude";

const userA = "11111111-2222-4333-8444-555555555555";
const userB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function sdk(storedUser?: string) {
  let userId = storedUser;
  let device = 0;
  let session = 100;
  const events: { name: string; properties: Record<string, string>; userId?: string; device: number; session: number }[] = [];
  const client: ReplayAnalytics = {
    getUserId: () => userId,
    setUserId: (id) => { userId = id; },
    reset: () => { userId = undefined; device++; },
    getSessionId: () => session,
    setSessionId: (id) => { session = id; },
    track: (name, properties) => { events.push({ name, properties, userId, device, session }); },
  };
  return { client, events };
}

test("one initialization and one page event survive repeated Strict Mode effects", async () => {
  const { client, events } = sdk();
  let loads = 0;
  const analytics = createReplayAnalytics(async () => { loads++; return client; });
  await Promise.all([analytics.pageView("/chat", "web"), analytics.pageView("/chat", "web")]);
  assert.equal(loads, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "web_page_viewed");
  assert.deepEqual(events[0].properties, { path: "/chat", entry_point: "web" });
  assert.equal(events[0].userId, undefined);
  await analytics.pageView("/", "web");
  await analytics.pageView("/chat", "web");
  assert.equal(events.length, 3);
});

test("verified app identity is retained even when it arrives before the SDK", async () => {
  const { client, events } = sdk();
  let resolve!: (value: ReplayAnalytics) => void;
  const analytics = createReplayAnalytics(() => new Promise((done) => { resolve = done; }));
  const loading = analytics.pageView("/chat", "app");
  analytics.setAppUser(userA);
  analytics.setAppUser(userB);
  resolve(client);
  await loading;
  assert.equal(events.length, 2);
  assert.ok(events.every((event) => event.userId === userB));
  assert.equal(events[0].name, "web_identity_changed");
  assert.equal(events[1].properties.entry_point, "app");
});

test("late app identification links the current anonymous replay without resetting it", async () => {
  const { client, events } = sdk();
  const analytics = createReplayAnalytics(async () => client);
  await analytics.pageView("/chat", "app");
  analytics.setAppUser(userA);
  analytics.setAppUser(userA);
  assert.equal(events.length, 2);
  assert.equal(events[0].userId, undefined);
  assert.equal(events[1].userId, userA);
  assert.equal(events[0].device, events[1].device);
  assert.equal(events[0].session, events[1].session);
});

test("an unverified stored account is removed before any new event", async () => {
  const { client, events } = sdk(userA);
  const analytics = createReplayAnalytics(async () => client, () => 200);
  await analytics.pageView("/chat", "web");
  assert.ok(events.every((event) => event.userId === undefined && event.device === 1 && event.session === 200));
});

test("logout and account switching separate the device and replay session", async () => {
  const { client, events } = sdk(userA);
  const analytics = createReplayAnalytics(async () => client, () => 100);
  analytics.setAppUser(userA);
  await analytics.pageView("/chat", "app");
  analytics.setAppUser(userB);
  analytics.setAppUser(null);
  assert.deepEqual(events.map(({ userId, device, session }) => ({ userId, device, session })), [
    { userId: userA, device: 0, session: 100 },
    { userId: userB, device: 1, session: 101 },
    { userId: undefined, device: 2, session: 102 },
  ]);
  assert.deepEqual(events[2].properties, { identity: "anonymous" });
});

test("SDK failures never reject navigation or app identity updates", async () => {
  const analytics = createReplayAnalytics(async () => { throw new Error("blocked"); });
  analytics.setAppUser(userA);
  await analytics.pageView("/chat", "app");
  analytics.setAppUser(null);
  await analytics.pageView("/", "web");
  const { client } = sdk();
  client.track = () => { throw new Error("blocked"); };
  const broken = createReplayAnalytics(async () => client);
  await broken.pageView("/chat", "web");
  broken.setAppUser(userA);
});

test("replay sampling accepts zero, fractions and one with a usable default", () => {
  assert.equal(replaySampleRate("0"), 0);
  assert.equal(replaySampleRate("0.25"), 0.25);
  for (const value of [undefined, "", " ", "NaN", "Infinity", "2", "-1", "1"]) {
    assert.equal(replaySampleRate(value), 1);
  }
});
