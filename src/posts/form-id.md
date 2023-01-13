---
title: "读取表单的ID"
author: "Tan ([@thjxs](https://github.com/thjxs))"
date: 2022-09-07
tags:
  - Frontend
description: "读取dom对象属性"
---

## 案例

```html
<form id="form">
  <input id="id" type="text" name="id" />
</form>
```

```js
const form = document.getElementById('id')
console.log(form.id)
// 这个时候读取到的 id 属性指向了 input 输入框，并不能拿到 form 表单的id值
```
