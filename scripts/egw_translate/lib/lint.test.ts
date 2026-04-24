import { test, expect } from "bun:test";
import { lintText, findUnresolvedBibleSentinels } from "./lint";

test("lintText prepends Đức to bare Chúa Giê-su", () => {
  expect(lintText("Chúa Giê-su đã phán.")).toBe("Đức Chúa Giê-su đã phán.");
});

test("lintText leaves Đức Chúa Giê-su untouched", () => {
  expect(lintText("Đức Chúa Giê-su đã phán.")).toBe("Đức Chúa Giê-su đã phán.");
});

test("lintText replaces stray English Jesus", () => {
  expect(lintText("then Jesus spoke")).toBe("then Đức Chúa Giê-su spoke");
});

test("lintText normalizes Sabát → Sa-bát and Cơ Đốc → Cơ-đốc", () => {
  expect(lintText("Ngày Sabát là ngày nghỉ.")).toBe("Ngày Sa-bát là ngày nghỉ.");
  expect(lintText("Cơ Đốc nhân cầu nguyện.")).toBe("Cơ-đốc nhân cầu nguyện.");
});

test("lintText capitalizes lowercase divine names", () => {
  expect(lintText("đức chúa trời đã phán.")).toBe("Đức Chúa Trời đã phán.");
  expect(lintText("kinh thánh dạy rằng...")).toBe("Kinh Thánh dạy rằng...");
});

test("findUnresolvedBibleSentinels returns empty for clean text", () => {
  expect(findUnresolvedBibleSentinels("Đức Chúa Trời đã phán.")).toEqual([]);
});

test("findUnresolvedBibleSentinels finds residual sentinels", () => {
  expect(findUnresolvedBibleSentinels("a [[BIBLE:Foo 1:1]] b [[BIBLE:Bar 2:2]]")).toEqual([
    "[[BIBLE:Foo 1:1]]",
    "[[BIBLE:Bar 2:2]]",
  ]);
});
