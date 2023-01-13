---
title: "浏览器文件下载"
author: "Tan ([@thjxs](https://github.com/thjxs))"
date: 2022-07-30
tags:
  - Develop
  - Frontend
description: "如何让浏览器下载我的文件"
---

浏览器有一个非常棒的功能，它能够将我们的静态资源下载到本机上

# 方式

> 这种方式被限制在同源的条件下

一种是通过 `download` 属性。当 a 标签拥有这个属性时，点击是不会跳转链接或者打开资源文件，而是触发浏览器的下载功能。

```html
<a href="cat.png" download>下载</a>
```
