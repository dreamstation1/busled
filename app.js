let route = "";

        let currentIdx = 1;

        let mainTimer = null;

        let isAnimating = false;

        let spriteMode = false;

        let spriteCols = 2;

        let spriteRows = 4;

        let spritePlaylist = [];

        let spritePlaylistIdx = 0;

        /** 4장만(상·하행 끔) — 다른 노선 스프라이트. 격자 #1·3·5·7 */

        const PRESET_LED_4FRAME_ONLY = {

            "1": { sizeW: 191.8, sizeH: 520, posX: 97.6, posY: 3.6 },

            "3": { sizeW: 191.8, sizeH: 520, posX: 97.6, posY: 34.6 },

            "5": { sizeW: 191.8, sizeH: 520, posX: 97.6, posY: 65.467 },

            "7": { sizeW: 191.8, sizeH: 520, posX: 97.6, posY: 96.4 },

        };

        /** 상·하행 5번째 켬(660 등) — 191/776, 4장 + #7 상·하행 Y */

        const PRESET_LED_660_WITH_EXTRA = {

            "1": { sizeW: 191, sizeH: 776, posX: 97.4, posY: 2 },

            "3": { sizeW: 191, sizeH: 776, posX: 97.4, posY: 21.3 },

            "5": { sizeW: 191, sizeH: 776, posX: 97.4, posY: 40.3 },

            "7": { sizeW: 191, sizeH: 776, posX: 97.4, posY: 59.45 },

            "7_sang": { sizeW: 191, sizeH: 776, posX: 97.4, posY: 78.45 },

            "7_ha": { sizeW: 191, sizeH: 776, posX: 97.4, posY: 97.65 },

        };

        function pickActivePresetTable() {

            try {

                if (document.getElementById("extraDirectionEnabled").checked) {

                    return PRESET_LED_660_WITH_EXTRA;

                }

            } catch (_) { /* ignore */ }

            return PRESET_LED_4FRAME_ONLY;

        }

        /** 이미지 URL (실제 호스트 주소 — 저장 키용) */

        let loadedSpriteUrl = "";

        /** 격자 셀 linear 인덱스 → 사용자 조절값 {sizeW,sizeH,posX,posY} */

        let spriteTuningByLinear = {};

        /** 위치 맞추기 UI에서 보는 재생 순서 안의 인덱스 */

        let editSlot = 0;

        let spriteAniTimer = null;

        const mainImg = document.getElementById("mainImg");

        const subImg = document.getElementById("subImg");

        const spriteLayer = document.getElementById("spriteLayer");

        const spriteLayerNext = document.getElementById("spriteLayerNext");

        const tunerBox = document.getElementById("tunerBox");

        function resolveImageUrl(raw) {

            const s = (raw || "").trim();

            if (!s) return "";

            try {

                const u = new URL(s);

                const srcParam = u.searchParams.get("src");

                if (srcParam) {

                    try { return decodeURIComponent(srcParam); } catch (_) { return srcParam; }

                }

            } catch (_) { /* ignore */ }

            return s;

        }

        function hideSpriteShowImgs(showImg) {

            spriteMode = !showImg;

            spriteLayer.style.display = showImg ? "none" : "block";

            spriteLayer.style.transform = "translateY(0)";

            spriteLayerNext.style.display = "none";

            spriteLayerNext.style.transform = "translateY(100%)";

            if (showImg) {

                mainImg.style.display = mainImg.src ? "block" : "none";

            } else {

                mainImg.style.display = "none";

                subImg.style.display = "none";

            }

        }

        function setSpriteBackgroundImage(url, onDone, onFail) {

            const img = new Image();

            img.referrerPolicy = "no-referrer";

            const bg = `url("${url.replace(/"/g, "\\\"")}")`;

            img.onload = () => {

                spriteLayer.style.backgroundImage = bg;

                spriteLayerNext.style.backgroundImage = bg;

                if (onDone) onDone();

            };

            img.onerror = () => {

                spriteLayer.style.backgroundImage = "";

                spriteLayerNext.style.backgroundImage = "";

                if (onFail) onFail();

            };

            img.src = url;

        }

        function applySpriteSlotToLayer(layerEl, playlistSlotIndex) {

            if (!layerEl || !spritePlaylist.length) return;

            const len = spritePlaylist.length;

            let i = playlistSlotIndex % len;

            if (i < 0) i += len;

            const ent = spritePlaylist[i];

            const t = mergedTuningForLinear(ent.linear, ent.tuneKey);

            layerEl.style.backgroundSize = `${t.sizeW}% ${t.sizeH}%`;

            layerEl.style.backgroundPosition = `${t.posX}% ${t.posY}%`;

        }

        function getExtraDirectionChoice() {

            try {

                if (!document.getElementById("extraDirectionEnabled").checked) return "none";

                const v = document.getElementById("directionExtra").value;

                return v === "sang" || v === "ha" ? v : "none";

            } catch (_) {

                return "none";

            }

        }

        /** 항목: { linear, tuneKey } — 가로 2칸 이상이면 매 줄의 오른쪽 칸만 */

        function rebuildSpritePlaylist() {

            const c = spriteCols;

            const r = spriteRows;

            const extra = getExtraDirectionChoice();

            function pushSlot(linear, tuneKey) {

                spritePlaylist.push({ linear, tuneKey: tuneKey != null ? String(tuneKey) : String(linear) });

            }

            spritePlaylist = [];

            if (c >= 2) {

                for (let row = 0; row < r; row++) {

                    const linear = row * c + (c - 1);

                    pushSlot(linear, String(linear));

                }

                const lastLinear = (r - 1) * c + (c - 1);

                if (extra === "sang") pushSlot(lastLinear, `${lastLinear}_sang`);

                else if (extra === "ha") pushSlot(lastLinear, `${lastLinear}_ha`);

                return;

            }

            for (let i = 0; i < c * r; i++) pushSlot(i, String(i));

        }

        function defaultTuningForLinear(linearIdx) {

            const c = spriteCols;

            const r = spriteRows;

            let idx = linearIdx % (c * r);

            if (idx < 0) idx += (c * r);

            const col = idx % c;

            const row = Math.floor(idx / c);

            const pctX = c <= 1 ? 0 : (col / (c - 1)) * 100;

            const pctY = r <= 1 ? 0 : (row / (r - 1)) * 100;

            return { sizeW: c * 100, sizeH: r * 100, posX: pctX, posY: pctY };

        }

        /** 격자 기본(d) → (상·하행 끔: 4장 프리셋 / 켬: 660+5번째 프리셋) → 사용자 저장(ov) */

        function mergedTuningForLinear(linearIdx, tuneKey) {

            const key = tuneKey != null ? String(tuneKey) : String(linearIdx);

            const d = defaultTuningForLinear(linearIdx);

            let base = d;

            if (spriteCols === 2 && spriteRows === 4) {

                const tbl = pickActivePresetTable();

                if (tbl[key]) base = { ...d, ...tbl[key] };

            }

            const ov = spriteTuningByLinear[key];

            return ov ? { ...base, ...ov } : base;

        }

        function tuningStorageBase() {

            if (!loadedSpriteUrl) return null;

            let exEn = "0";

            let exVal = "none";

            try {

                exEn = document.getElementById("extraDirectionEnabled").checked ? "1" : "0";

                exVal = document.getElementById("extraDirectionEnabled").checked

                    ? (document.getElementById("directionExtra").value || "sang")

                    : "none";

            } catch (_) { /* ignore */ }

            return `busLedSpriteTune_v2_${loadedSpriteUrl}|${spriteCols}|${spriteRows}|${exEn}|${exVal}`;

        }

        function applyPresetRightCol2x4() {

            const preset = pickActivePresetTable();

            spriteTuningByLinear = { ...spriteTuningByLinear, ...JSON.parse(JSON.stringify(preset)) };

            document.getElementById("gridCols").value = "2";

            document.getElementById("gridRows").value = "4";

            spriteCols = 2;

            spriteRows = 4;

            if (loadedSpriteUrl && spriteLayer.style.backgroundImage) {

                rebuildSpritePlaylist();

                editSlot = Math.min(editSlot, Math.max(0, spritePlaylist.length - 1));

                syncEditInputsFromData();

                applyPlaylistSlot(editSlot);

            }

            const modeHint = document.getElementById("extraDirectionEnabled").checked

                ? "상·하행 켬 → 660용(191/776·5번째 포함)"

                : "상·하행 끔 → 4장 전용 노선(191.8/520)";

            alert(`저장 테이블에 넣었습니다 (${modeHint}). 2×4에서는 같은 설정이 자동 기본값이기도 합니다.`);

        }

        function syncExtraDirectionUI() {

            const sel = document.getElementById("directionExtra");

            const en = document.getElementById("extraDirectionEnabled");

            if (!sel || !en) return;

            sel.disabled = !en.checked;

        }

        function onSpriteOptionsChanged() {

            if (!loadedSpriteUrl) return;

            const prev = editSlot;

            spriteCols = Math.max(1, parseInt(document.getElementById("gridCols").value, 10) || 2);

            spriteRows = Math.max(1, parseInt(document.getElementById("gridRows").value, 10) || 4);

            rebuildSpritePlaylist();

            if (!spritePlaylist.length) return;

            editSlot = Math.min(prev, spritePlaylist.length - 1);

            loadTuningFromStorageSilent();

            syncEditInputsFromData();

            applyPlaylistSlot(editSlot);

        }

        function saveTuningsLocal() {

            const base = tuningStorageBase();

            if (!base) {

                alert("먼저 링크로 이미지를 불러오세요.");

                return;

            }

            try {

                localStorage.setItem(base, JSON.stringify(spriteTuningByLinear));

                alert("저장했습니다.");

            } catch (e) {

                alert("저장 실패: " + e.message);

            }

        }

        function loadTuningsLocal() {

            const base = tuningStorageBase();

            if (!base) {

                alert("먼저 링크로 이미지를 불러오세요.");

                return;

            }

            const raw = localStorage.getItem(base);

            if (!raw) {

                alert("저장된 값이 없습니다.");

                return;

            }

            try {

                const o = JSON.parse(raw);

                if (o && typeof o === "object") spriteTuningByLinear = o;

                syncEditInputsFromData();

                applyPlaylistSlot(editSlot);

                alert("불러왔습니다.");

            } catch (_) {

                alert("저장 형식을 읽을 수 없습니다.");

            }

        }

        function clearTuningOverrides() {

            spriteTuningByLinear = {};

            syncEditInputsFromData();

            applyPlaylistSlot(editSlot);

        }

        /** slot = 재생 순서 번호 (0 … playlist.length-1) */

        function applyPlaylistSlot(slot) {

            if (!spritePlaylist.length) return;

            const len = spritePlaylist.length;

            let i = slot % len;

            if (i < 0) i += len;

            applySpriteSlotToLayer(spriteLayer, i);

            spritePlaylistIdx = i;

            spriteLayer.style.transform = "translateY(0)";

            spriteLayerNext.style.display = "none";

            spriteLayerNext.style.transform = "translateY(100%)";

            updateEditLabels();

        }

        function refreshCalibratedSlot() {

            if (!spritePlaylist.length) return;

            const ent = spritePlaylist[editSlot];

            const t = {

                sizeW: parseFloat(document.getElementById("tSizeW").value),

                sizeH: parseFloat(document.getElementById("tSizeH").value),

                posX: parseFloat(document.getElementById("tPosX").value),

                posY: parseFloat(document.getElementById("tPosY").value),

            };

            spriteTuningByLinear[ent.tuneKey] = t;

            applyPlaylistSlot(editSlot);

        }

        function syncEditInputsFromData() {

            if (!spritePlaylist.length) return;

            const ent = spritePlaylist[editSlot];

            const t = mergedTuningForLinear(ent.linear, ent.tuneKey);

            document.getElementById("tSizeW").value = fmt(t.sizeW);

            document.getElementById("tSizeH").value = fmt(t.sizeH);

            document.getElementById("tPosX").value = fmt(t.posX);

            document.getElementById("tPosY").value = fmt(t.posY);

            updateEditLabels();

        }

        function fmt(v) {

            const n = Number(v);

            if (Number.isNaN(n)) return "0";

            return String(Math.round(n * 1000) / 1000);

        }

        function updateEditLabels() {

            const ent = spritePlaylist.length ? spritePlaylist[editSlot] : null;

            let t = ent

                ? `편집 장 ${editSlot + 1} / ${spritePlaylist.length} (격자 #${ent.linear}, 키 ${ent.tuneKey})`

                : "—";

            if (mainTimer) {

                t += ` · 순환 표시 장 ${spritePlaylistIdx + 1}`;

            }

            document.getElementById("editSlotLabel").textContent = t;

        }

        function editSlotPrev() {

            if (!spritePlaylist.length) return;

            editSlot = (editSlot - 1 + spritePlaylist.length) % spritePlaylist.length;

            syncEditInputsFromData();

            applyPlaylistSlot(editSlot);

        }

        function editSlotNext() {

            if (!spritePlaylist.length) return;

            editSlot = (editSlot + 1) % spritePlaylist.length;

            syncEditInputsFromData();

            applyPlaylistSlot(editSlot);

        }

        function resetCurrentSlotToGridDefault() {

            if (!spritePlaylist.length) return;

            const ent = spritePlaylist[editSlot];

            delete spriteTuningByLinear[ent.tuneKey];

            syncEditInputsFromData();

            applyPlaylistSlot(editSlot);

        }

        function nudgeTuner(field, delta) {

            const el = document.getElementById(

                field === "posX" ? "tPosX" :

                field === "posY" ? "tPosY" :

                field === "sizeW" ? "tSizeW" : "tSizeH"

            );

            const cur = parseFloat(el.value);

            el.value = fmt((Number.isNaN(cur) ? 0 : cur) + delta);

            refreshCalibratedSlot();

        }

        function wireTunerInputs() {

            ["tSizeW", "tSizeH", "tPosX", "tPosY"].forEach(id => {

                const el = document.getElementById(id);

                el.addEventListener("input", refreshCalibratedSlot);

                el.addEventListener("change", refreshCalibratedSlot);

            });

        }

        wireTunerInputs();

        document.getElementById("directionExtra").addEventListener("change", onSpriteOptionsChanged);

        document.getElementById("extraDirectionEnabled").addEventListener("change", () => {

            syncExtraDirectionUI();

            onSpriteOptionsChanged();

        });

        document.getElementById("gridCols").addEventListener("change", onSpriteOptionsChanged);

        document.getElementById("gridRows").addEventListener("change", onSpriteOptionsChanged);

        syncExtraDirectionUI();

        syncTunerToggleLabel();

        function syncTunerToggleLabel() {

            const btn = document.getElementById("btnToggleTuner");

            if (!btn || !tunerBox) return;

            btn.textContent = tunerBox.hidden

                ? "위치·저장 수정 패널 펼치기"

                : "위치·저장 수정 패널 접기";

        }

        function toggleTunerPanel() {

            tunerBox.hidden = !tunerBox.hidden;

            syncTunerToggleLabel();

            if (!tunerBox.hidden && spritePlaylist.length) {

                syncEditInputsFromData();

                applyPlaylistSlot(editSlot);

            }

        }

        function afterSpritePlaylistReady(fromCalibration) {

            rebuildSpritePlaylist();

            if (!spritePlaylist.length) return;

            loadTuningFromStorageSilent();

            editSlot = 0;

            spritePlaylistIdx = 0;

            syncEditInputsFromData();

            applyPlaylistSlot(0);

            tunerBox.hidden = !fromCalibration;

            syncTunerToggleLabel();

            if (fromCalibration) stopPlayback();

        }

        function loadTuningFromStorageSilent() {

            const base = tuningStorageBase();

            if (!base) return;

            const raw = localStorage.getItem(base);

            if (!raw) return;

            try {

                const o = JSON.parse(raw);

                if (o && typeof o === "object") spriteTuningByLinear = o;

            } catch (_) { /* ignore */ }

        }

        function loadSpriteAndCalibrate() {

            const imageUrl = resolveImageUrl(document.getElementById("imageUrlInput").value);

            if (!imageUrl) {

                alert("위에 이미지 URL 또는 네이버 뷰어 링크를 넣으세요.");

                return;

            }

            stopPlayback();

            spriteCols = Math.max(1, parseInt(document.getElementById("gridCols").value, 10) || 2);

            spriteRows = Math.max(1, parseInt(document.getElementById("gridRows").value, 10) || 4);

            loadedSpriteUrl = imageUrl;

            hideSpriteShowImgs(false);

            setSpriteBackgroundImage(imageUrl,

                () => afterSpritePlaylistReady(true),

                () => {

                    hideSpriteShowImgs(true);

                    tunerBox.hidden = true;

                    syncTunerToggleLabel();

                    alert("이미지를 불러올 수 없습니다. 외부 서버가 막았거나 주소가 잘못됐을 수 있습니다. PNG를 GitHub 저장소에 넣고 그 주소(raw)로 넣어 보세요.");

                });

        }

        function spriteTick() {

            if (!spriteMode || isAnimating) return;

            if (!spritePlaylist.length) return;

            const mode = document.getElementById("modeSelect").value;

            const len = spritePlaylist.length;

            const nextIdx = (spritePlaylistIdx + 1) % len;

            if (mode !== "scroll") {

                spritePlaylistIdx = nextIdx;

                applyPlaylistSlot(spritePlaylistIdx);

                return;

            }

            isAnimating = true;

            applySpriteSlotToLayer(spriteLayer, spritePlaylistIdx);

            applySpriteSlotToLayer(spriteLayerNext, nextIdx);

            spriteLayer.style.transform = "translateY(0)";

            spriteLayerNext.style.transform = "translateY(100%)";

            spriteLayer.style.display = "block";

            spriteLayerNext.style.display = "block";

            let pos = 0;

            spriteAniTimer = setInterval(() => {

                pos += 2;

                spriteLayer.style.transform = `translateY(-${pos}%)`;

                spriteLayerNext.style.transform = `translateY(${100 - pos}%)`;

                if (pos >= 100) {

                    clearInterval(spriteAniTimer);

                    spriteAniTimer = null;

                    spritePlaylistIdx = nextIdx;

                    applySpriteSlotToLayer(spriteLayer, spritePlaylistIdx);

                    spriteLayer.style.transform = "translateY(0)";

                    spriteLayerNext.style.display = "none";

                    spriteLayerNext.style.transform = "translateY(100%)";

                    isAnimating = false;

                    updateEditLabels();

                }

            }, 10);

        }

        function stopPlayback() {

            if (mainTimer) {

                clearInterval(mainTimer);

                mainTimer = null;

            }

            if (spriteAniTimer) {

                clearInterval(spriteAniTimer);

                spriteAniTimer = null;

            }

            isAnimating = false;

            if (spriteMode && spritePlaylist.length) {

                applyPlaylistSlot(spritePlaylistIdx);

            }

        }

        function startBoard() {

            stopPlayback();

            isAnimating = false;

            const imageUrl = resolveImageUrl(document.getElementById("imageUrlInput").value);

            if (imageUrl) {

                route = "";

                spriteCols = Math.max(1, parseInt(document.getElementById("gridCols").value, 10) || 2);

                spriteRows = Math.max(1, parseInt(document.getElementById("gridRows").value, 10) || 4);

                loadedSpriteUrl = imageUrl;

                hideSpriteShowImgs(false);

                setSpriteBackgroundImage(imageUrl,

                    () => {

                        afterSpritePlaylistReady(false);

                        mainTimer = setInterval(spriteTick, 3000);

                    },

                    () => {

                        hideSpriteShowImgs(true);

                        tunerBox.hidden = true;

                        syncTunerToggleLabel();

                        alert("이미지를 불러올 수 없습니다. 네이버 등 외부 이미지는 GitHub Pages에서 막히는 경우가 많습니다. 같은 저장소에 PNG를 올려 그 주소를 쓰면 됩니다.");

                    });

                return;

            }

            tunerBox.hidden = true;

            syncTunerToggleLabel();

            hideSpriteShowImgs(true);

            route = document.getElementById("routeInput").value.trim();

            if (!route) {

                alert("이미지 URL을 넣거나, 로컬용 노선 번호를 입력하세요.");

                return;

            }

            currentIdx = 1;

            const firstImgSrc = `${route}${currentIdx}.png`;

            const tempImg = new Image();

            tempImg.referrerPolicy = "no-referrer";

            tempImg.src = firstImgSrc;

            tempImg.onload = () => {

                mainImg.src = firstImgSrc;

                mainImg.style.display = "block";

                mainImg.style.top = "0";

                subImg.style.display = "none";

                mainTimer = setInterval(tick, 3000);

            };

            tempImg.onerror = () => alert(`이미지(${route}1.png 등)를 찾을 수 없습니다.`);

        }

        function previewFirstSpriteSlot() {

            const raw = document.getElementById("imageUrlInput").value.trim();

            if (!spriteLayer.style.backgroundImage && !resolveImageUrl(raw)) {

                alert("먼저 URL을 넣고 이미지 불러오기를 하거나, 전광판 시작을 한 번 하세요.");

                return;

            }

            stopPlayback();

            spriteCols = Math.max(1, parseInt(document.getElementById("gridCols").value, 10) || 2);

            spriteRows = Math.max(1, parseInt(document.getElementById("gridRows").value, 10) || 4);

            if (resolveImageUrl(raw)) loadedSpriteUrl = resolveImageUrl(raw);

            rebuildSpritePlaylist();

            if (!spritePlaylist.length) return;

            loadTuningFromStorageSilent();

            editSlot = 0;

            spritePlaylistIdx = 0;

            hideSpriteShowImgs(false);

            syncEditInputsFromData();

            applyPlaylistSlot(0);

            tunerBox.hidden = true;

            syncTunerToggleLabel();

        }

        function tick() {

            if (spriteMode || isAnimating) return;

            const nextIdx = currentIdx + 1;

            const nextSrc = `${route}${nextIdx}.png`;

            const checker = new Image();

            checker.referrerPolicy = "no-referrer";

            checker.src = nextSrc;

            checker.onload = () => {

                runTransition(nextSrc);

                currentIdx = nextIdx;

            };

            checker.onerror = () => {

                if (currentIdx !== 1) {

                    runTransition(`${route}1.png`);

                    currentIdx = 1;

                }

            };

        }

        function runTransition(nextSrc) {

            const mode = document.getElementById("modeSelect").value;

            if (mode === "scroll") {

                isAnimating = true;

                subImg.src = nextSrc;

                subImg.style.display = "block";

                subImg.style.top = "100%";

                let pos = 0;

                const aniTimer = setInterval(() => {

                    pos += 2;

                    mainImg.style.top = `-${pos}%`;

                    subImg.style.top = `${100 - pos}%`;

                    if (pos >= 100) {

                        clearInterval(aniTimer);

                        mainImg.src = nextSrc;

                        mainImg.style.top = "0";

                        subImg.style.display = "none";

                        isAnimating = false;

                    }

                }, 10);

            } else {

                mainImg.src = nextSrc;

            }

        }

        function requestFull() {

            if (document.documentElement.requestFullscreen) {

                document.documentElement.requestFullscreen();

                document.body.classList.add("fullscreen");

            }

        }

        document.addEventListener("fullscreenchange", () => {

            if (!document.fullscreenElement) document.body.classList.remove("fullscreen");

        });

/* =========================================================================
 * [GPS 자동 정류소 안내] 신규 모듈
 * -------------------------------------------------------------------------
 * 위쪽의 기존 코드(스프라이트 전광판 미리보기 등)는 전혀 건드리지 않는다.
 * 아래 새 코드는 전부 "bus" 접두사를 붙여 기존 전역 변수/함수와 절대 겹치지
 * 않게 했다.
 *
 * 데이터 소스: bus_routes.js 가 만들어 두는 전역 변수 window.BUS_ROUTES
 *   (convert_xlsx.py 가 서울시 "노선별정류소정보" + "정류소위치정보" 엑셀에서
 *    생성한다. ROUTE_ID 기준으로 노선을 관리하며, 정류장은 반드시 엑셀의
 *    "순번" 값 그대로 정렬되어 있다. 정류장 식별은 NODE_ID 기준이다.)
 *
 * 전광판 연결: 이 파일은 fetch()로 HTTP API(/api/show, /api/ping, /api/status)만
 *   호출한다. 그 앞단이 무엇인지는 이 코드 입장에서 중요하지 않다.
 *   (기본/권장) MatrixPortal M4가 자체 Wi-Fi AP + HTTP 서버를 켜고 있어서
 *     휴대폰이 곧바로 전광판에 붙는다 — 노트북 불필요 (omsiledcode.ino 참고).
 *   (구형/대안) 노트북에서 bridge_server.py 를 실행해 USB 시리얼로 중계할 수도
 *     있다. 이 경우 위 브릿지 서버 주소를 그 PC의 IP:포트로 바꾸면 된다.
 *   두 경우 모두 결국 전광판에는 동일한 "DYN:..." 명령이 전달된다.
 * ========================================================================= */

// ----- 설정값 기본값 (요청사항의 기본값과 동일) -----
const busSettings = {
    approachM: 80,   // 정류장 접근 거리
    arriveM: 30,     // 정류장 도착 거리
    passM: 40,       // 통과 판정 여유 거리(최근접 거리보다 이만큼 더 멀어지면 "통과"로 판정)
    gpsIntervalMs: 1500, // GPS 갱신(판정) 간격
    accuracyMaxM: 50,    // 이 값보다 정확도가 나쁘면(큰 값이면) 해당 위치 무시
};

// ----- 런타임 상태 -----
const busState = {
    routeId: null,
    routeName: "",
    stations: null,       // [{seq,nodeId,arsId,name,lat,lon}, ...] (순번 오름차순)
    currentIndex: 0,       // "현재 정류장" 배열 인덱스(0-based)
    expectedIndex: 0,       // GPS 자동판정이 기준으로 삼는 인덱스(보통 currentIndex와 같음)
    bestNextDist: Infinity, // 현재 leg에서 "다음 정류장"까지 관측된 최소 거리(통과 판정용)
    running: false,
    paused: false,
    autoGps: true,
    testMode: false,
    testIndex: 0,
    lastPos: null,          // {lat, lon, acc}
    lastFixTs: 0,
    lastArrivalTs: 0,
    connOk: false,
    pingFailCount: 0,
};

let busWatchId = null;
const BUS_PERSIST_KEY = "busGpsPersist_v1";

// ----- 유틸 -----
function busHaversine(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function busEscapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
}

function busNowStr() {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
}

function busBridgeUrl() {
    const el = document.getElementById("busBridgeUrl");
    return (el && el.value ? el.value.trim() : "").replace(/\/+$/, "");
}

function busFetchWithTimeout(url, opts, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ms);
        fetch(url, opts).then(
            (r) => { clearTimeout(timer); resolve(r); },
            (e) => { clearTimeout(timer); reject(e); }
        );
    });
}

function busStationKey(st) {
    // 데이터 안전성 요구사항: ROUTE_ID + 순번 + NODE_ID 로 정류장을 유일하게 식별
    return `${busState.routeId}#${st.seq}#${st.nodeId}`;
}

// ----- 로그 -----
function busAppendLog(msg) {
    const box = document.getElementById("busLogBox");
    if (!box) return;
    if (box.textContent === "(로그 없음)") box.textContent = "";
    const line = `[${busNowStr()}] ${msg}\n`;
    box.textContent += line;
    box.scrollTop = box.scrollHeight;
}

function busClearLog() {
    const box = document.getElementById("busLogBox");
    if (box) box.textContent = "(로그 없음)";
}

// ----- 상태 저장/복원 (localStorage) -----
function busSaveState() {
    try {
        const data = {
            routeId: busState.routeId,
            currentIndex: busState.currentIndex,
            settings: busSettings,
            bridgeUrl: busBridgeUrl(),
        };
        localStorage.setItem(BUS_PERSIST_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage 사용 불가 환경은 조용히 무시 */ }
}

function busLoadState() {
    let saved = null;
    try {
        const raw = localStorage.getItem(BUS_PERSIST_KEY);
        if (raw) saved = JSON.parse(raw);
    } catch (e) { saved = null; }
    if (!saved) return;

    if (saved.settings) {
        Object.assign(busSettings, saved.settings);
        busReflectSettingsToInputs();
    }
    if (saved.bridgeUrl) {
        const el = document.getElementById("busBridgeUrl");
        if (el) el.value = saved.bridgeUrl;
    }
    if (saved.routeId && window.BUS_ROUTES && BUS_ROUTES.routes[saved.routeId]) {
        busSelectRoute(saved.routeId, /*silent*/ true);
        const idx = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
        if (busState.stations && idx >= 0 && idx < busState.stations.length) {
            busState.currentIndex = idx;
            busState.expectedIndex = idx;
        }
        // 안전을 위해 GPS 자동 운행 상태는 항상 꺼진 채로 복구한다.
        busState.running = false;
        busState.paused = false;
        document.getElementById("busAutoGpsToggle").checked = true;
        busState.autoGps = true;
        busRenderStationList();
        busUpdateRunScreen();
        busAppendLog(
            `이전 세션 복구: 노선 ${busEscapeHtml(busState.routeName)}, ` +
            `${idx + 1}/${busState.stations.length}번째 정류장. ` +
            `안전을 위해 운행은 정지 상태입니다 — 확인 후 [운행 시작]을 눌러주세요.`
        );
    }
}

function busReflectSettingsToInputs() {
    document.getElementById("busCfgApproach").value = busSettings.approachM;
    document.getElementById("busCfgArrive").value = busSettings.arriveM;
    document.getElementById("busCfgPass").value = busSettings.passM;
    document.getElementById("busCfgInterval").value = busSettings.gpsIntervalMs;
    document.getElementById("busCfgAccuracy").value = busSettings.accuracyMaxM;
}

function busApplySettings() {
    const num = (id, fallback) => {
        const v = parseFloat(document.getElementById(id).value);
        return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    busSettings.approachM = num("busCfgApproach", busSettings.approachM);
    busSettings.arriveM = num("busCfgArrive", busSettings.arriveM);
    busSettings.passM = num("busCfgPass", busSettings.passM);
    busSettings.gpsIntervalMs = num("busCfgInterval", busSettings.gpsIntervalMs);
    busSettings.accuracyMaxM = num("busCfgAccuracy", busSettings.accuracyMaxM);
    busSaveState();
    busAppendLog(
        `설정 적용: 접근 ${busSettings.approachM}m / 도착 ${busSettings.arriveM}m / ` +
        `통과여유 ${busSettings.passM}m / 갱신 ${busSettings.gpsIntervalMs}ms / 정확도임계 ${busSettings.accuracyMaxM}m`
    );
}

// ----- 노선 검색/선택 -----
function busSearchRoute() {
    const q = document.getElementById("busRouteQuery").value.trim();
    const resultsEl = document.getElementById("busSearchResults");
    resultsEl.innerHTML = "";
    if (!q) { alert("노선번호를 입력하세요. 예: 674"); return; }
    if (!window.BUS_ROUTES) {
        resultsEl.innerHTML =
            '<p class="busHint">bus_routes.js가 로드되지 않았습니다. index.html과 같은 폴더에 ' +
            "bus_routes.js가 있는지 확인하세요(convert_xlsx.py로 생성).</p>";
        return;
    }
    const ids = BUS_ROUTES.routesByName[q];
    if (!ids || !ids.length) {
        resultsEl.innerHTML = `<p class="busHint">"${busEscapeHtml(q)}" 노선을 찾을 수 없습니다. 노선번호를 확인하세요.</p>`;
        return;
    }
    let html = "";
    ids.forEach((rid, i) => {
        const r = BUS_ROUTES.routes[rid];
        const n = r.stations.length;
        const first = n ? r.stations[0].name : "-";
        const last = n ? r.stations[n - 1].name : "-";
        html += `<div class="busSearchResult">
      <label><input type="radio" name="busRouteRadio" value="${busEscapeHtml(rid)}" ${i === 0 ? "checked" : ""}>
        ${busEscapeHtml(r.routeName)} <span class="busRouteMeta">· ROUTE_ID ${busEscapeHtml(rid)}</span></label>
      <div class="busRouteMeta">정류장 ${n}개</div>
      <div class="busRoutePreview">출발: ${busEscapeHtml(first)} → 종점: ${busEscapeHtml(last)}</div>
    </div>`;
    });
    html += `<div class="busRow"><button type="button" onclick="busUseSelectedRoute()">이 노선 사용</button>
      ${ids.length > 1 ? '<span class="busHint" style="margin:0;">같은 번호의 노선이 여러 개 있습니다. 방향/구간을 확인하고 선택하세요.</span>' : ""}
    </div>`;
    resultsEl.innerHTML = html;
}

function busUseSelectedRoute() {
    const checked = document.querySelector('input[name="busRouteRadio"]:checked');
    if (!checked) { alert("사용할 노선을 선택하세요."); return; }
    busSelectRoute(checked.value);
}

function busSelectRoute(routeId, silent) {
    const r = BUS_ROUTES.routes[routeId];
    if (!r) { if (!silent) alert("노선 데이터를 찾을 수 없습니다."); return; }
    busState.routeId = routeId;
    busState.routeName = r.routeName;
    busState.stations = r.stations; // convert_xlsx.py가 이미 순번 오름차순으로 정렬해 둠
    busState.currentIndex = 0;
    busState.expectedIndex = 0;
    busState.bestNextDist = Infinity;
    busState.running = false;
    busState.paused = false;

    document.getElementById("busRouteInfoCard").hidden = false;
    document.getElementById("busRouteSummary").textContent =
        `${r.routeName} · ROUTE_ID ${routeId} · 정류장 ${r.stations.length}개 (엑셀 "순번" 기준 운행 순서)`;
    document.getElementById("busStationFilter").value = "";
    busRenderStationList();
    busUpdateRunScreen();
    busSaveState();
    if (!silent) busAppendLog(`노선 선택: ${r.routeName} (ROUTE_ID ${routeId}, 정류장 ${r.stations.length}개)`);
}

// ----- 정류장 목록 렌더링 -----
function busStationIcon(idx) {
    if (idx < busState.currentIndex) return "✓";
    if (idx === busState.currentIndex) return "●";
    if (idx === busState.currentIndex + 1) return "→";
    return "○";
}

function busRenderStationList() {
    const listEl = document.getElementById("busStationList");
    if (!listEl || !busState.stations) return;
    const filter = (document.getElementById("busStationFilter").value || "").trim().toLowerCase();

    let html = "";
    busState.stations.forEach((st, idx) => {
        if (filter) {
            const hay = (st.name + " " + (st.arsId || "")).toLowerCase();
            if (!hay.includes(filter)) return;
        }
        const icon = busStationIcon(idx);
        let cls = "busStationRow";
        if (idx < busState.currentIndex) cls += " busDone";
        else if (idx === busState.currentIndex) cls += " busCurrent";
        else if (idx === busState.currentIndex + 1) cls += " busNextUp";
        html += `<div class="${cls}" onclick="busOnStationRowClick(${idx})">
      <span class="busIcon">${icon}</span>
      <span class="busSeq">${st.seq}</span>
      <span class="busName">${busEscapeHtml(st.name)}</span>
      <span class="busArs">${st.arsId ? "ARS " + busEscapeHtml(st.arsId) : ""}</span>
    </div>`;
    });
    listEl.innerHTML = html || '<p class="busHint" style="padding:10px;">검색 결과가 없습니다.</p>';
}

function busOnStationRowClick(idx) {
    if (busState.testMode) {
        // 테스트 모드: 클릭한 정류장 좌표를 실제 GPS 위치처럼 흘려보내 판정 알고리즘을 그대로 시험한다.
        busState.testIndex = idx;
        busApplyTestPosition(idx);
    } else {
        // 일반 모드: 클릭한 정류장을 곧바로 "현재(출발) 정류장"으로 확정한다.
        busSetCurrentStation(idx);
    }
}

function busSetCurrentStation(idx) {
    if (!busState.stations || idx < 0 || idx >= busState.stations.length) return;
    busState.currentIndex = idx;
    busState.expectedIndex = idx;
    busState.bestNextDist = Infinity;
    busRenderStationList();
    busUpdateRunScreen();
    busSendShow();
    busSaveState();
}

// ----- 운행 화면 갱신 -----
function busUpdateRunScreen() {
    document.getElementById("busOutRoute").textContent = busState.routeName || "-";
    if (busState.stations && busState.stations.length) {
        const st = busState.stations[busState.currentIndex];
        const nextSt = busState.stations[busState.currentIndex + 1];
        document.getElementById("busOutSeq").textContent =
            `${busState.currentIndex + 1} / ${busState.stations.length}`;
        document.getElementById("busOutCurrent").textContent = st ? st.name : "-";
        document.getElementById("busOutNext").textContent = nextSt ? nextSt.name : "(종점)";
    }
}

function busUpdateRunScreenGps() {
    if (!busState.lastPos) return;
    const { lat, lon, acc } = busState.lastPos;
    document.getElementById("busOutGps").textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    document.getElementById("busOutAcc").textContent = acc != null ? `±${Math.round(acc)}m` : "-";
}

function busUpdateDistanceUi(dNext) {
    document.getElementById("busOutDist").textContent =
        dNext == null ? "-" : `${Math.round(dNext)}m`;
}

function busSetConn(ok) {
    busState.connOk = ok;
    const badge = document.getElementById("busConnBadge");
    const out = document.getElementById("busOutConn");
    if (ok) {
        badge.textContent = "● 전광판 연결됨";
        badge.className = "busBadge busBadgeOn";
        if (out) out.textContent = "● 전광판 연결됨";
    } else {
        badge.textContent = "○ 전광판 연결 끊김";
        badge.className = "busBadge busBadgeOff";
        if (out) out.textContent = "○ 전광판 연결 끊김";
    }
}

// ----- 전광판(브릿지 서버) 통신 -----
function busSendShow() {
    if (!busState.stations || !busState.stations.length) return;
    const url = busBridgeUrl();
    if (!url) { busAppendLog("브릿지 서버 주소가 비어 있어 전송하지 않았습니다."); return; }
    const st = busState.stations[busState.currentIndex];
    const nextSt = busState.stations[busState.currentIndex + 1] || null;
    const body = {
        route: busState.routeName,
        seq: st.seq,
        total: busState.stations.length,
        thisName: st.name,
        nextName: nextSt ? nextSt.name : "",
        thisEn: "",
    };
    busFetchWithTimeout(url + "/api/show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }, 4000)
        .then((r) => r.json())
        .then((j) => {
            busAppendLog(
                `전광판 전송: [${st.seq}/${busState.stations.length}] ${st.name}` +
                (j.ok ? " → 전달됨" : " → 응답 없음(연결 확인 필요)")
            );
            busSetConn(!!j.ok);
            busState.pingFailCount = j.ok ? 0 : busState.pingFailCount;
        })
        .catch((e) => {
            busAppendLog("전광판 전송 실패: " + e.message);
            busSetConn(false);
        });
}

function busTestConnection() {
    const url = busBridgeUrl();
    if (!url) { busAppendLog("브릿지 서버 주소를 입력하세요."); return; }
    busFetchWithTimeout(url + "/api/ping", {}, 4000)
        .then((r) => r.json())
        .then((j) => {
            busSetConn(!!j.connected);
            busAppendLog(j.connected ? `연결 확인됨 (지연 ${j.latencyMs}ms)` : "연결 응답은 왔지만 전광판 미연결(시리얼 확인 필요)");
        })
        .catch((e) => {
            busSetConn(false);
            busAppendLog("연결 테스트 실패: " + e.message);
        });
}

function busPingTick() {
    const url = busBridgeUrl();
    if (!url) return;
    busFetchWithTimeout(url + "/api/ping", {}, 4000)
        .then((r) => r.json())
        .then((j) => {
            if (j.connected) {
                const wasDown = !busState.connOk;
                busState.pingFailCount = 0;
                busSetConn(true);
                if (wasDown && busState.stations) {
                    busAppendLog("전광판 재연결됨 → 현재 상태를 다시 전송합니다.");
                    busSendShow();
                }
            } else {
                busState.pingFailCount++;
                if (busState.pingFailCount >= 2) busSetConn(false);
            }
        })
        .catch(() => {
            busState.pingFailCount++;
            if (busState.pingFailCount >= 2) busSetConn(false);
        });
}

// ----- 운행 제어 -----
function busStartRun() {
    if (!busState.stations || !busState.stations.length) { alert("먼저 노선을 검색해서 선택하세요."); return; }
    busState.running = true;
    busState.paused = false;
    busState.bestNextDist = Infinity;
    busAppendLog(`운행 시작: ${busState.routeName} (${busState.currentIndex + 1}/${busState.stations.length}번째 정류장부터)`);
    busSendShow();
    if (!busState.testMode) busStartGeolocation();
}

function busPauseRun() {
    busState.paused = true;
    busAppendLog("운행 일시정지");
}

function busResumeRun() {
    if (!busState.running) { busStartRun(); return; }
    busState.paused = false;
    busAppendLog("운행 재개");
}

function busStopRun() {
    busState.running = false;
    busState.paused = false;
    busStopGeolocation();
    busAppendLog("운행 종료");
}

function busToggleAutoGps() {
    busState.autoGps = document.getElementById("busAutoGpsToggle").checked;
    busAppendLog("GPS 자동 진행: " + (busState.autoGps ? "켬" : "끔(수동 버튼으로만 진행)"));
}

function busManualPrev() {
    if (!busState.stations) return;
    const idx = Math.max(0, busState.currentIndex - 1);
    busSetCurrentStation(idx);
    busAppendLog("수동: 이전 정류장으로 이동");
}

function busManualNext() {
    if (!busState.stations) return;
    const idx = Math.min(busState.stations.length - 1, busState.currentIndex + 1);
    busSetCurrentStation(idx);
    busAppendLog("수동: 다음 정류장으로 이동");
}

function busRedisplayCurrent() {
    if (!busState.stations) return;
    busAppendLog("수동: 현재 정류장 다시 표시");
    busSendShow();
}

// ----- GPS 획득 (실기기) -----
function busStartGeolocation() {
    if (busState.testMode) return;
    if (!("geolocation" in navigator)) {
        busAppendLog("이 브라우저는 GPS(Geolocation API)를 지원하지 않습니다. GPS 테스트 모드나 iOS 단축어 대안을 사용하세요.");
        return;
    }
    if (window.isSecureContext === false) {
        busAppendLog(
            "경고: 이 페이지가 보안 컨텍스트(HTTPS 또는 file://)가 아니어서 브라우저가 GPS 요청을 차단할 수 있습니다. " +
            "안내 문서의 'iPhone/Android GPS 허용 방법'을 확인하세요."
        );
    }
    if (busWatchId != null) return;
    busWatchId = navigator.geolocation.watchPosition(busOnGeoSuccess, busOnGeoError, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 12000,
    });
}

function busStopGeolocation() {
    if (busWatchId != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(busWatchId);
    }
    busWatchId = null;
}

function busOnGeoSuccess(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    busHandleFix(latitude, longitude, accuracy, Date.now());
}

function busOnGeoError(err) {
    const msgs = {
        1: "위치 권한이 거부되었습니다. 브라우저의 위치 정보 권한을 허용해주세요.",
        2: "위치를 확인할 수 없습니다(신호 없음 등).",
        3: "위치 확인이 시간 초과되었습니다.",
    };
    busAppendLog("GPS 오류: " + (msgs[err.code] || err.message || "알 수 없는 오류"));
}

// ----- GPS 테스트 모드 -----
function busToggleTestMode() {
    busState.testMode = document.getElementById("busTestModeToggle").checked;
    if (busState.testMode) {
        busStopGeolocation();
        busState.testIndex = busState.currentIndex;
        busAppendLog("GPS 테스트 모드 켬: 실제 GPS 대신 [이전 위치]/[다음 위치] 버튼 또는 정류장 클릭으로 위치를 흉내냅니다.");
    } else {
        busAppendLog("GPS 테스트 모드 끔: 실제 GPS를 사용합니다.");
        if (busState.running && !busState.paused) busStartGeolocation();
    }
}

function busApplyTestPosition(idx) {
    if (!busState.stations || idx < 0 || idx >= busState.stations.length) return;
    const st = busState.stations[idx];
    if (st.lat == null || st.lon == null) { busAppendLog(`[${st.name}] 좌표 정보가 없어 테스트할 수 없습니다.`); return; }
    busState.lastFixTs = 0; // 테스트 버튼은 즉시 반영되도록 갱신 간격 제한을 건너뛴다
    busAppendLog(`GPS 테스트: [${st.seq}] ${st.name} 위치로 이동 시뮬레이션`);
    busHandleFix(st.lat, st.lon, 5, Date.now());
}

function busTestPrev() {
    if (!busState.stations) return;
    busState.testIndex = Math.max(0, (busState.testIndex ?? busState.currentIndex) - 1);
    busApplyTestPosition(busState.testIndex);
}

function busTestNext() {
    if (!busState.stations) return;
    busState.testIndex = Math.min(busState.stations.length - 1, (busState.testIndex ?? busState.currentIndex) + 1);
    busApplyTestPosition(busState.testIndex);
}

// ----- GPS 판정 핵심 로직 -----
function busHandleFix(lat, lon, acc, ts) {
    if (busState.lastFixTs && ts - busState.lastFixTs < busSettings.gpsIntervalMs) return;
    busState.lastFixTs = ts;
    busState.lastPos = { lat, lon, acc };
    busUpdateRunScreenGps();

    if (acc != null && acc > busSettings.accuracyMaxM) {
        busAppendLog(`정확도 나쁨(±${Math.round(acc)}m > 임계값 ${busSettings.accuracyMaxM}m) → 이 위치는 무시`);
        return;
    }
    if (!busState.stations || !busState.stations.length) return;
    if (!busState.running || busState.paused) return;

    busEvaluatePosition(lat, lon, acc, busState.autoGps);
}

function busEvaluatePosition(lat, lon, acc, allowAdvance) {
    const stations = busState.stations;
    const idx = busState.expectedIndex;
    const curSt = stations[idx];
    const nextSt = stations[idx + 1] || null;
    const next2St = stations[idx + 2] || null;

    const dCur = curSt ? busHaversine(lat, lon, curSt.lat, curSt.lon) : null;
    const dNext = nextSt ? busHaversine(lat, lon, nextSt.lat, nextSt.lon) : null;
    const dNext2 = next2St ? busHaversine(lat, lon, next2St.lat, next2St.lon) : null;

    busUpdateDistanceUi(dNext);

    let acted = false;

    if (dNext != null) {
        if (dNext < busState.bestNextDist) busState.bestNextDist = dNext;
        const arrivedByProximity = dNext <= busSettings.arriveM;
        const passedByHysteresis =
            busState.bestNextDist <= busSettings.approachM &&
            dNext > busState.bestNextDist + busSettings.passM;
        // 참고: 별도의 시간 기반 쿨다운은 두지 않는다. 도착 판정 즉시 expectedIndex가 다음 정류장으로
        // 넘어가고 bestNextDist가 리셋되므로, 그 다음부터는 "그다음" 정류장을 기준으로만 비교하게 되어
        // 방금 도착한 정류장이 같은 이유로 다시 트리거될 수 없다(구조적으로 1회만 처리됨).
        // 여기에 시간 쿨다운까지 더하면 정류장 간격이 짧은 구간에서 정상적인 연속 도착까지 막아버린다.
        if (allowAdvance && (arrivedByProximity || passedByHysteresis)) {
            busAppendLog(
                `도착 판정: [${nextSt.seq}] ${nextSt.name} (거리 ${Math.round(dNext)}m, ` +
                `사유: ${arrivedByProximity ? "근접 도착" : "통과(멀어짐) 감지"})`
            );
            busAdvanceTo(idx + 1);
            acted = true;
        } else if (dNext <= busSettings.approachM) {
            busAppendLog(`접근 중: [${nextSt.seq}] ${nextSt.name} (거리 ${Math.round(dNext)}m)`);
        }
    }

    // 후보 윈도우(N-1..N+2) 중 N+2가 뚜렷하게 더 가까우면 "건너뛰었을 가능성"만 참고로 알려준다.
    // (정류장이 한 번에 여러 개 넘어가지 않도록, 자동으로 건너뛰지는 않는다.)
    if (!acted && dNext2 != null && dNext != null && dNext2 + 15 < dNext && dNext2 < busSettings.arriveM) {
        busAppendLog(
            `참고: 다음 정류장(${nextSt ? nextSt.name : "-"})보다 그다음(${next2St.name})이 더 가깝습니다(${Math.round(dNext2)}m). ` +
            `정류장을 건너뛰었다면 [다음 정류장] 버튼으로 수동 보정하세요.`
        );
    }

    if (!acted) {
        busAppendLog(
            `GPS: (${lat.toFixed(6)}, ${lon.toFixed(6)}) ±${acc != null ? Math.round(acc) : "?"}m` +
            (dCur != null ? ` · 현재[${curSt.name}]까지 ${Math.round(dCur)}m` : "") +
            (dNext != null ? ` · 다음[${nextSt.name}]까지 ${Math.round(dNext)}m` : "")
        );
    }
}

function busAdvanceTo(newIdx) {
    if (!busState.stations) return;
    if (newIdx >= busState.stations.length) newIdx = busState.stations.length - 1;
    busState.currentIndex = newIdx;
    busState.expectedIndex = newIdx;
    busState.bestNextDist = Infinity;
    busState.lastArrivalTs = Date.now();
    busRenderStationList();
    busUpdateRunScreen();
    busSendShow();
    busSaveState();
}

// ----- 초기화 -----
function busInit() {
    if (window.BUS_ROUTES) {
        const meta = BUS_ROUTES;
        document.getElementById("busDataInfo").textContent =
            `데이터: 노선 ${meta.routeCount ?? "?"}개 · 정류장 행 ${meta.stationRowCount ?? "?"}개` +
            (meta.generatedAt ? ` (생성: ${meta.generatedAt})` : "");
    } else {
        document.getElementById("busDataInfo").textContent =
            "bus_routes.js가 로드되지 않았습니다. index.html과 같은 폴더에 bus_routes.js를 두세요.";
    }
    busReflectSettingsToInputs();
    busLoadState();
    setInterval(busPingTick, 5000);
}

busInit();
