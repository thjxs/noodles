---
title: "VS code snippets"
author: "Tan ([@thjxs](https://github.com/thjxs))"
date: 2022-03-17
tags:
  - Develop
description: "常用代码片段"
---

# 代码片段
插入一行虚线，一般用于函数组件的代码分割
```json
{
	"Add double dashed line": {
		"prefix": "dashed",
		"body": [
			"/*==============================$1==============================*/"
		],
		"description": "Add double dashed line"
	}
}
```

添加一个 `@deprecated` 注解

```json
{
	"deprecated": {
		"prefix": "dep",
		"body": [
			"/**",
 			" * @deprecated $1",
 			" */"
		],
		"description": "Add deprecated information"
	}
}
```

判断是否为开发环境的条件，使得打包工具能够在生产模式中去掉条件内的代码

```json
{
	"debugger": {
		"scope": "javascript,typescript",
		"prefix": "dev",
		"body": [
			"process.env.NODE_ENV === 'development'"
		],
		"description": "Only enable debug code in development environment"
	}
}
```

一个 `TODO` 标记

```json
{
	"Add todo mark": {
		"prefix": "todo",
		"body": [
			"// TODO:"
		],
		"description": "Add todo mark"
	}
}
```

初始化 `tsx` 函数组件

```json
{
	"init_component": {
		"prefix": "init_component",
		"body": [
			"interface $1Props {",
			"  //",
			"}",
			"export${2: default} function $1(props: $1Props) {",
			"  //$0",
			"}"
		],
		"description": "Init React Component"
	}
}
```

