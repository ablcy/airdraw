# AirDraw - 空中手势涂鸦

基于 Google MediaPipe Hands 实现的隔空绘画应用，通过摄像头识别手势在空中涂鸦。

## 功能

- 摄像头实时手势识别
- 食指伸出 = 进入绘画模式，指尖轨迹实时渲染
- 握拳 = 停止绘画
- 五指张开 = 清空画布
- 流畅的笔触平滑算法

## 技术栈

- HTML5 Canvas
- MediaPipe Hands（CDN 加载）
- 纯 JavaScript，无框架依赖

## 使用方式

1. 打开 `index.html`
2. 授权摄像头访问
3. 伸出食指在空中绘画，握拳停止，张开五指清屏
