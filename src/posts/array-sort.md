---
title: "V8 数组排序"
author: "Simon Zünd ([@nimODota](https://twitter.com/nimODota)), consistent comparator"
date: 2020-10-28
tags:
  - ECMAScript
  - internals
  - V8
  - translate
description: "从 V8 v7.0 / Chrome 70 开始，"
ref: "https://v8.dev/blog/array-sort"
---

`Array.prototype.sort` 是 V8 引擎里面使用 JavaScript 实现的内置组件之一。在移植过程中，我们(V8)尝试了各种算法和实现策略，最终在 V8 v7.0 / Chrome 70 [成型](https://mathiasbynens.be/demo/sort-stability) 。

## 背景

在 JavaScript 进行排序是很困难的。这篇博客探讨了排序算法和 JavaScript 语言某些诡异的情况，并且描述了 V8 团队为排序选择可靠的算法的过程。

我们将最差和平均性能作为内存操作或比较次数的渐进增长一个度量范围，去比较不同的排序算法。**请注意**，动态语言（如 JavaScript），比较操作通常比内存访问的开销大一个数量级。这是因为排序时比较两个值通常会调用用户代码。

让我们看一个简单的例子，使用用户的提供的比较函数去进行一些数字的升序。当传入的两个值小于，相等或大于，比较函数返回 `-1` (或其他负值), `0`, `1`(或其他正值) 称之为 _consistent_ 否则称之为 _inconsistent_ 这会带来任意的副作用，如修改一个要排序的数组。

```js
const array = [4, 2, 5, 3, 1];

function compare(a, b) {
  // array.push(1)
  return a - b;
}

// 一个典型排序调用
array.sort(compare);
```

即便在下面的例子，也会存在调用用户代码的情况。默认的比较函数对这两个值调用 `toString` 进行字符串的字典排序

```js
const array = [4, 2, 5, 3, 1];

array.push({
  toString() {
    // array.push(1)
    return "42";
  },
});

// 不使用排序函数
array.sort();
```

### 访问器与原型链的二三事

这里我们要下规范的小船，去“实现定义”的小岛探险。规范有一个完整的条件列表，当满足这些条件时，引擎可以根据自己的判断对对象/数组进行排序，或者根本不进行排序。引擎仍需遵循一些基本规则，但仍然有许多规则尚未确定。一方面，引擎开发人员可自由试验不同的实现。另一方面，尽管规范没有规定，用户仍需一些合理的排序。让人脑壳疼的是这些“合理排序”很难去界定。

本节表明 `Array#sort` 的某些方面在引擎有很大的不同。正如上面提及的，这些极端的情况很难明确知道“正确的做法”是什么。我们**不建议**写这样的代码，引擎也不会作任何的优化。

第一个例子给出一个有访问器(getters & setters)和“call log”的数组，在不同的 JavaScript 引擎，排序结果是由编译器实现：

```js
const array = [0, 1, 2];

Object.defineProperty(array, "0", {
  get() {
    console.log("get 0");
    return 0;
  },
  set(v) {
    console.log("set 0");
  },
});

Object.defineProperty(array, "1", {
  get() {
    console.log("get 1");
    return 0;
  },
  set(v) {
    console.log("set 1");
  },
});

array.sort();
```

下面是几个引擎的输出，请注意：这里没有“正确”或“错误”的答案 - 草案让编译器自个儿决定。

```
// Chakra
get 0
get 1
set 0
set 1

// JavaScriptCore
get 0
get 1
get 0
get 0
get 1
get 1
set 0
set 1

// V8
get 0
get 0
get 1
get 1
get 1
get 0

#### SpiderMonkey
get 0
get 1
set 0
set 1
```

接下来例子展示了与原型链的交互。为了简洁，不显示调用记录。

```js
const object = {
  1: "d1",
  2: "c1",
  3: "b1",
  4: undefined,
  __proto__: {
    length: 10000,
    1: "e2",
    10: "a2",
    100: "b2",
    1000: "c2",
    2000: undefined,
    8000: "d2",
    12000: "XX",
    __proto__: {
      0: "e3",
      1: "d3",
      2: "c3",
      3: "b3",
      4: "f3",
      5: "a3",
      6: undefined,
    },
  },
};
Array.prototype.sort.call(object);
```

下面的结果是 `object` 排序后的。这里也没有正确的答案。仅仅表明了索引的属性和原型链之间的交互是多么诡异。

```js
// Chakra
[
  "a2",
  "a3",
  "b1",
  "b2",
  "c1",
  "c2",
  "d1",
  "d2",
  "e3",
  undefined,
  undefined,
  undefined,
][
  // JavaScriptCore
  ("a2", "a2", "a3", "b1", "b2", "b2", "c1", "c2", "d1", "d2", "e3", undefined)
][
  // V8
  ("a2",
  "a3",
  "b1",
  "b2",
  "c1",
  "c2",
  "d1",
  "d2",
  "e3",
  undefined,
  undefined,
  undefined)
][
  // SpiderMonkey
  ("a2",
  "a3",
  "b1",
  "b2",
  "c1",
  "c2",
  "d1",
  "d2",
  "e3",
  undefined,
  undefined,
  undefined)
];
```

### V8 在排序前后做了什么

V8 在排序有预处理和后处理的步骤。基本思想是收集所有 non-`undefined` 的值，对这些值进行排序后，将结果写入实际的数组或对象。使得 V8 不需要关心访问器或原型链的影响。

草案要求 `Array#sort` 生成的排列顺序，在概念上可以分为三部分：

1. 所有 non-`undefined` 的值根据比较函数得到的排序。
2. 所有 `undefined`
3. 所有 holes, (如不存在的属性)

实际上用到排序算法的只有第一种情况。为此，V8 的预处理大致如下：

1. 让 `length` 为数组或对象的`"length"` 属性的值。

2. 让 `numberOfUndefineds` 为 0 。

3. 遍历 `[0, length)` :

   1. 如果值为 hole: 跳过
   2. 如果值为 `undefined` ，`numberOfUndefineds` 加 1
   3. 否则添加值到一个临时列表 `elements`

经过上面的步骤，所有 non-`undefined` 的值存放在临时列表 `elements` 。所有`undefined` 的值仅计数。上述，草案要求所有 `undefined` 排序在末尾。所有`undefined` 不会传入用户提供的比较函数，因此我们仅需合计 `undefined` 的数量。

接下来是对 `elements` 排序，查看 [TimSort](#timsort)

完成排序后，排序结果会被写入原始的数组或对象。最后一步：

1. 将所有 `elements` 的值写入原始对象，范围是 `[0, elements.length)`
2. 将 `[elements.length, elements.length + numberOfUndefineds)` 范围的值设置为 `undefined`
3. 删除 `[elements.length + numberOfUndefineds, length)` 这个范围的所有值

执行步骤 3 是为了防止原始对象的排序范围内有 `holes` 。在 `[elements.length + numberOfUndefineds, length)` 的值已经移动到元素对象前面，如果不执行第三步，将会产生重复的值。

## 历史

`Array.prototype.sort` 和 `TypedArray.prototype.sort` 依赖于 JavaScript 写的快速排序。排序算法也很直接：其基础是一个快速排序，对于较小数组(length < 10)使用插入排序。插入排序同样用于快速排序的递归调用中子数组(length < 10)。插入排序对小数组非常有效。这是分区后，快速排序的递归调用两次。每一次递归调用都要创建（销毁）堆栈帧。

选择一个合适的主元元素对快速排序有很大的影响。V8 采用了两种策略：

- 为要排序的子数组选择主元是从第一个，最后一个和第三个元素的中位数。 对于较小的数组，第三个元素只是中间元素。

- 对于较大的阵列，将取样，然后进行排序，排序后的样本的中位数将用作上述计算中的第三个元素。

快速排序的优点之一是它可以就地排序。 内存开销来自对大型数组进行排序时为样本分配的小型数组以及 log(n)堆栈空间。 不利之处在于，它不是一个稳定的算法，而且该算法有可能遇到为 𝒪(n²)的最坏情况。

### V8 Torque

作为 V8 博客的读者，你可能知道 [`CodeStubAssembler`](/blog/csa) 或 CSA。CSA 是一个 V8 组件，它可以让我们用 C++ 写低级的 TurboFan IR 然后用 TurboFan's 后端转换成适用于相应体系结构的机器码。

CSA 频繁用作 JavaScript 内置函数的 “fast-paths”， 内置函数的 “fast-paths” 版本通常检查某些不变量是否成立（如：原型链上没有元素，没有访问器等）然后用更快，更具体的操作来实现内置函数。这可能导致执行时间比更通用的版本快一个数量级。

CSA 的缺点是它确实可以被视为一种汇编语言。 控制流使用显式的 `labels` 和 `gotos` 进行建模，这使得在 CSA 中实现更复杂的算法变得难以阅读且容易出错。

查看 [V8 Torque](https://v8.dev/docs/torque) 。Torque 是一门类 TypeScript 语法特定领域的语言，使用 CSA 作为唯一编译目标。Torque 被允许拥有与 CSA 相同的控制级别，同时提供了 `while` 和 `for` 循环等高级结构。此外，严格的类型，以及将来的安全检查，例如自动越界检查，为 V8 工程师提供了强有力的保障。

第一个用 V8 Torque 重写的主要内置函数是 [`TypedArray#sort`](https://v8.dev/blog/v8-release-68) 和 [`Dataview`](https://v8.dev/blog/dataview)。 目的是给与 Torque 开发者反馈该语言需要哪些功能和内置函数使用哪些习惯用语。原文撰写时，不少 `JSArray` 的内置函数自托管的后备实现已经移至 Torque (如：`Array#unshift`)，其它一些则是完全的重写(如：`Array#splice` `Array#reverse`)

### 迁移 `Array#sort` 至 Torque

`Array#sort` Torque 的初始版本或多或少来自 `JavaScript` 的实现。唯一的区别是用于主元的第三元素不是来自大型数组采样，而是随机选择。

`Array#sort` 目前表现得不错，但由于还在使用 Quicksort ，依旧不够稳定。[The request for a stable `Array#sort`](https://bugs.chromium.org/p/v8/issues/detail?id=90) 这是 V8 最老的一批 bug 追踪清单。对 Timsort 的试验为我们提供了许多东西，首先，我们喜欢它的稳定性以及不错的算法保证([查看下一节](#Timsort))。其次，Torque 仍然处于开发阶段，实现 Timsort 版本的`Array#sort` 这样复杂的内置函数会带来许多可行的反馈。

## Timsort

Timsort，最初由 Tim Peters 在 2002 为 Python 开发，可称之为自适应稳定的 Mergesort 变体。更多复杂的细节可以在[本人](https://github.com/python/cpython/blob/master/Objects/listsort.txt)或者[维基](https://en.wikipedia.org/wiki/Timsort)查看，其基础知识很容易理解。通常 Mergesort 以递归的方式运作，Timsort 则是以迭代的方式。它从左到右处理一个数组，查找称为 `runs` 的东西。 `run` 是一段简单排序过的序列。有一些序列以“错误方式”排序，它是来自 `run` 反转而形成的一个序列。 在分选过程开始时，将确定最小输入长度，该长度取决于输入的长度。 如果 Timsort 无法从`natural runs`找到具有此最小长度的`run`，则使用“插入排序”来“人为地”生成 `run`。

使用一个栈去追踪找到的 `Runs` ，它会记住开始的索引和每个 `run` 的长度。有时 `runs` 会合并在一起，直到剩下一个已排序的 `run` 。Timsort 尝试保持何时合并的一个平衡。一方面，你想尽早地尝试合并，因为这些 `runs` 的数据很可能被缓存起来，另一方面，晚点合并可以从数据的某些特征获取便利。为此，Timsort 遵循两个原则。假设 `A`, `B`, `C` 是三个最高的 `runs`：

- `|C| > |B| + |A|`
- `|B| > |A|`

![Runs stack before and after merging `A` 和 `B`](https://v8.dev/_img/array-sort/runs-stack.svg)

上图表明当 `|A| > |B|` 时，`|B|` 会被合并到 `|A|` 和 `|C|` 中较小的一个。

请注意，Timsort 仅合并连续的 `runs`， 这是维持算法稳定性所必需的，否则相同的元素会在 `runs` 中转移。第一个原则确保了 `run` 的长度增长至少有 `Fibonacci` 那么快，当我们知道数组的最大长度，便可给出 `run` 栈的最大边界。

目前可知的是已排序的序列在 𝒪(n) 时间完成排序，对于这样的数组只会产生一个 `run` ，以此不需要合并。最糟糕的情况是 𝒪(n log n) 。`Timsort` 天然的稳定性，成为了我们选择它而不是 `Quicksort` 的理由之一。

### 在 Torque 中实现 Timsort

执行内置函数时会根据不同的变量选择不同的代码路径。最通用的版本是可以处理任何对象，无论这个对象 “ JSProxy” 是否具有拦截器或者在检索，设置属性时需要进行原型链查找。

在大多数情况下，通用路径相当慢，因为它需要考虑所有可能的情况。 但是，如果我们预先知道要排序的对象是仅包含 Smis 的简单`JSArray`，那么昂贵的`[[Get]]`和`[[Set]]`操作都可以由简单的 Loads 和 Stores 替换为` FixedArray`。它们的主要区别是 [元素类型](https://v8.dev/blog/elements-kinds) 。

目前问题是如何实现快速路径。 除了基于 `ElementsKind` 改变我们访问元素的方式之外，其余核心算法均保持不变。 一种我们可以做到的方法是在每个`call-site` 上分派到正确的“accessor”。 想象一下每个“加载”/“存储”都有一个`switch`，我们通过`switch`来选择不同快速路径的分支。

另一个解决方案（这是尝试的第一种方法）是仅对每个快速路径复制一次整个内置函数，并内联正确的加载/存储访问方法。 事实证明，这种方法对于 Timsort 来说是行不通的，因为它是一个大型内置程序，而为每个快速路径制作一个副本总共需要 106 KB，这对内置函数来说代价太高了。

最终的解决方案略有不同。 每个快速路径的每个加载/存储操作都放入其自己的“ mini-builtin”中。 请参见代码示例，该示例显示了针对` FixedDoubleArray`的“加载”操作。

```torque
Load<FastDoubleElements>(
    context: Context, sortState: FixedArray, elements: HeapObject,
    index: Smi): Object {
  try {
    const elems: FixedDoubleArray = UnsafeCast<FixedDoubleArray>(elements);
    const value: float64 =
        LoadDoubleWithHoleCheck(elems, index) otherwise Bailout;
    return AllocateHeapNumberWithValue(value);
  }
  label Bailout {
    // The pre-processing step removed all holes by compacting all elements
    // at the start of the array. Finding a hole means the cmp function or
    // ToString changes the array.
    return Failure(sortState);
  }
}
```

相比之下，最通用的“加载”操作只是对“ GetProperty”的调用。 但是，尽管上述版本能够生成高效且快速的机器代码来加载和转换 `Number`，但是`GetProperty`是对另一个内置函数的调用，这将会涉及原型链查找或调用访问器函数。

```js
builtin Load<ElementsAccessor : type>(
    context: Context, sortState: FixedArray, elements: HeapObject,
    index: Smi): Object {
  return GetProperty(context, elements, index);
}
```

快速路径最终变成了一组函数指针。 给所有相关的快速路径设置函数指针，意味着核心算法只需要一个副本。 虽然这大大减少了所需的代码空间（减少到 20k），但是却以每个访问点上的间接分支为代价。 最近使用[embedded Builtins](https://v8.dev/blog/embedded-builtins)的更改甚至加剧了这种情况。

### 排序状态

![](https://v8.dev/_img/array-sort/sort-state.svg)

上图显示的“排序状态”是 `FixedArray` 在排序时所需的东西。每次调用 `Array#sort` ，将分配这样的排序状态。第 4 到 7 步是上节讨论的快速路径形成的一组函数指针。

每次返回用户的 JavaScript 代码都会调用内置函数 `check` ，来检查我们是否还在使用快速路径。检查的是 “initial receiver map” 和 “initial receiver length” 。如果用户的代码（如：比较函数）修改了原始对象，我们只能放弃当前的排序，并重置所有的指针到通用版本然后重新排序。插槽 8 的 “bailout status” 是重置的信号。

“compare” 的入口可以指向两个不同的内置函数。一个是调用用户提供的比较函数，另一个则是默认的比较函数，调用 `toString` 进行字典比较。

其余字段（除了快速路径的 ID）都是 Timsort 特有的。`run` 的执行栈初始长度是 85，这对 2<sup>64</sup> 的数组来说足够的了。尽管用于合并 `runs` 的临时数组会根据需要增长，但绝不超过 `n/2` （ `n` 是输入数组的长度）。

### 性能权衡

将排序从自托管的 JavaScript 迁移到 Torque 需要权衡性能。 现在用 Torque 编写的 `Array＃sort` 是一段静态编译的代码，这意味着我们仍然可以为某些 [`ElementsKind's`](https://v8.dev/blog/elements-kinds) 建立快速路径，但永远不会与高度优化的，可以利用类型反馈的 TurboFan 版本一样快。 另一方面，如果代码的质量不足以保证 JIT 编译或超大型的 `call-site` ，则我们将使用解释器或慢速/通用版本。 自托管 JavaScript 版本的解析，编译和可能的优化也是一种开销，不需要 Torque 去实现。

尽管用 Torque 的方法无法为排序获得相同的最佳性能，但是避免了性能下降。 结果是排序性能比以前更加可预测。 请记住，Torque 的变化很大，除了针对 CSA 之外，它将来可能还会针对 TurboFan，从而允许 JIT 编译用 Torque 编写的代码。

### 微基准

在开始实现 `Array#sort` 之前，我们添加了许多不同的微基准来更好地了解重新实现的影响。 第一张图显示了使用用户提供的比较功能对各种 ElementsKind 进行排序的“正常”用例。

请记住，在这种情况下，JIT 编译器可以完成很多工作，因为排序几乎是我们要做的。 这也使优化的编译器可以内联 JavaScript 版本的比较函数，而在 Torque 情况下，我们需要从内置调用 JavaScript 的调用开销。 尽管如此，我们几乎在所有情况下都表现更好。

![](https://v8.dev/_img/array-sort/micro-bench-basic.svg)

下一张图表显示了 Timsort 在处理已完全排序的数组或具有已单向或另一排序的子序列的数组时的影响。 该图表以 Quicksort 为基准，并显示了 Timsort 的加速（在“ DownDown”情况下，数组由两个反向排序的序列组成，则达到 17 倍）。 可以看出，在随机数据的情况下，即使我们正在对`PACKED_SMI_ELEMENTS` 进行排序，Timsort 在所有其他情况下都表现更好，其中 Quicksort 在上面的微基准测试中胜过 Timsort。

![](https://v8.dev/_img/array-sort/micro-bench-presorted.svg)

### Web 工具基准

[Web 工具基准](https://github.com/v8/web-tooling-benchmark) 是 Web 开发人员通常使用的工具工作负载的集合，例如 Babel 和 TypeScript。 该图表使用 JavaScript Quicksort 作为基线，并比较了 Timsort 的提速情况。 在几乎所有基准测试中，除 chai 之外，我们都保持相同的性能。

![](https://v8.dev/_img/array-sort/web-tooling-benchmark.svg)

chai 基准测试将其三分之一的时间花费在单个比较函数（字符串距离计算）中。 基准是 chai 本身的测试套件。 由于数据的原因，在这种情况下，Timsort 需要进行更多的比较，这会对整体运行时间产生更大的影响，因为在特定的比较函数中花费了很大一部分时间。

### 内存的影响

在浏览约 50 个网站（在移动和台式机上）时分析 V8 堆快照均未显示任何内存退化或改进。 一方面，这令人惊讶：从 Quicksort 切换到 Timsort 引入了对合并运行的临时阵列的需求，该阵列可能会比用于采样的临时阵列更大。 另一方面，这些临时数组的寿命很短（仅在“ sort”调用期间），可以在 V8 的新空间中快速分配和丢弃。

## 结论

总而言之，我们对使用 Torque 实现的 Timsort 的算法特性和可预测的性能行为感觉更好。 Timsort 从 V8 v7.0 和 Chrome 70 开始可用。排序愉快！
