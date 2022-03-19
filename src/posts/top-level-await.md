---
title: "顶层 `await`"
author: "Myles Borins ([@MylesBorins](https://twitter.com/MylesBorins))"
date: 2021-08-08
tags:
  - ECMAScript
  - Node.js 14
  - translate
description: "顶层 `await` 即将出现在 JavaScript 模块中！你很快就可以使用 `await` 而无需在异步函数中。"
ref: "https://v8.dev/features/top-level-await"
---

[顶层 `await`](https://github.com/tc39/proposal-top-level-await) 使得开发者能够在异步函数之外使用 `await` 关键字。它就像一个大的异步函数，导致其它模块在执行它们的主体之前等待它的导入。

## 旧的行为

首次引入 async/await 时，尝试在 async 函数之外使用 await 会导致 SyntaxError。 许多开发人员利用立即调用的异步函数表达式作为访问该功能的一种方式。

```js
await Promise.resolve(console.log("🎉"));
// → SyntaxError: await is only valid in async function

(async function () {
  await Promise.resolve(console.log("🎉"));
  // → 🎉
})();
```

## 新的行为

使用顶层 await，上面的代码会在[模块](https://v8.dev/features/modules)中按照您期望的方式工作：

```js
await Promise.resolve(console.log("🎉"));
// → 🎉
```

> 注意：顶层 await 仅适用于模块的顶层。 不支持传统脚本或非异步函数。

## 用例

这些用例是从[规范提案存储库](https://github.com/tc39/proposal-top-level-await#use-cases)中借用的。

## 动态依赖路径

```js
const strings = await import(`/i18n/${navigator.language}`);
```

这允许模块使用运行时值来确定依赖关系。 这对于开发/生产拆分、国际化、环境拆分等非常有用。

## 资源初始化

```js
const connection = await dbConnector();
```

这允许模块表示资源，并在模块无法使用的情况下产生错误。

## 依赖回退

下面的示例尝试从 CDN A 加载 JavaScript 库，如果失败则回退到 CDN B：

```js
let jQuery;
try {
  jQuery = await import("https://cdn-a.example.com/jQuery");
} catch {
  jQuery = await import("https://cdn-b.example.com/jQuery");
}
```

## 模块执行顺序

顶层 `await`对 JavaScript 带来最大的更改之一是图中模块的执行顺序。 JavaScript 引擎以[后序遍历](https://en.wikibooks.org/wiki/A-level_Computing/AQA/Paper_1/Fundamentals_of_algorithms/Tree_traversal#Post-order)方式执行模块：从模块图的最左侧子树开始，执行模块，导出它们的绑定，执行它们的相邻模块，然后是它们的父模块。该算法递归运行，直到模块树的根。

在顶层 await 出现之前，执行顺序始终是同步且确定的：代码的多次运行，代码树的执行顺序都得以保证。即使顶层 `await` 的出现，也会保证这样的执行顺序，但前提是不使用顶层`await`。

以下是在模块中使用顶层 `await` 时发生的情况：

1. 当前模块的执行会等到 `await` 的 promise 是 resolved 的状态。
2. 父模块的执行被推迟到调用 await 的子模块及其所有兄弟模块导出绑定。
3. 兄弟模块和父模块的兄弟模块能够以相同的同步顺序继续执行——假设树中没有循环或其他`await` 的 promises。
4. 调用 `await` 的模块会在`promise` 的 resolve 后恢复执行。
5. 只要没有其他`await` 的 promises，父模块和后续树就会继续以同步顺序执行。

## 这不是已经在 DevTools 中工作了吗？

确实如此！ [Chrome DevTools](https://developers.google.com/web/updates/2017/08/devtools-release-notes#await), [Node.js](https://github.com/nodejs/node/issues/13209) 和 Safari Web Inspector 中的 REPL 支持顶层`await`已经有一段时间了。 但是，此功能是非标准的，仅限于 REPL！ 它不同于顶层的 `await` 提议，后者是语言规范的一部分并且仅适用于模块。 要以完全匹配规范提案语义的方式测试依赖于顶层 `await` 的生产代码，请确保在您的实际应用程序中进行测试，而不仅仅是在 DevTools 或 Node.js REPL 中！

## Isn’t top-level await a footgun?

也许您已经看过 [Rich Harris](https://twitter.com/Rich_Harris) 的臭名昭著的[要点](https://gist.github.com/Rich-Harris/0b6f317657f5167663b493c722647221) ，它最初概述了一些对顶层 `await` 的担忧，并敦促 JavaScript 语言不要实现该功能。一些具体的担忧是：

- 顶级 await 可能会阻止执行。
- 顶级 await 可能会阻止获取资源。
- CommonJS 模块没有明确的互操作故事。

该提案的第 3 阶段版本直接解决了这些问题：

- 由于兄弟姐妹能够执行，因此没有明确的阻塞。
- 顶层 `await` 发生在模块树的执行阶段。此时，所有资源都已被获取并链接。没有阻止获取资源的风险。
- 顶级 await 仅限于模块。明确不支持脚本或 CommonJS 模块。
- 与任何新的语言功能一样，总是存在意外行为的风险。例如，对于顶层 `await`，循环模块依赖可能会导致死锁。

如果没有顶级 await，JavaScript 开发人员通常会使用异步立即调用函数表达式来访问 await。不幸的是，这种模式导致图执行的确定性和应用程序的静态可分析性降低。由于这些原因，缺乏顶层 `await` 被视为比该功能引入的危害更高的风险。

## 支持顶级 `await`

- [chrome](https://bugs.chromium.org/p/v8/issues/detail?id=9344)
- [firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=1519100)
- [safari](https://bugs.webkit.org/show_bug.cgi?id=202484)
- [babel](https://github.com/babel/proposals/issues/44)
- node 14
