let globalCutList = [];
let globalHardware = {};
let globalSheetsCount = 0;
let showDims = true;
let scene, camera, renderer, labelRenderer, controls, cabinetGroup, dimensionGroup;

// ==========================================
// ۱. موتور محاسباتی (هوشمند)
// ==========================================
function calculateCutList(w, h, d, t, drawerCount, type) {
    let list = [];
    let isWall = type.includes('wall');
    let isSingle = type.includes('single');
    
    // ارتفاع بدنه
    let toeKickH = isWall ? 0 : 10; // کابینت هوایی پاخور ندارد
    let bodyH = h - toeKickH; 

    // بدنه‌ها
    list.push({ name: "بدنه (چپ/راست)", L: bodyH, W: d, Q: 2, type: 'wood' });
    
    let innerWidth = w - (t * 2);
    list.push({ name: "کف و سقف", L: innerWidth, W: d, Q: 2, type: 'wood' });
    
    if (!isWall) {
        let backH = bodyH - (t * 2) - 0.2;
        list.push({ name: "فیبر پشت", L: backH, W: w - (t * 2), Q: 1, type: 'fiber' });
        list.push({ name: "پاخور", L: innerWidth, W: 10, Q: 1, type: 'wood' });
        list.push({ name: "صفحه رویی", L: w + 2, W: d + 2, Q: 1, type: 'wood' });
    } else {
        let backH = bodyH - (t * 2) - 0.2;
        list.push({ name: "فیبر پشت", L: backH, W: w - (t * 2), Q: 1, type: 'fiber' });
    }

    // درب‌ها و کشوها
    if (drawerCount === 0) {
        let doorW = isSingle ? (w - 0.3) : ((w / 2) - 0.15);
        let doorH = bodyH - 0.3;
        let doorQty = isSingle ? 1 : 2;
        list.push({ name: "درب", L: doorH, W: doorW, Q: doorQty, type: 'wood' });
    } else {
        // (همان فرمول‌های قبلی کشو)
        let clearance = 1.3; 
        let boxWidth = innerWidth - (clearance * 2);
        let boxDepth = d - 2; 
        let gap = 0.3; 
        let frontH = (bodyH - ((drawerCount + 1) * gap)) / drawerCount;

        for (let i = 1; i <= drawerCount; i++) {
            list.push({ name: `پنل کشو ${i}`, L: frontH, W: w, Q: 1, type: 'wood' });
        }
        let boxH = frontH - 2; 
        list.push({ name: "بدنه کشو طولی", L: boxDepth, W: boxH, Q: 2 * drawerCount, type: 'wood' });
        list.push({ name: "بدنه کشو عرضی", L: boxWidth - (t*2), W: boxH, Q: 2 * drawerCount, type: 'wood' });
        list.push({ name: "کف کشو", L: boxWidth - 1, W: boxDepth - 1, Q: drawerCount, type: 'fiber' });
    }
    return list;
}

function calculateHardware(drawerCount, type) {
    let isSingle = type.includes('single');
    let hinges = (drawerCount === 0) ? (isSingle ? 2 : 4) : 0;
    let handles = (drawerCount === 0) ? (isSingle ? 1 : 2) : drawerCount;
    let edgeMeters = 0;

    globalCutList.forEach(item => {
        if(item.name.includes("درب") || item.name.includes("پنل کشو")) {
            edgeMeters += ((item.L + item.W) * 2 / 100) * item.Q;
        } else if (item.type === 'wood' && !item.name.includes("صفحه")) {
            edgeMeters += (item.L / 100) * item.Q; 
        }
    });

    return { hinges, slides: drawerCount, handles, edgeMeters: edgeMeters.toFixed(1) };
}

// ==========================================
// ۲. توابع سه بعدی و رسم
// ==========================================
// (کدهای init3D, animate, buildDimensions, createDimLine بدون تغییر از قبل اینجا قرار می‌گیرند)
function init3D() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(150, 120, 180);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute'; labelRenderer.domElement.style.top = '0px'; labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(100, 200, 100); scene.add(dirLight);
    cabinetGroup = new THREE.Group(); scene.add(cabinetGroup);
    dimensionGroup = new THREE.Group(); scene.add(dimensionGroup);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2;
    animate();
}
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); }
function createDimLine(p1, p2, text) {
    const mat = new THREE.LineBasicMaterial({ color: 0x00d2ff });
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p1.x, p1.y, p1.z), new THREE.Vector3(p2.x, p2.y, p2.z)]);
    dimensionGroup.add(new THREE.Line(geo, mat));
    const div = document.createElement('div'); div.className = 'dimension-label'; div.textContent = text;
    const label = new THREE.CSS2DObject(div); label.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
    dimensionGroup.add(label);
}
function buildDimensions(w, h, d) {
    while(dimensionGroup.children.length > 0){ dimensionGroup.remove(dimensionGroup.children[0]); }
    if (!showDims) return;
    const offset = 20;
    createDimLine({x: -w/2, y: -h/2 - offset, z: d/2}, {x: w/2, y: -h/2 - offset, z: d/2}, `${w} cm`);
    createDimLine({x: -w/2 - offset, y: -h/2, z: d/2}, {x: -w/2 - offset, y: h/2, z: d/2}, `${h} cm`);
    createDimLine({x: w/2 + offset, y: -h/2, z: -d/2}, {x: w/2 + offset, y: -h/2, z: d/2}, `${d} cm`);
}
function toggleDim() { showDims = !showDims; document.getElementById('dimBtn').textContent = showDims ? "ابعاد: روشن" : "ابعاد: خاموش"; generateAll(); }

// رسم مدل بر اساس نوع کابینت
function build3DCabinet(w, h, d, t, drawerCount, type) {
    while(cabinetGroup.children.length > 0){ cabinetGroup.remove(cabinetGroup.children[0]); }
    const isWall = type.includes('wall');
    const isSingle = type.includes('single');
    const matBody = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.9 }); 
    const matFront = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.5 }); 
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000 });

    function createPanel(pw, ph, pd, px, py, pz, material) {
        const geo = new THREE.BoxGeometry(pw, ph, pd);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(px, py, pz); mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
        cabinetGroup.add(mesh); return mesh;
    }

    let toeKickH = isWall ? 0 : 10; let bodyH = h - toeKickH; 
    const halfW = w / 2; const halfD = d / 2;
    const yOffset = -h/2 + toeKickH + (bodyH/2);
    const startY = yOffset - (bodyH/2); const endY = yOffset + (bodyH/2);

    createPanel(t, bodyH, d, -halfW + (t/2), yOffset, 0, matBody);
    createPanel(t, bodyH, d, halfW - (t/2), yOffset, 0, matBody);
    const innerW = w - (t * 2);
    createPanel(innerW, t, d, 0, startY + (t/2), 0, matBody);
    createPanel(innerW, t, d, 0, endY - (t/2), 0, matBody);
    createPanel(innerW, bodyH - (t*2), t, 0, yOffset, -halfD + (t/2), matBody);
    
    if (!isWall) {
        createPanel(innerW, toeKickH, 2, 0, -h/2 + (toeKickH/2), -halfD + 2 + (t/2), matBody);
    }

    if (drawerCount === 0) {
        let doorW = isSingle ? (w - 0.3) : ((w / 2) - 0.15);
        let doorH = bodyH - 0.3;
        
        if(isSingle) {
            const singleDoor = createPanel(doorW, doorH, t, 0, yOffset, halfD + (t/2), matFront); singleDoor.rotation.y = -0.4;
        } else {
            const left = createPanel(doorW, doorH, t, -doorW/2, yOffset, halfD + (t/2), matFront); left.rotation.y = -0.4; 
            const right = createPanel(doorW, doorH, t, doorW/2, yOffset, halfD + (t/2), matFront); right.rotation.y = 0.4;
        }
    } else {
        const gap = 0.3; const frontH = (bodyH - ((drawerCount + 1) * gap)) / drawerCount;
        const startFrontY = endY - gap - frontH/2;
        for(let i=0; i<drawerCount; i++) {
            createPanel(w, frontH, t, 0, startFrontY - i * (frontH + gap), halfD + (t/2) + 1, matFront); 
        }
    }
}

// (توابع calculateNesting, drawNesting, updateUI, updateFinance نیز به همین شکل اینجا قرار می‌گیرند. برای جلوگیری از طولانی شدن، فرض می‌کنیم کدهای قبلی را دارید)
function calculateNesting(list) {
    const sheetW = 183, sheetH = 366; let sheets = []; let pieces = [];
    list.forEach(item => { if (item.type === 'wood') { for(let i=0; i<item.Q; i++) pieces.push({ name: item.name, w: item.W, h: item.L, area: item.W * item.L }); } });
    pieces.sort((a, b) => b.area - a.area);
    let currentSheet = { pieces: [], usedArea: 0, currentX: 0, currentY: 0, rowHeight: 0 };
    pieces.forEach(p => {
        let pieceW = p.w; let pieceH = p.h;
        if (pieceW > sheetW && pieceH <= sheetW) { pieceW = p.h; pieceH = p.w; } 
        if (currentSheet.currentX + pieceW <= sheetW && currentSheet.currentY + pieceH <= sheetH) {
            currentSheet.pieces.push({ ...p, x: currentSheet.currentX, y: currentSheet.currentY, drawW: pieceW, drawH: pieceH });
            currentSheet.currentX += pieceW; currentSheet.rowHeight = Math.max(currentSheet.rowHeight, pieceH); currentSheet.usedArea += (pieceW * pieceH);
        } else if (currentSheet.currentY + currentSheet.rowHeight + pieceH <= sheetH && pieceW <= sheetW) {
            currentSheet.currentX = 0; currentSheet.currentY += currentSheet.rowHeight; currentSheet.rowHeight = 0;
            currentSheet.pieces.push({ ...p, x: currentSheet.currentX, y: currentSheet.currentY, drawW: pieceW, drawH: pieceH });
            currentSheet.currentX += pieceW; currentSheet.rowHeight = Math.max(currentSheet.rowHeight, pieceH); currentSheet.usedArea += (pieceW * pieceH);
        } else {
            sheets.push(currentSheet); currentSheet = { pieces: [], usedArea: 0, currentX: 0, currentY: 0, rowHeight: 0 };
            let newW = p.w; let newH = p.h; if (newW > sheetW && newH <= sheetW) { newW = p.h; newH = p.w; }
            currentSheet.pieces.push({ ...p, x: 0, y: 0, drawW: newW, drawH: newH });
            currentSheet.currentX = newW; currentSheet.rowHeight = newH; currentSheet.usedArea += (newW * newH);
        }
    });
    if (currentSheet.pieces.length > 0) sheets.push(currentSheet);
    globalSheetsCount = sheets.length; return sheets;
}
function drawNesting(sheets) {
    const canvas = document.getElementById('nesting-canvas'); const ctx = canvas.getContext('2d'); const container = document.getElementById('tab-nesting');
    canvas.width = container.clientWidth; canvas.height = container.clientHeight; ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sheetW = 183, sheetH = 366; const padding = 20; const totalWidth = canvas.width;
    const maxCols = Math.max(1, Math.floor(totalWidth / (sheetW + padding)));
    const scale = Math.min((totalWidth / maxCols - padding) / sheetW, (canvas.height - padding*2) / sheetH);
    sheets.forEach((sheet, index) => {
        const col = index % maxCols; const row = Math.floor(index / maxCols);
        const offsetX = totalWidth - (col * (sheetW * scale + padding)) - (sheetW * scale) - padding; const offsetY = row * (sheetH * scale + padding) + padding;
        ctx.fillStyle = "#2a2a35"; ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.fillRect(offsetX, offsetY, sheetW * scale, sheetH * scale); ctx.strokeRect(offsetX, offsetY, sheetW * scale, sheetH * scale);
        sheet.pieces.forEach(p => {
            ctx.fillStyle = "rgba(0, 210, 255, 0.2)"; ctx.strokeStyle = "#00d2ff"; ctx.lineWidth = 1;
            const px = offsetX + (sheetW - p.x - p.drawW) * scale; const py = offsetY + p.y * scale;
            ctx.fillRect(px, py, p.drawW * scale, p.drawH * scale); ctx.strokeRect(px, py, p.drawW * scale, p.drawH * scale);
        });
    });
    let totalSheetArea = sheets.length * (sheetW * sheetH); let totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
    let wastePercent = totalSheetArea > 0 ? (1 - (totalUsedArea / totalSheetArea)) * 100 : 0;
    document.getElementById('nesting-info').innerHTML = `<div style="color:#00d2ff; font-weight:bold; margin-bottom:5px;">آمار ورق</div>تعداد: <b>${sheets.length}</b> عدد<br>پرتی: <b style="color:${wastePercent > 30 ? '#e74c3c' : '#27ae60'}">${wastePercent.toFixed(1)}%</b>`;
}
function updateUI() {
    const tbody = document.getElementById("cut-list-body"); tbody.innerHTML = "";
    globalCutList.forEach(item => { tbody.innerHTML += `<tr><td style="text-align:right;">${item.name}</td><td>${item.L.toFixed(1)}</td><td>${item.W.toFixed(1)}</td><td>${item.Q}</td></tr>`; });
    document.getElementById('stat-hinges').textContent = globalHardware.hinges;
    document.getElementById('stat-slides').textContent = globalHardware.slides;
    document.getElementById('stat-handles').textContent = globalHardware.handles;
    document.getElementById('stat-edge').textContent = globalHardware.edgeMeters + " متر";
    document.getElementById('stat-sheets').textContent = globalSheetsCount;
    updateFinance();
}
function updateFinance() {
    const pMdf = parseFloat(document.getElementById('priceMdf').value) || 0; const pPvc = parseFloat(document.getElementById('pricePvc').value) || 0;
    const pHinge = parseFloat(document.getElementById('priceHinge').value) || 0; const pSlide = parseFloat(document.getElementById('priceSlide').value) || 0; const pHandle = parseFloat(document.getElementById('priceHandle').value) || 0;
    let total = (globalSheetsCount * pMdf) + (parseFloat(globalHardware.edgeMeters) * pPvc) + (globalHardware.hinges * pHinge) + (globalHardware.slides * pSlide) + (globalHardware.handles * pHandle);
    document.getElementById('total-cost-value').textContent = total.toLocaleString('fa-IR');
}

// ==========================================
// ۳. تابع اصلی
// ==========================================
function generateAll() {
    const type = document.getElementById('cabinetType').value;
    const w = parseFloat(document.getElementById('width').value); const h = parseFloat(document.getElementById('height').value);
    const d = parseFloat(document.getElementById('depth').value); const t = parseFloat(document.getElementById('thickness').value);
    const drawerCount = parseInt(document.getElementById('drawerCount').value);

    globalCutList = calculateCutList(w, h, d, t, drawerCount, type);
    globalHardware = calculateHardware(drawerCount, type);
    
    build3DCabinet(w, h, d, t, drawerCount, type);
    buildDimensions(w, h, d);
    
    const sheets = calculateNesting(globalCutList);
    drawNesting(sheets);
    updateUI(); 
}

function switchTab(tabId, event) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if(event) event.target.classList.add('active');
    if (tabId === 'nesting' || tabId === 'finance') generateAll(); 
}

window.onload = () => { init3D(); generateAll(); };
window.onresize = () => {
    const container = document.getElementById('canvas-container');
    if (camera && renderer && labelRenderer) { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); labelRenderer.setSize(container.clientWidth, container.clientHeight); }
    generateAll();
};
