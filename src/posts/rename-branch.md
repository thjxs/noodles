---
title: "用 Github API 改变仓库的分支名"
author: "Tan ([@thjxs](https://github.com/thjxs))"
date: 2020-11-20
tags:
  - Github API
  - CLI
description: "通过 Github API 将你仓库的 master 分支改成 main"
---

是否想将自己 `Github` 仓库的默认分支 `master` 改成 `main` 或 其它？你可以根据 [Github 文档](https://docs.github.com/en/free-pro-team@latest/github/collaborating-with-issues-and-pull-requests/creating-and-deleting-branches-within-your-repository)来操作。
这里介绍另外一种方法，结合 `Github API` 和脚本可以节省不少的时间。

## API v3

下面是仓库重命名所需要的 API，这里采用的是 [`REST API`](https://docs.github.com/en/free-pro-team@latest/v3)

获取仓库列表，per_page 最大是 100

```
GET /user/repos
```

获取仓库的分支列表

```
GET /repos/:owner/:repo/branches
```

创建分支，分支是存储 git 提交的哈希的 Git 引用

```
POST /repos/:owner/:repo/git/refs
```

删除分支，同理，这是删除 Git 引用

```
DELETE /repos/:owner/:repo/git/refs/:ref
```

更新仓库信息，设置默认分支

```
PATCH /repos/:owner/:repo
```

## Octokit

Github API 的官方客户端 [`Octokit`](https://github.com/octokit) ，有丰富的 types 支持，非常容易上手。部分请求需求用到 `access token` ，因此需求创建一个有 repo 权限的 token，[https://github.com/settings/tokens](https://github.com/settings/tokens) 。

```js
const octokit = new Octokit({ auth: `personal-access-token123` });
const response = await octokit.request("GET /orgs/:org/repos", {
  org: "octokit",
  type: "private",
});
```

以上，感谢你的阅读

广告时间...
[Oberisk](https://github.com/thjxs/oberisk) 实现了上面的功能哦，如果有帮到你什么，请留下一颗星星
