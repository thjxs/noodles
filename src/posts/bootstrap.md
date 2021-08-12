---
title: "关于电脑的备忘录"
author: "Tan ([@thjxs](https://github.com/thjxs))"
date: 2021-08-12
tags:
  - Develop
description: "适用于 Windows 系统的前端开发及日常娱乐"
---

## 开始之前

准备全新的 `Windows` 系统及以下列出的软件，并一一安装

* [Visual Studio Code - Code Editing. Redefined](https://code.visualstudio.com/)
* [Node.js (nodejs.org)](https://nodejs.org/en/)
* [Sublime Text - Text Editing, Done Right](https://www.sublimetext.com/)
* [Sublime Merge | Git client from the makers of Sublime Text](https://www.sublimemerge.com/)
* [7-Zip](https://www.7-zip.org/)
* [Yarn2](https://yarnpkg.com/) or [Yarn 1](https://classic.yarnpkg.com/lang/en/)
* [Typora — a markdown editor, markdown reader.](https://typora.io/)
* [Windows Terminal](https://www.microsoft.com/zh-cn/p/windows-terminal/9n0dx20hk701?rtc=1&activetab=pivot:overviewtab)
* [Bitwarden Open Source Password Manager | Bitwarden](https://bitwarden.com/)
* [Drawboard: Easier PDF markup software](https://www.drawboard.com/)
* [Git (git-scm.com)](https://git-scm.com/)
* [Microsoft To Do: Lists, Tasks & Reminders](https://www.microsoft.com/zh-cn/p/microsoft-to-do-lists-tasks-reminders/9nblggh5r558#activetab=pivot:overviewtab)
* [Postman](https://www.postman.com/downloads/)
* [Steam (steampowered.com)](https://store.steampowered.com/)
* [Graphviz](http://graphviz.org/)

## 环境变量的设置

为了让某些软件能够在命令行的使用，添加下列路径到用户的环境变量或者系统变量

* `C:\Program Files\Sublime Text`
* `C:\Program Files\Graphviz\bin`
* `C:\Program Files\7-Zip`

## 软件配置

### Terminal

```json
{
    "backgroundImage": null,
    "colorScheme": "Campbell",
    "commandline": "C:\\Program Files\\Git\\bin\\bash.exe -li",
    "fontFace": "Cascadia Mono",
    "guid": "{704ae184-b29c-dcd0-c426-c2c64a02d393}",
    "icon": "C:\\Program Files\\Git\\mingw64\\share\\git\\git-for-windows.ico",
    "name": "Git Bash",
    "startingDirectory": "%USERPROFILE%"
},
```

### VS Code 的插件

* EditorConfig
* Sublime Text Keymap and Settings Importer
* Tailwind CSS IntelliSense
* TODO Highlight v2

### Sublime Text 的插件

* EditorConfig
* Emmet
* Package Control

### bash
.bashrc
```bash
alias merge="start merge"
alias typora="start typora"
```

### vim
.vimrc
```bash
set history=100

set autoread

" Fast saving
let mapleader = ";"
nmap <leader>w :w!<cr>

let $LANG='en'
set langmenu=en
source $VIMRUNTIME/delmenu.vim
source $VIMRUNTIME/menu.vim

set ruler
set hid

" Highlight search
set incsearch

" Regex
" set magic

set showmatch
set mat=2

" margin left
set foldcolumn=1

" syntax highlighting
syntax enable

set encoding=utf8

if $COLORTERM == 'gnome-terminal'
    set t_Co=256
endif


if has("gui_running")
    set guioptions-=T
    set guioptions-=e
    set t_Co=256
    set guitablabel=%M\ %t
endif


" Turn backup off
set nobackup
set nowb
set noswapfile

" Use spaces instead of tabs
set expandtab
set shiftwidth=4
set smarttab

" indent
set ai
set si

set laststatus=2
set statusline=\ %{HasPaste()}%F%m%r%h\ %w\ \ CWD:\ %r%{getcwd()}%h\ \ \ Line:\ %l\ \ Column:\ %c
function! HasPaste()
    if &paste
        return 'PASTE MODE  '
    endif
    return ''
endfunction
```
### git bash

```bash
PS1='\[\033]0;$PWD\007\]' # set window title
# PS1="$PS1"'\n'                 # new line
PS1="$PS1"'\[\033[32m\]'       # change to green
PS1="$PS1"'\u@\h '             # user@host<space>
# PS1="$PS1"'\[\033[35m\]'       # change to purple
# PS1="$PS1"'$MSYSTEM '          # show MSYSTEM
PS1="$PS1"'\[\033[33m\]'       # change to brownish yellow
PS1="$PS1"'\w'                 # current working directory
if test -z "$WINELOADERNOEXEC"
then
    GIT_EXEC_PATH="$(git --exec-path 2>/dev/null)"
    COMPLETION_PATH="${GIT_EXEC_PATH%/libexec/git-core}"
    COMPLETION_PATH="${COMPLETION_PATH%/lib/git-core}"
    COMPLETION_PATH="$COMPLETION_PATH/share/git/completion"
    if test -f "$COMPLETION_PATH/git-prompt.sh"
    then
        . "$COMPLETION_PATH/git-completion.bash"
        . "$COMPLETION_PATH/git-prompt.sh"
        PS1="$PS1"'\[\033[36m\]'  # change color to cyan
        PS1="$PS1"'`__git_ps1`'   # bash function
    fi
fi
PS1="$PS1"'\[\033[0m\]'        # change color
# PS1="$PS1"'\n'                 # new line
PS1="$PS1"' $ '                 # prompt: always $
```

