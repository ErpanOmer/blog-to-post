上周我把一个核心模块交给AI重构，结果生产环境直接OOM了。那感觉就像是你让实习生写代码，他给你整了个递归死循环还加了层Promise套娃。😭

### 背景：为什么我们会迷信AI

起因是产品突然要求加一个实时数据大屏，涉及到WebGL和大量DOM操作。我心想这不得写半天，于是开了Cursor，把Figma设计稿一贴，让它生成React组件。五分钟后，AI吐出来三百行代码，类型定义齐全，注释写得比我还规范，我当时就觉得这饭碗怕是要砸了。

结果一跑，帧率直接掉到5fps，内存占用每秒涨50MB。这就很离谱。

### 方案A：AI生成的代码到底烂在哪

AI写的代码看起来完美，但骨子里是**同步阻塞模型**。它把WebGL的帧数据当成普通JSON塞进useState，导致每秒几百次重渲染。

```typescript
// AI生成的灾难现场，千万别学
const [frameData, setFrameData] = useState<Float32Array[]>([]);

useEffect(() => {
  const interval = setInterval(() => {
    // 这里很坑，capture返回的是巨量TypedArray
    const newData = webGLRenderer.captureFrame(); 
    setFrameData(prev => [...prev, newData]); // 深拷贝+状态更新，浏览器当场去世
  }, 16); // 60fps的野心，幻灯片的现实
  
  return () => clearInterval(interval);
}, []);
```

AI不懂**渲染性能边界**，它只知道状态变了要更新。它把GPU数据在主线程里传来传去，结果主线程被阻塞，连按钮点击都没响应。更气人的是，它还在注释里写性能已优化，我信了你的邪。🙄

### 方案B：手动编码的暴力美学

我花了一小时手动重写，改用OffscreenCanvas + Web Worker + 转移所有权。主线程只负责最后的绘制指令，连一帧的内存分配都没参与。

```typescript
// 这才是人该写的代码，脏活累活全扔给Worker
const canvasRef = useRef<HTMLCanvasElement>(null);
const workerRef = useRef<Worker>();

useEffect(() => {
  workerRef.current = new Worker(
    new URL('./gl-worker.ts', import.meta.url)
  );
  
  // 把canvas控制权转移给Worker，零拷贝通信
  const offscreen = canvasRef.current!.transferControlToOffscreen();
  
  workerRef.current.postMessage({ 
    type: 'INIT', 
    canvas: offscreen,
    bufferSize: 1024 * 1024 // 预分配内存池，拒绝GC抖动
  }, [offscreen]); // 转移所有权，主线程不再碰这块内存
  
  return () => {
    workerRef.current?.terminate(); // 干净收尾，拒绝内存泄漏
  };
}, []);
```

底层原理很简单：AI生成的代码是**内存分配即抛型**，每次setInterval都新建数组。而手动编码时，我考虑了**内存池复用**和**渲染流水线隔离**。帧率直接拉满60fps，内存曲线平得像死人心电图。

> AI写代码是在拼乐高，看起来像那么回事，但一用力就散架。手动编码是在造发动机，每个螺丝都考虑扭矩。

### 避坑指南：AI的甜蜜陷阱

踩过这次大坑后，我总结了三条血泪规则：

**别让AI碰性能敏感区**。动画、WebGL、大数据列表，AI生成的代码99%会内存泄漏。它不知道requestAnimationFrame和setInterval的区别，也不懂什么是时间切片。

**类型安全是幻觉**。AI写的TypeScript满屏的any和as unknown as X，编译过了，运行时报错更隐蔽。它会把Buffer当成Array处理，把异步函数当成同步返回，类型检查全绿，一跑就炸。

**上下文缺失是硬伤**。AI不知道你们公司的组件库三年前就废弃了某个API，它会开心地给你import已经标记为deprecated的模块。它也不知道你们团队约定所有网络请求必须用SWR缓存，它会给你写裸fetch然后拼字符串URL。

### 到底该怎么用AI

不是说AI没用，而是**现在的AI更适合当代码补全工具，不是架构师**。它擅长写样板代码，比如生成Zod schema验证，或者写CSS flex布局。但一旦涉及到**状态管理**、**并发控制**、**边界情况处理**，它就开始瞎猜。

未来不是AI替代程序员，而是**会用AI的程序员替代那些盲目信任AI的程序员**。你要做的不是让AI写完整模块，而是让它写函数签名和JSDoc，你自己填实现；或者让它review你的代码找bug，而不是让它生产核心逻辑。

记住一个真理：如果AI生成的代码跑起来很顺，那大概率是因为你的测试用例不够狠，或者你的用户量还不够大。💩