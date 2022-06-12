---
title: "Render large log file"
author: "Tan ([@thjxs](https://github.com/thjxs))"
date: 2022-06-11
tags:
  - Frontend
  - React
description: "使用虚拟列表渲染日志文件"
---

现在我们有一个日志文件存在服务器，需要通过浏览器去浏览。这个时候你只有一个文件链接，你会如何去做？

比较常见的方式是将文本内容按行划分，运用虚拟列表的技术，延时渲染少量的 DOM 以此来达到性能上的提升。

## react-window

借助 `react-window` 这个一个优秀的 React 组件库来帮助我们渲染日志文件。

```jsx
<VariableSizeList
  width='100%'
  height={200}
  itemCount={length}
  itemSize={getItemSize}
>
{({index, style}) => (
  <li style={style}>list item</li>
)}
</VariableSizeList>
```

由于段落的高度是不确定的，所以借助一个 p 元素来计算每一行的高度。

```js
function App() {
  // 用来计算每一行的高度
  const p = useRef(null)
  const [logs, setLogs] = useState([])
  useEffect(() => {
    fetch('log.url').then((res) => res.text()).then((text) => {
      const list = text.split('\n')
      if(p.current) {
        const logs = []
        console.time('time')
        for(let i = 0; i < list.length; i += 1) {
          const item = list[i]
          // 这里跟dom进行交互，所以当循环很大的时候会阻塞浏览器
          p.current.textContent = item
          p.current.clientHeight
          logs.push({height: p.current.clientHeight || 22, text: item})
        }
        console.timeEnd('time')
        setLogs(logs)
      }
    })
  }, [])

  return (
    // 列表渲染
  )
}
```

但是，当我们运行上面的示例的时候，由于巨大的日志文件，浏览器会被阻塞，一万行的文本需要约2秒左右的耗时。所以我们稍微进行一些改进。

将一个耗时的长任务分割到小任务里面，使用 requestAnimationFrame 来调度任务

```js
function App() {
  // 用来计算每一行的高度
  const p = useRef(null)
  const [logs, setLogs] = useState([])
  useEffect(() => {
    fetch('log.url').then((res) => res.text()).then((text) => {
      const list = text.split('\n')
      if(p.current) {
        const logs = []
        // 我们增加了一个生成器
        function *getTextListHeight() {
          for(let i = 0; i < list.length; i += 1) {
            const item = list[i]
            p.current.textContent = item
            p.current.clientHeight
            logs.push({height: p.current.clientHeight || 22, text: item})
            yield
          }
        }
        const tasks = getTextListHeight()
        function runner() {
          let times = 200
          let it = tasks.next()
          while(!it.done && times > 0) {
            it = tasks.next()
            times -= 1
          }

          setLogs(logs)

          if(!it.done) {
            requestAnimationFrame(runner)
          }
        }
        requestAnimationFrame(runner)
    })
  }, [])

  return (
    // 列表渲染
  )
}
```

当我们作进一步的分析时，`react-window` 获取高度的时机是在数据渲染到 `dom` 的时候，所以可以考虑用类的 getter 来达到延时计算高度。

```js
function App() {
  // 用来计算每一行的高度
  const p = useRef(null)
  const logs = useRef([])
  useEffect(() => {
    fetch('log.url').then((res) => res.text()).then((text) => {
      const list = text.split('\n')
      if(p.current) {
        const logs = []
        console.time('time')
        logs.current = []
        for(let i = 0; i < list.length; i += 1) {
          const item = list[i]
          // 这里跟dom进行交互，所以当循环很大的时候会阻塞浏览器
          logs.current.push(new Log(p.current, item))
        }
        console.timeEnd('time')
      }
    })
  }, [])

  return (
    // 列表渲染
  )
}

class Log {
  constructor(container, text) {
    this.container = container
    this.text = text
  }

  get height() {
    this.container.textContent = this.text
    return this.container.clientHeight || 22
  }
}
```

到目前为止，一切看起来还不错。
