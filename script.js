const CDN_PATH = "https://cdn.jsdmirror.com/npm/@mediapipe/hands/";

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingElement = document.getElementById('loading');

let drawingPoints = []; 
let isDrawing = false; 

let smoothedPen = null; 

let unpinchFrameCount = 0;
const MAX_UNPINCH_FRAMES = 5; 

videoElement.addEventListener('loadedmetadata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function isClosedPalm(landmarks) {
  const d = getDistance;

  const indexExt = d(landmarks[5], landmarks[8]) > d(landmarks[5], landmarks[6]) * 1.5;
  const middleExt = d(landmarks[9], landmarks[12]) > d(landmarks[9], landmarks[10]) * 1.5;
  const ringExt = d(landmarks[13], landmarks[16]) > d(landmarks[13], landmarks[14]) * 1.5;
  const pinkyExt = d(landmarks[17], landmarks[20]) > d(landmarks[17], landmarks[18]) * 1.5;

  const handWidth = d(landmarks[5], landmarks[17]);
  const tipsWidth = d(landmarks[8], landmarks[20]);

  const fingersTogether = tipsWidth < handWidth * 1.25;

  return indexExt && middleExt && ringExt && pinkyExt && fingersTogether;
}

function onResults(results) {
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }

  const width = canvasElement.width;
  const height = canvasElement.height;
  const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;

  canvasCtx.clearRect(0, 0, width, height);

  let isFramingActive = false;
  let frameX, frameY, frameW, frameH;

  if (handCount === 2) {
    let boundaryPoints = [];
    for (const hand of results.multiHandLandmarks) {
      boundaryPoints.push(hand[4]);
      boundaryPoints.push(hand[8]);
    }

    if (boundaryPoints.length >= 4) {
      let minX = Math.min(...boundaryPoints.map(p => p.x));
      let maxX = Math.max(...boundaryPoints.map(p => p.x));
      let minY = Math.min(...boundaryPoints.map(p => p.y));
      let maxY = Math.max(...boundaryPoints.map(p => p.y));

      minX = Math.max(0, Math.min(1, minX));
      maxX = Math.max(0, Math.min(1, maxX));
      minY = Math.max(0, Math.min(1, minY));
      maxY = Math.max(0, Math.min(1, maxY));

      frameX = minX * width;
      frameY = minY * height;
      frameW = (maxX - minX) * width;
      frameH = (maxY - minY) * height;

      if (frameW > 30 && frameH > 30) {
        isFramingActive = true;
      }
    }
  }

  canvasCtx.filter = 'grayscale(100%) brightness(90%)';
  canvasCtx.drawImage(videoElement, 0, 0, width, height);
  canvasCtx.filter = 'none';

  if (isFramingActive) {
    canvasCtx.drawImage(videoElement, frameX, frameY, frameW, frameH, frameX, frameY, frameW, frameH);

    canvasCtx.strokeStyle = '#00ffcc';
    canvasCtx.lineWidth = 4;
    canvasCtx.lineJoin = 'round';
    canvasCtx.strokeRect(frameX, frameY, frameW, frameH);
    drawHUDCorners(canvasCtx, frameX, frameY, frameW, frameH);
  }

  if (isFramingActive) {
    isDrawing = false;
    smoothedPen = null;
  } 
  else if (handCount === 1) {
    const landmarks = results.multiHandLandmarks[0];
    const isEraserActive = isClosedPalm(landmarks);

    if (isEraserActive) {
      isDrawing = false;
      smoothedPen = null;
      unpinchFrameCount = 0;

      const eraserX = landmarks[9].x * width;
      const eraserY = landmarks[9].y * height;

      const handLengthPixels = getDistance(landmarks[0], landmarks[9]) * height;
      const eraserRadius = Math.max(25, handLengthPixels * 0.45); 

      let updatedPoints = [];
      let splitNext = false; 

      for (let i = 0; i < drawingPoints.length; i++) {
        const pt = drawingPoints[i];
        const dist = Math.sqrt(Math.pow(pt.x - eraserX, 2) + Math.pow(pt.y - eraserY, 2));

        if (dist <= eraserRadius) {
          splitNext = true; 
        } else {
          if (splitNext) {
            updatedPoints.push({ ...pt, isNewStroke: true });
            splitNext = false; 
          } else {
            updatedPoints.push(pt);
          }
        }
      }
      drawingPoints = updatedPoints;

      canvasCtx.save();
      canvasCtx.beginPath();
      canvasCtx.arc(eraserX, eraserY, eraserRadius, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      canvasCtx.fill();
      canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      canvasCtx.lineWidth = 3;
      canvasCtx.stroke();
      canvasCtx.restore();

    } else {
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];

      const distance = getDistance(thumbTip, indexTip);
      
      const currentThreshold = isDrawing ? 0.065 : 0.045; 

      const rawX = (thumbTip.x + indexTip.x) / 2 * width;
      const rawY = (thumbTip.y + indexTip.y) / 2 * height;

      const isCurrentlyPinching = distance < currentThreshold;

      canvasCtx.beginPath();
      canvasCtx.arc(rawX, rawY, 10, 0, 2 * Math.PI);
      canvasCtx.fillStyle = isCurrentlyPinching ? '#ff007f' : 'rgba(255, 255, 255, 0.4)';
      canvasCtx.fill();

      if (isCurrentlyPinching) {
        unpinchFrameCount = 0;

        const isNewStroke = !isDrawing;
        if (isNewStroke) {
          smoothedPen = { x: rawX, y: rawY };
        } else if (smoothedPen) {
          const alpha = 0.25; 
          smoothedPen.x = smoothedPen.x + (rawX - smoothedPen.x) * alpha;
          smoothedPen.y = smoothedPen.y + (rawY - smoothedPen.y) * alpha;
        }

        drawingPoints.push({ x: smoothedPen.x, y: smoothedPen.y, isNewStroke: isNewStroke });
        isDrawing = true;
      } else {
        if (isDrawing && unpinchFrameCount < MAX_UNPINCH_FRAMES) {
          unpinchFrameCount++;
          
          if (smoothedPen) {
            const alpha = 0.25;
            smoothedPen.x = smoothedPen.x + (rawX - smoothedPen.x) * alpha;
            smoothedPen.y = smoothedPen.y + (rawY - smoothedPen.y) * alpha;
            drawingPoints.push({ x: smoothedPen.x, y: smoothedPen.y, isNewStroke: false });
          }
        } else {
          isDrawing = false;
          smoothedPen = null; 
        }
      }
    }
  } else {
    if (isDrawing && unpinchFrameCount < 2) {
      unpinchFrameCount++;
      if (smoothedPen) {
        drawingPoints.push({ x: smoothedPen.x, y: smoothedPen.y, isNewStroke: false });
      }
    } else {
      isDrawing = false;
      smoothedPen = null;
    }
  }

  if (drawingPoints.length > 0) {
    canvasCtx.save();
    canvasCtx.strokeStyle = '#ff007f';
    canvasCtx.lineWidth = 10;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';

    canvasCtx.shadowColor = '#ff007f';
    canvasCtx.shadowBlur = 15;

    canvasCtx.beginPath();
    for (let i = 0; i < drawingPoints.length; i++) {
      const pt = drawingPoints[i];
      if (pt.isNewStroke || i === 0) {
        canvasCtx.moveTo(pt.x, pt.y);
      } else {
        canvasCtx.lineTo(pt.x, pt.y);
      }
    }
    canvasCtx.stroke();
    canvasCtx.restore();
  }
}

function drawHUDCorners(ctx, x, y, w, h) {
  const cornerSize = Math.min(w, h) * 0.15;
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x + cornerSize, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + cornerSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - cornerSize, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cornerSize + x, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - cornerSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - cornerSize, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerSize);
  ctx.stroke();
}

const hands = new Hands({
  locateFile: (file) => {
    return `${CDN_PATH}${file}`;
  }
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start().catch((err) => {
  alert("摄像头调用失败，请检查浏览器是否已授权摄像头权限。");
});
