const canvas=document.getElementById('paintCanvas');
const ctx=canvas.getContext('2d');

let drawing=false, startX, startY, currentTool='brush';
let history=[], redoStack=[];
let customBrush=null, brushOpacity=1;

// --- Определение устройства ---
function isMobile(){ return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

// --- Подгонка холста под экран ---
function setCanvasSize(){
    let oldImage=ctx.getImageData(0,0,canvas.width,canvas.height);
    let w=isMobile()? window.innerWidth-20 : window.innerWidth*0.8;
    let h=isMobile()? window.innerHeight*0.6 : window.innerHeight*0.7;
    const tempCanvas=document.createElement('canvas');
    tempCanvas.width=w; tempCanvas.height=h;
    const tempCtx=tempCanvas.getContext('2d');
    if(oldImage.width && oldImage.height) tempCtx.putImageData(oldImage,0,0);
    canvas.width=w; canvas.height=h;
    ctx.drawImage(tempCanvas,0,0,w,h);
}
setCanvasSize();
window.addEventListener('resize', setCanvasSize);
window.addEventListener('orientationchange', setCanvasSize);

// --- Элементы управления ---
const colorPicker=document.getElementById('colorPicker');
const sizePicker=document.getElementById('sizePicker');
const opacityPicker=document.getElementById('opacityPicker');
const undoBtn=document.getElementById('undoBtn');
const redoBtn=document.getElementById('redoBtn');
const clearBtn=document.getElementById('clearBtn');
const saveBtn=document.getElementById('saveBtn');
const uploadBtn=document.getElementById('uploadBtn');
const uploadInput=document.getElementById('uploadInput');
const uploadBrushBtn=document.getElementById('uploadBrushBtn');

const tools=document.querySelectorAll('.tool-group button');
tools.forEach(btn=>{
    btn.addEventListener('click', ()=>{
        tools.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        currentTool=btn.dataset.tool;
    });
});

// --- История ---
function saveState(){ history.push(ctx.getImageData(0,0,canvas.width,canvas.height)); if(history.length>50) history.shift(); }
undoBtn.addEventListener('click',()=>{ if(!history.length) return; redoStack.push(ctx.getImageData(0,0,canvas.width,canvas.height)); ctx.putImageData(history.pop(),0,0); });
redoBtn.addEventListener('click',()=>{ if(!redoStack.length) return; history.push(ctx.getImageData(0,0,canvas.width,canvas.height)); ctx.putImageData(redoStack.pop(),0,0); });

// --- Прозрачность ---
opacityPicker.addEventListener('input', e=>brushOpacity=parseFloat(e.target.value));

// --- Кастомная кисть ---
uploadBrushBtn.addEventListener('click', ()=>{ brushInput.click(); });
const brushInput=document.createElement('input');
brushInput.type='file'; brushInput.accept='image/*';
brushInput.onchange=e=>{
    const file=e.target.files[0];
    const img=new Image();
    img.src=URL.createObjectURL(file);
    img.onload=()=>{ customBrush=img; alert('Кисть загружена!'); };
};
document.body.appendChild(brushInput);

// --- Координаты мыши / touch ---
function getPos(e){
    if(e.touches){ const rect=canvas.getBoundingClientRect(); return {x:e.touches[0].clientX-rect.left, y:e.touches[0].clientY-rect.top}; }
    else return {x:e.offsetX, y:e.offsetY};
}

// --- События рисования ---
const startDraw=e=>{
    e.preventDefault();
    const pos=getPos(e); drawing=true; startX=pos.x; startY=pos.y; saveState();

    if(currentTool==='text'){ const t=prompt('Введите текст:'); if(t){ctx.fillStyle=colorPicker.value; ctx.font=`${sizePicker.value*3}px Arial`; ctx.fillText(t,startX,startY);} drawing=false; }
    if(currentTool==='fill'){ fillCanvasOrArea(startX,startY,hexToRgb(colorPicker.value)); drawing=false; }
};
const endDraw=e=>{ e.preventDefault(); drawing=false; ctx.beginPath(); };

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('touchstart', startDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('touchend', endDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchmove', draw);

let savedImg=null;
canvas.addEventListener('mousedown', ()=>savedImg=ctx.getImageData(0,0,canvas.width,canvas.height));

function draw(e){
    e.preventDefault();
    if(!drawing) return;
    const pos=getPos(e); const x=pos.x; const y=pos.y;

    ctx.lineCap='round';
    ctx.lineWidth=currentTool==='pencil'?1:sizePicker.value;
    ctx.globalAlpha=brushOpacity;

    if(currentTool==='eraser') ctx.globalCompositeOperation='destination-out';
    else ctx.globalCompositeOperation='source-over';

    if(currentTool==='brush'){
        if(customBrush){
            ctx.drawImage(customBrush,x-sizePicker.value/2,y-sizePicker.value/2,sizePicker.value,sizePicker.value);
        } else {
            ctx.lineTo(x,y); ctx.strokeStyle=colorPicker.value; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y);
        }
    }
    if(currentTool==='pencil'){ ctx.lineTo(x,y); ctx.strokeStyle=colorPicker.value; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
    if(currentTool==='spray'){ for(let i=0;i<15;i++){ const angle=Math.random()*2*Math.PI; const radius=Math.random()*sizePicker.value; const sx=x+Math.cos(angle)*radius; const sy=y+Math.sin(angle)*radius; ctx.fillStyle=colorPicker.value; ctx.fillRect(sx,sy,1,1);} }

    if(['line','rect','circle','triangle'].includes(currentTool)){
        if(savedImg) ctx.putImageData(savedImg,0,0);
        const w=x-startX; const h=y-startY;
        ctx.strokeStyle=colorPicker.value;

        if(currentTool==='line'){ ctx.beginPath(); ctx.moveTo(startX,startY); ctx.lineTo(x,y); ctx.stroke(); }
        if(currentTool==='rect') ctx.strokeRect(startX,startY,w,h);
        if(currentTool==='circle'){ const r=Math.sqrt(w*w+h*h); ctx.beginPath(); ctx.arc(startX,startY,r,0,Math.PI*2); ctx.stroke(); }
        if(currentTool==='triangle'){ ctx.beginPath(); ctx.moveTo(startX,startY); ctx.lineTo(x,y); ctx.lineTo(startX*2-x,y); ctx.closePath(); ctx.stroke(); }
    }

    ctx.globalAlpha=1;
    ctx.globalCompositeOperation='source-over';
}

// --- Очистка ---
clearBtn.addEventListener('click',()=>ctx.clearRect(0,0,canvas.width,canvas.height));

// --- Сохранение ---
saveBtn.addEventListener('click',()=>{ const link=document.createElement('a'); link.download='painting.png'; link.href=canvas.toDataURL(); link.click(); });

// --- Загрузка изображения ---
uploadBtn.addEventListener('click',()=>uploadInput.click());
uploadInput.addEventListener('change', e=>{
    const file=e.target.files[0]; const img=new Image();
    img.src=URL.createObjectURL(file);
    img.onload=()=>{ const ratio=Math.min(canvas.width/img.width, canvas.height/img.height); ctx.drawImage(img,0,0,img.width*ratio,img.height*ratio); };
});

// --- Заливка ---
function fillCanvasOrArea(x,y,fillColor){
    const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=imgData.data;
    let empty=true;
    for(let i=0;i<data.length;i+=4){ if(data[i+3]>0){ empty=false; break; } }
    if(empty){ ctx.fillStyle=colorPicker.value; ctx.fillRect(0,0,canvas.width,canvas.height); return; }
    floodFill(x,y,fillColor);
}

function floodFill(x,y,fillColor){
    const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=imageData.data;
    const stack=[[x,y]];
    const baseColor=getColorAtPixel(data,x,y);
    if(colorsMatch(baseColor,fillColor)) return;
    while(stack.length){
        const [cx,cy]=stack.pop(); const pos=(cy*canvas.width+cx)*4;
        const currentColor=getColorAtPixel(data,cx,cy);
        if(colorsMatch(currentColor,baseColor)){
            setColor(data,pos,fillColor);
            if(cx>0) stack.push([cx-1,cy]);
            if(cx<canvas.width-1) stack.push([cx+1,cy]);
            if(cy>0) stack.push([cx,cy-1]);
            if(cy<canvas.height-1) stack.push([cx,cy+1]);
        }
    }
    ctx.putImageData(imageData,0,0);
}

function hexToRgb(hex){const bigint=parseInt(hex.substr(1),16);return {r:(bigint>>16)&255,g:(bigint>>8)&255,b:bigint&255};}
function getColorAtPixel(data,x,y){const pos=(y*canvas.width+x)*4;return {r:data[pos],g:data[pos+1],b:data[pos+2]};}
function setColor(data,pos,color){data[pos]=color.r;data[pos+1]=color.g;data[pos+2]=color.b;}
function colorsMatch(a,b){return a.r===b.r && a.g===b.g && a.b===b.b;}