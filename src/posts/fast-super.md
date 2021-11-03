---
title: "`super` 属性的快速访问"
author: "[Marja Hölttä](https://twitter.com/marjakh), super optimizer"
date: 2021-02-18
tags:
  - JavaScript
description: "Faster super property access in V8 v9.0"
ref: "https://v8.dev.blog/fast-super"
---

[`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super) 关键字能够用来访问父对象的属性和函数

以前，访问 super 属性（如 super.x）是通过运行时调用实现的。 从 V8 v9.0 开始，我们在非优化代码中重用[内联缓存（IC）系统](https://mathiasbynens.be/notes/shapes-ics)，生成合适的优化代码用于超级属性访问，无需跳转到运行时。

如下图所示，由于运行时调用，超级属性访问过去比普通属性访问慢一个数量级。现在已经相差无几。

![Compare super property access to regular property access, optimized](https://v8.dev/_img/fast-super/super-opt.svg)

![Compare super property access to regular property access, unoptimized](https://v8.dev/_img/fast-super/super-no-opt.svg)

超级属性访问很难进行基准测试，因为它必须发生在函数内部。 我们不能对单个属性访问进行基准测试，而只能对更大的工作块进行基准测试。 因此，函数调用开销包含在测量中。 上图有点低估了超级属性访问和普通属性访问之间的差异，但它们足以说明新旧超级属性访问之间的差异。

在未优化（解释）模式下，超级属性访问总是比普通属性访问慢，因为我们需要做更多的加载（从上下文中读取 home 对象并从 home 对象中读取 `__proto__` ）。 在优化的代码中，我们已经尽可能将 home 对象嵌入为常量。 这也可以通过将其 `__proto__` 嵌入为常量来进一步改进。

### Prototypal inheritance and `super`

让我们从基础开始 - 超级属性访问甚至意味着什么？

```js
class A {}
A.prototype.x = 100;

class B extends A {
  m() {
    return super.x;
  }
}

const b = new B();
b.m();
```

现在 A 是 B 的超类，如你所见，b.m() 返回 100。

![Class inheritance diagram](https://v8.dev/_img/fast-super/inheritance-1.svg?width=100)

实际上，[JavaScript 的原型继承](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain) 更加复杂：

![Prototypal inheritance diagram](https://v8.dev/_img/fast-super/inheritance-2.svg?width=435)

我们需要仔细区分 `__proto__` 和 `prototype` 属性，它们不是一个东西，为了更加混乱，`b.__proto__` 通常被称为 `b` 的原型。

`b.__proto__` 是 `b` 从中继承属性的对象。`B.prototype` 是使用 `new B()` 创建的对象的`__proto__`对象，即`b.__proto__ === B.prototype`。

同理，`B.prototype` 有它自己的`__proto__`属性，它等于`A.prototype`。这就是所谓的原型链：

```
b ->
 b.__proto__ === B.prototype ->
  B.prototype.__proto__ === A.prototype ->
   A.prototype.__proto__ === Object.prototype ->
    Object.prototype.__proto__ === null
```

通过这个链，`b` 可以访问任何这些对象中定义的所有属性。 方法 `m` 是 `B.prototype` —— `B.prototype.m` 的一个属性 —— 这就是 `b.m()` 成立的原因。

现在我们可以在 `m` 中定义 `super.x` 作为属性查找，我们开始在 _home 对象的_ `__proto__` 中查找属性 `x`，并沿着原型链向上走直到找到它。

home 对象是定义方法的对象 - 在这种情况下，`m` 的 home 对象是 `B.prototype`。 它的 `__proto__` 是 `A.prototype`，所以我们开始寻找属性 `x`。 我们将`A.prototype`称为*查找起始对象*。 在这种情况下，我们会立即在查找起始对象中找到属性“x”，但通常它也可能位于原型链的更远位置。

如果 `B.prototype` 有一个名为 `x` 的属性，我们会忽略它，因为我们开始在原型链中寻找它。 此外，在这种情况下，超级属性查找不依赖于 _receiver_ - 调用方法时作为 `this` 值的对象。

```javascript
B.prototype.m.call(some_other_object); // still returns 100
```

如果该属性有一个 getter，则接收器将作为 `this` 值传递给 getter。

总结一下：在超级属性访问中，`super.x`，查找起始对象是 home 对象的`__proto__`，接收者是发生超级属性访问的方法的接收者。

在正常的属性访问中，`o.x`，我们开始在 `o` 中查找属性 `x` 并沿着原型链向上走。 如果`x` 碰巧有一个 getter，我们也将使用`o` 作为接收器——查找起始对象和接收器是同一个对象（`o`）。

_超级属性访问就像常规属性访问一样，其中查找起始对象和接收者是不同的。_

### 实现更快的 `super`

以上实现也是实现快速超级属性访问的关键。 V8 已经被设计成可以快速访问属性——现在我们将它概括为接收器和查找起始对象不同的情况。

V8 的数据驱动的内联缓存系统是实现快速属性访问的核心部分。您可以在上面链接的[高级介绍](https://mathiasbynens.be/notes/shapes-ics)中阅读有关它的内容，或者更详细地描述 [V8 的对象表示](https://v8.dev/blog/fast-properties)以及 V8 的数据驱动的内联缓存系统是[如何实现](https://docs.google.com/document/d/1mEhMn7dbaJv68lTAvzJRCQpImQoO6NZa61qRimVeA-k/edit?usp=sharing)的。

为了加速 `super`，我们添加了一个新的 [Ignition](https://v8.dev/docs/ignition) 字节码 LdaNamedPropertyFromSuper，它使我们能够以解释模式插入 IC 系统，并生成优化的代码以访问 super 属性。

使用新的字节码，我们可以添加一个新的 IC `LoadSuperIC`，用于加速超级属性加载。与处理正常属性加载的 `LoadIC` 类似，`LoadSuperIC` 跟踪它所看到的查找起始对象的形状，并记住如何从具有这些形状之一的对象加载属性。

`LoadSuperIC` 将现有的 IC 机制重用于属性加载，只是使用不同的查找起始对象。由于 IC 层已经区分了查找起始对象和接收器，因此实现应该很容易。但是由于查找起始对象和接收器始终相同，因此即使我们指的是接收器，我们也会使用查找起始对象的错误，反之亦然。这些错误已得到修复，我们现在可以正确支持查找起始对象和接收器不同的情况。

超级属性访问的优化代码由 [TurboFan](https://v8.dev/docs/turbofan) 编译器的 JSNativeContextSpecialization 阶段生成。该实现概括了现有的属性查找机制([`JSNativeContextSpecialization::ReduceNamedAccess`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/compiler/js-native-context-specialization.cc;l=1130))来处理接收者和查找起始对象不同的情况。

当我们将 home 对象移出存储它的 `JSFunction` 时，优化的代码变得更加优化。它现在存储在类上下文中，这使得 TurboFan 尽可能将其作为常量嵌入到优化代码中。

## `super` 的其它用途

`super` 内部对象字面量方法的工作方式与内部类方法一样，并进行了类似的优化。

```javascript
const myproto = {
  __proto__: { x: 100 },
  m() {
    return super.x;
  },
};
const o = { __proto__: myproto };
o.m(); // returns 100
```

当然还有我们没有优化的极端情况。 比如写超级属性（`super.x = ...`）就没有优化。 此外，使用 mixins 会使访问站点变态，导致超级属性访问速度变慢：

```javascript
function createMixin(base) {
  class Mixin extends base {
    m() {
      return super.m() + 1;
    }
    //                ^ this access site is megamorphic
  }
  return Mixin;
}

class Base {
  m() {
    return 0;
  }
}

const myClass = createMixin(
  createMixin(createMixin(createMixin(createMixin(Base))))
);
new myClass().m();
```

为了确保所有面向对象的模式尽可能快，还有很多工作要做——请继续关注进一步的优化！
